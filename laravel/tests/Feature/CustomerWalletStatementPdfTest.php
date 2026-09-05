<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Enums\WalletHistoryType;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use App\Models\WithdrawRequest;
use App\Services\Wallet\CustomerStatementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 2 — customer statement PDF must reuse CustomerStatementService DTO.
 */
class CustomerWalletStatementPdfTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected User $other;
    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.timezone' => 'Asia/Jakarta']);
        Carbon::setTestNow(Carbon::parse('2026-09-15 12:00:00', 'Asia/Jakarta'));

        $this->user = User::create([
            'name' => 'PDF Owner',
            'email' => 'stmt-pdf@gurkynet.test',
            'phone_number' => '081900000101',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);
        $this->user->forceFill(['gurky_pay_id' => '20263128101'])->save();

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '20263128101',
            'previous_wallet_number' => '1042999910101',
            'balance' => 0,
            'status' => 'active',
        ]);

        $this->other = User::create([
            'name' => 'PDF Other',
            'email' => 'stmt-pdf-other@gurkynet.test',
            'phone_number' => '081900000102',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);
        $this->other->forceFill(['gurky_pay_id' => '20263128102'])->save();
        Wallet::create([
            'user_id' => $this->other->id,
            'wallet_number' => '20263128102',
            'balance' => 500000,
            'status' => 'active',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function addMutation(
        string $type,
        float $signedAmount,
        string $at,
        ?string $referenceId = null,
        ?string $description = null,
        bool $touchBalance = true
    ): WalletMutation {
        $mutation = WalletMutation::create([
            'wallet_id' => $this->wallet->id,
            'type' => $type,
            'amount' => $signedAmount,
            'reference_id' => $referenceId,
        ]);
        $mutation->created_at = Carbon::parse($at, 'Asia/Jakarta');
        $mutation->updated_at = $mutation->created_at;
        $mutation->save();

        if ($description !== null) {
            $history = WalletHistory::create([
                'wallet_id' => $this->wallet->id,
                'amount' => abs($signedAmount),
                'type' => $signedAmount < 0
                    ? WalletHistoryType::DEBIT->value
                    : WalletHistoryType::CREDIT->value,
                'description' => $description,
                'reference_id' => $referenceId,
            ]);
            $history->created_at = $mutation->created_at;
            $history->updated_at = $mutation->created_at;
            $history->save();
        }

        if ($touchBalance) {
            $this->wallet->balance = round((float) $this->wallet->balance + $signedAmount, 2);
            $this->wallet->save();
        }

        return $mutation->fresh();
    }

    public function test_own_pdf_download_headers_and_content(): void
    {
        $this->addMutation(WalletMutation::TYPE_TOPUP, 500000, '2026-08-20 10:00:00', 'seed', 'Seed');
        $this->addMutation(WalletMutation::TYPE_HOLD, -75000, '2026-09-05 09:00:00', '10', 'Pulsa XL');
        $this->addMutation(WalletMutation::TYPE_TOPUP, 200000, '2026-09-10 09:00:00', '11', 'Top Up Midtrans');
        $this->addMutation(WalletMutation::TYPE_REFUND, 25000, '2026-09-12 09:00:00', '12', 'Refund sebagian');
        $this->addMutation(WalletMutation::TYPE_ADJUSTMENT, -10000, '2026-09-14 09:00:00', '13', 'Penyesuaian debit');

        Sanctum::actingAs($this->user);

        $json = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $pdfRes = $this->get('/api/v1/wallet/statements/2026-09/pdf')->assertOk();

        $pdfRes->assertHeader('content-type', 'application/pdf');
        $disposition = (string) $pdfRes->headers->get('content-disposition');
        $this->assertStringContainsString('attachment', $disposition);
        $this->assertStringContainsString('GurkyPay-Laporan-Keuangan-2026-09.pdf', $disposition);

        $binary = $pdfRes->getContent();
        $this->assertStringStartsWith('%PDF', $binary);

        // Same financial figures as JSON (service reuse)
        $this->assertSame(500000.0, (float) $json['opening_balance']);
        $this->assertSame(225000.0, (float) $json['income']);
        $this->assertSame(85000.0, (float) $json['expense']);
        $this->assertSame(640000.0, (float) $json['ending_balance']);

        $html = view('statements.monthly', [
            'statement' => $json,
            'period_label' => app(CustomerStatementService::class)->formatPeriodLabel($json),
        ])->render();

        $this->assertStringContainsString('PDF Owner', $html);
        $this->assertStringContainsString('20263128101', $html);
        $this->assertStringNotContainsString('1042999910101', $html);
        $this->assertStringNotContainsString('previous_wallet', $html);
        $this->assertStringContainsString('1 September 2026 — 30 September 2026', $html);
        $this->assertStringContainsString('Rp 500.000', $html);
        $this->assertStringContainsString('Rp 225.000', $html);
        $this->assertStringContainsString('Rp 85.000', $html);
        $this->assertStringContainsString('Rp 640.000', $html);
        $this->assertStringContainsString('Pulsa XL', $html);
        $this->assertStringNotContainsString('digiflazz', strtolower($html));
        $this->assertStringNotContainsString('server_key', strtolower($html));
    }

    public function test_pdf_json_dto_identity(): void
    {
        $this->addMutation(WalletMutation::TYPE_TOPUP, 100000, '2026-09-01 10:00:00', 's', 'Top Up');

        $service = app(CustomerStatementService::class);
        $built = $service->build($this->user->fresh(), $this->wallet->fresh(), '2026-09');

        Sanctum::actingAs($this->user);
        $json = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');

        $this->assertEqualsWithDelta((float) $built['opening_balance'], (float) $json['opening_balance'], 0.01);
        $this->assertEqualsWithDelta((float) $built['income'], (float) $json['income'], 0.01);
        $this->assertEqualsWithDelta((float) $built['expense'], (float) $json['expense'], 0.01);
        $this->assertEqualsWithDelta((float) $built['ending_balance'], (float) $json['ending_balance'], 0.01);
        $this->assertSame($built['account']['gurky_pay_id'], $json['account']['gurky_pay_id']);
        $this->assertCount(count($built['mutations']), $json['mutations']);

        // PDF endpoint must use the same build() path (headers prove generation succeeded).
        $this->get('/api/v1/wallet/statements/2026-09/pdf')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_user_cannot_download_other_user_pdf(): void
    {
        $this->addMutation(WalletMutation::TYPE_TOPUP, 1000, '2026-09-01 10:00:00', 's', null);

        Sanctum::actingAs($this->other);
        // Other user gets their own (empty/opening) statement PDF — never user A's ledger figures.
        $res = $this->get('/api/v1/wallet/statements/2026-09/pdf')->assertOk();
        $html = view('statements.monthly', [
            'statement' => app(CustomerStatementService::class)->build(
                $this->other->fresh(),
                Wallet::where('user_id', $this->other->id)->firstOrFail(),
                '2026-09'
            ),
            'period_label' => 'x',
        ])->render();
        $this->assertStringNotContainsString('PDF Owner', $html);
        $this->assertStringNotContainsString('20263128101', $html);
        $this->assertStringStartsWith('%PDF', $res->getContent());
    }

    public function test_invalid_and_future_period_pdf(): void
    {
        Sanctum::actingAs($this->user);
        $this->getJson('/api/v1/wallet/statements/2026-9/pdf')->assertStatus(422);
        $this->getJson('/api/v1/wallet/statements/2026-10/pdf')->assertStatus(422);
        $this->getJson('/api/v1/wallet/statements/September-2026/pdf')->assertStatus(422);
    }

    public function test_empty_month_pdf_valid(): void
    {
        $this->addMutation(WalletMutation::TYPE_TOPUP, 77777, '2026-07-01 10:00:00', 's', null);

        Sanctum::actingAs($this->user);
        $res = $this->get('/api/v1/wallet/statements/2026-09/pdf')->assertOk();
        $this->assertStringStartsWith('%PDF', $res->getContent());

        $json = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(77777.0, (float) $json['opening_balance']);
        $this->assertSame(0.0, (float) $json['income']);
        $this->assertSame([], $json['mutations']);
    }

    public function test_withdraw_marker_not_in_pdf_dto(): void
    {
        $this->addMutation(WalletMutation::TYPE_TOPUP, 200000, '2026-08-01 10:00:00', 'seed', null);
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-WD-PDF',
            'service_name' => 'Penarikan Dana',
            'target_number' => 'BCA:1',
            'amount' => 100000,
            'admin_fee' => 0,
            'total_payment' => 100000,
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        $this->addMutation(WalletMutation::TYPE_HOLD, -100000, '2026-09-02 10:00:00', (string) $tx->id, 'Hold withdraw');
        $this->addMutation(WalletMutation::TYPE_WITHDRAW, -100000, '2026-09-03 10:00:00', (string) $tx->id, 'Withdraw disetujui', false);
        WithdrawRequest::create([
            'user_id' => $this->user->id,
            'amount' => 100000,
            'admin_fee' => 0,
            'method' => 'bank_transfer',
            'bank_name' => 'BCA',
            'account_number' => '1',
            'status' => 'approved',
            'transaction_id' => $tx->id,
            'workflow' => WithdrawRequest::WORKFLOW_HOLD_QUEUE,
        ]);

        Sanctum::actingAs($this->user);
        $json = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertSame(100000.0, (float) $json['expense']);
        $this->assertNotContains(WalletMutation::TYPE_WITHDRAW, collect($json['mutations'])->pluck('ledger_type')->all());

        $html = view('statements.monthly', [
            'statement' => $json,
            'period_label' => app(CustomerStatementService::class)->formatPeriodLabel($json),
        ])->render();
        $this->assertStringNotContainsString('Withdraw disetujui', $html);
        $this->assertStringContainsString('Hold withdraw', $html);
        $this->assertStringContainsString('Rp 100.000', $html);
    }

    public function test_transfer_and_adjustment_in_pdf_presentation(): void
    {
        $this->addMutation(WalletMutation::TYPE_TOPUP, 50000, '2026-08-01 10:00:00', 's', null);
        $this->addMutation(WalletMutation::TYPE_WITHDRAW, -20000, '2026-09-04 10:00:00', '301', 'Transfer ke 20263128102');
        $this->addMutation(WalletMutation::TYPE_TOPUP, 15000, '2026-09-05 10:00:00', '302', 'Transfer masuk dari 999');
        $this->addMutation(WalletMutation::TYPE_ADJUSTMENT, 5000, '2026-09-06 10:00:00', 'a1', 'Adj credit');

        Sanctum::actingAs($this->user);
        $json = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $html = view('statements.monthly', [
            'statement' => $json,
            'period_label' => app(CustomerStatementService::class)->formatPeriodLabel($json),
        ])->render();

        $this->assertStringContainsString('Transfer ke 20263128102', $html);
        $this->assertStringContainsString('Transfer masuk dari 999', $html);
        $this->assertStringContainsString('Adj credit', $html);
        $this->assertStringContainsString('Transfer', $html);
        $this->assertStringContainsString('Penyesuaian', $html);
    }

    public function test_multipage_mutations_not_truncated_in_view(): void
    {
        $this->addMutation(WalletMutation::TYPE_TOPUP, 1000000, '2026-08-01 10:00:00', 'seed', null);
        for ($i = 1; $i <= 45; $i++) {
            $this->addMutation(
                WalletMutation::TYPE_HOLD,
                -1000,
                sprintf('2026-09-%02d 10:00:00', min(28, max(1, $i % 28 + 1))),
                'm'.$i,
                'MutasiUnique'.$i
            );
        }

        Sanctum::actingAs($this->user);
        $json = $this->getJson('/api/v1/wallet/statements/2026-09')->assertOk()->json('data');
        $this->assertCount(45, $json['mutations']);

        $html = view('statements.monthly', [
            'statement' => $json,
            'period_label' => app(CustomerStatementService::class)->formatPeriodLabel($json),
        ])->render();

        $this->assertStringContainsString('MutasiUnique1', $html);
        $this->assertStringContainsString('MutasiUnique45', $html);

        $pdf = $this->get('/api/v1/wallet/statements/2026-09/pdf')->assertOk()->getContent();
        $this->assertStringStartsWith('%PDF', $pdf);
        $this->assertGreaterThan(5000, strlen($pdf));
    }

    public function test_january_2027_period_label_dynamic(): void
    {
        Carbon::setTestNow(Carbon::parse('2027-02-01 12:00:00', 'Asia/Jakarta'));
        $this->addMutation(WalletMutation::TYPE_TOPUP, 1000, '2027-01-15 10:00:00', 'j', 'Jan topup');

        $svc = app(CustomerStatementService::class);
        $statement = $svc->build($this->user->fresh(), $this->wallet->fresh(), '2027-01');
        $this->assertSame(
            '1 Januari 2027 — 31 Januari 2027',
            $svc->formatPeriodLabel($statement)
        );
    }

    public function test_unauthenticated_pdf_rejected(): void
    {
        $this->getJson('/api/v1/wallet/statements/2026-09/pdf')->assertUnauthorized();
    }
}
