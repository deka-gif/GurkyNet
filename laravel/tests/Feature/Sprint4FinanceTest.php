<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\DepositRequest;
use App\Models\MidtransTransaction;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Models\WithdrawRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Sprint 4 — FR-FIN-01, 02, 03, 04 (monitor), 05, 08.
 */
class Sprint4FinanceTest extends TestCase
{
    use RefreshDatabase;

    protected User $finance;
    protected User $agent;
    protected Wallet $agentWallet;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        $this->finance = User::create([
            'name' => 'Finance S4',
            'email' => 'finance-s4@gurkynet.test',
            'phone_number' => '081211100001',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->agent = User::create([
            'name' => 'Agen S4',
            'email' => 'agen-s4@gurkynet.test',
            'phone_number' => '081211100002',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        $this->seedApprovedAgentKyc($this->agent);

        $this->agentWallet = Wallet::create([
            'user_id' => $this->agent->id,
            'wallet_number' => '104211100002',
            'balance' => 100000.00,
            'status' => 'active',
        ]);
    }

    public function test_fr_fin_01_finance_lists_wallets_and_mutations(): void
    {
        WalletMutation::create([
            'wallet_id' => $this->agentWallet->id,
            'type' => 'topup',
            'amount' => 50000,
            'reference_id' => '1',
        ]);

        $this->actingAs($this->agent)->getJson('/api/v1/admin/finance/wallets')->assertStatus(403);

        $list = $this->actingAs($this->finance)->getJson('/api/v1/admin/finance/wallets?q=agen-s4');
        $list->assertStatus(200)->assertJsonPath('success', true);
        $this->assertGreaterThanOrEqual(1, count($list->json('data')));

        $mut = $this->actingAs($this->finance)->getJson('/api/v1/admin/finance/wallets/'.$this->agent->id.'/mutations');
        $mut->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, count($mut->json('data')));
    }

    public function test_fr_fin_02_adjustment_requires_reason_and_is_idempotent(): void
    {
        $key = (string) Str::uuid();
        $payload = [
            'user_id' => $this->agent->id,
            'amount' => 5000,
            'direction' => 'credit',
            'reason' => 'Kompensasi Sprint4',
            'idempotency_key' => $key,
        ];

        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/wallet/adjust', [
            'user_id' => $this->agent->id,
            'amount' => 5000,
            'direction' => 'credit',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(422);

        $r1 = $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/wallet/adjust', $payload);
        $r2 = $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/wallet/adjust', $payload);
        $r1->assertStatus(200);
        $r2->assertStatus(200);

        $this->agentWallet->refresh();
        $this->assertEquals(105000.00, (float) $this->agentWallet->balance);
        $this->assertEquals(1, WalletMutation::where('wallet_id', $this->agentWallet->id)->where('type', 'adjustment')->count());
        $this->assertTrue(ActivityLog::where('activity', 'FINANCE_WALLET_ADJUST')->exists());
    }

    public function test_fr_fin_03_manual_deposit_approve_once_and_reject_no_credit(): void
    {
        $file = UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf');
        $submit = $this->actingAs($this->agent)->post('/api/v1/wallet/deposit-manual', [
            'amount' => 50000,
            'proof' => $file,
            'notes' => 'Transfer BCA',
        ], ['Accept' => 'application/json']);
        $submit->assertStatus(201);
        $depositId = $submit->json('data.id');

        $queue = $this->actingAs($this->finance)->getJson('/api/v1/admin/finance/deposits?status=pending');
        $queue->assertStatus(200);
        $this->assertTrue(collect($queue->json('data'))->contains(fn ($r) => (int) $r['id'] === (int) $depositId));

        $key = (string) Str::uuid();
        $a1 = $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/deposits/'.$depositId.'/approve', [
            'idempotency_key' => $key,
        ]);
        $a2 = $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/deposits/'.$depositId.'/approve', [
            'idempotency_key' => $key,
        ]);
        $a1->assertStatus(200);
        $a2->assertStatus(200);

        $this->agentWallet->refresh();
        $this->assertEquals(150000.00, (float) $this->agentWallet->balance);
        $this->assertEquals(1, WalletMutation::where('wallet_id', $this->agentWallet->id)->where('type', 'topup')->count());

        $file2 = UploadedFile::fake()->image('bukti2.jpg');
        $submit2 = $this->actingAs($this->agent)->post('/api/v1/wallet/deposit-manual', [
            'amount' => 25000,
            'proof' => $file2,
        ], ['Accept' => 'application/json']);
        $dep2 = $submit2->json('data.id');
        $before = (float) $this->agentWallet->fresh()->balance;
        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/deposits/'.$dep2.'/reject', [
            'reason' => 'Bukti tidak jelas',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(200);
        $this->assertEquals($before, (float) $this->agentWallet->fresh()->balance);
        $this->assertEquals('rejected', DepositRequest::find($dep2)->status);
        $this->assertTrue(ActivityLog::where('activity', 'FINANCE_DEPOSIT_REJECT')->exists());
    }

    public function test_fr_fin_04_automatic_midtrans_monitoring(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->agent->id,
            'invoice_number' => 'TRX-TOPUP-S4-1',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->agentWallet->wallet_number,
            'amount' => 20000,
            'admin_fee' => 0,
            'total_payment' => 20000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        MidtransTransaction::create([
            'transaction_id' => $tx->id,
            'order_id' => 'TRX-TOPUP-S4-1',
            'gross_amount' => 20000,
            'transaction_status' => 'settlement',
            'payment_type' => 'qris',
        ]);

        $res = $this->actingAs($this->finance)->getJson('/api/v1/admin/finance/deposits/automatic');
        $res->assertStatus(200);
        $row = collect($res->json('data'))->firstWhere('midtrans_order_id', 'TRX-TOPUP-S4-1');
        $this->assertNotNull($row);
        $this->assertTrue($row['credited']);
    }

    public function test_fr_fin_05_withdraw_hold_approve_reject_and_hold_status(): void
    {
        $key = (string) Str::uuid();
        $wd = $this->actingAs($this->agent)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 20000,
            'pin' => '123456',
            'bank_name' => 'BCA',
            'account_number' => '111122223333',
            'idempotency_key' => $key,
        ]);
        $wd->assertStatus(201);
        $this->agentWallet->refresh();
        $this->assertEquals(80000.00, (float) $this->agentWallet->balance);
        $this->assertEquals(1, WalletMutation::where('wallet_id', $this->agentWallet->id)->where('type', 'hold')->count());
        $this->assertEquals(0, WalletMutation::where('wallet_id', $this->agentWallet->id)->where('type', 'withdraw')->count());

        $req = WithdrawRequest::where('user_id', $this->agent->id)->first();
        $this->assertNotNull($req);
        $this->assertEquals('pending', $req->status);
        $this->assertEquals(TransactionStatus::LOCKED->value, $req->transaction->status);

        $approveKey = (string) Str::uuid();
        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/withdrawals/'.$req->id.'/approve', [
            'idempotency_key' => $approveKey,
        ])->assertStatus(200);
        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/withdrawals/'.$req->id.'/approve', [
            'idempotency_key' => $approveKey,
        ])->assertStatus(200);

        $this->agentWallet->refresh();
        $this->assertEquals(80000.00, (float) $this->agentWallet->balance);
        $this->assertEquals(1, WalletMutation::where('wallet_id', $this->agentWallet->id)->where('type', 'withdraw')->count());
        $this->assertEquals('approved', $req->fresh()->status);

        // Second withdraw → reject unhold
        $wd2 = $this->actingAs($this->agent)->postJson('/api/v1/wallet/withdraw', [
            'amount' => 10000,
            'pin' => '123456',
            'bank_name' => 'BNI',
            'account_number' => '999',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(201);
        $req2 = WithdrawRequest::where('user_id', $this->agent->id)->where('status', 'pending')->latest('id')->first();
        $balAfterHold = (float) $this->agentWallet->fresh()->balance; // 70000

        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/withdrawals/'.$req2->id.'/hold', [
            'notes' => 'Cek rekening',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(200);
        $this->assertEquals('on_hold', $req2->fresh()->status);
        $this->assertEquals($balAfterHold, (float) $this->agentWallet->fresh()->balance);

        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/withdrawals/'.$req2->id.'/reject', [
            'reason' => 'Rekening tidak valid',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(200);
        $this->assertEquals(80000.00, (float) $this->agentWallet->fresh()->balance);
        $this->assertEquals('rejected', $req2->fresh()->status);
    }

    public function test_fr_fin_08_report_periods_and_exports(): void
    {
        foreach (['daily', 'weekly', 'monthly'] as $period) {
            $this->actingAs($this->finance)
                ->getJson('/api/v1/admin/finance/reports/structured?period='.$period)
                ->assertStatus(200);
        }

        $xlsx = $this->actingAs($this->finance)->get('/api/v1/admin/finance/reports/export?format=xlsx&period=monthly');
        $xlsx->assertStatus(200);
        $this->assertStringContainsString(
            'spreadsheetml',
            (string) $xlsx->headers->get('content-type')
        );

        $pdf = $this->actingAs($this->finance)->get('/api/v1/admin/finance/reports/export?format=pdf&period=daily');
        $pdf->assertStatus(200);
        $this->assertStringContainsString('pdf', strtolower((string) $pdf->headers->get('content-type')));

        $this->actingAs($this->agent)->getJson('/api/v1/admin/finance/reports/export?format=pdf&period=daily')
            ->assertStatus(403);
    }
}
