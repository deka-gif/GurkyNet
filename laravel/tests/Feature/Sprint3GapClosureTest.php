<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Jobs\ProcessMidtransCallback;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 3 gap closure — SRS 14.1 CS refund idempotency + Bagian 24 #7/#8.
 */
class Sprint3GapClosureTest extends TestCase
{
    use RefreshDatabase;

    protected User $cs;
    protected User $customer;
    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->cs = User::create([
            'name' => 'CS Agent',
            'email' => 'cs-gap@gurkynet.test',
            'phone_number' => '081288800001',
            'password' => Hash::make('password123'),
            'role' => UserRole::CUSTOMER_SUPPORT,
        ]);

        $this->customer = User::create([
            'name' => 'Customer Gap',
            'email' => 'customer-gap@gurkynet.test',
            'phone_number' => '081288800002',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
            'role' => UserRole::USER,
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->customer->id,
            'wallet_number' => '104288800002',
            'balance' => 50000.00,
            'status' => 'active',
        ]);
    }

    /**
     * Sprint 6 / SRS 4.4.5 — CS must not approve balance-mutating refunds.
     * Idempotent SUCCESS→REFUNDED approve remains on Finance path (Sprint 3/4).
     */
    public function test_cs_refund_approve_is_forbidden_no_wallet_mutation(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->customer->id,
            'invoice_number' => 'GRK-CS-REFUND-1',
            'service_name' => 'Pulsa',
            'target_number' => '0812',
            'amount' => 11000,
            'admin_fee' => 0,
            'total_payment' => 11000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SUCCESS->value,
            'notes' => 'refund claim',
        ]);

        Sanctum::actingAs($this->cs);
        $this->putJson("/api/v1/admin/customer-support/refunds/{$tx->id}", [
            'status' => 'approved',
            'notes' => 'SUCCESS complaint field failure',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(403);

        $this->wallet->refresh();
        $this->assertEquals(50000.00, (float) $this->wallet->balance);
        $this->assertEquals(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals(0, WalletMutation::where('wallet_id', $this->wallet->id)->where('type', 'refund')->count());
    }

    public function test_cs_refund_approve_requires_finance_escalation_not_cs_mutation(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->customer->id,
            'invoice_number' => 'GRK-CS-REFUND-2',
            'service_name' => 'Pulsa',
            'target_number' => '0812',
            'amount' => 5000,
            'admin_fee' => 0,
            'total_payment' => 5000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
            'notes' => 'refund',
        ]);

        Sanctum::actingAs($this->cs);
        $this->putJson("/api/v1/admin/customer-support/refunds/{$tx->id}", [
            'status' => 'approved',
            'notes' => 'ok',
        ])->assertStatus(403);

        $this->wallet->refresh();
        $this->assertEquals(50000.00, (float) $this->wallet->balance);
    }

    public function test_finance_refund_approve_idempotent_no_double_credit(): void
    {
        $finance = User::create([
            'name' => 'Finance Gap',
            'email' => 'finance-gap@gurkynet.test',
            'phone_number' => '081288800099',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
        ]);

        $tx = Transaction::create([
            'user_id' => $this->customer->id,
            'invoice_number' => 'GRK-FIN-REFUND-1',
            'service_name' => 'Pulsa',
            'target_number' => '0812',
            'amount' => 11000,
            'admin_fee' => 0,
            'total_payment' => 11000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
            'notes' => 'refund claim',
        ]);

        $key = (string) Str::uuid();
        Sanctum::actingAs($finance);
        $first = $this->postJson("/api/v1/admin/finance/refunds/{$tx->id}/approve", [
            'reason' => 'Finance approve',
            'idempotency_key' => $key,
        ]);
        $first->assertSuccessful();

        $this->wallet->refresh();
        $this->assertEquals(61000.00, (float) $this->wallet->balance);
        $this->assertEquals(1, WalletMutation::where('wallet_id', $this->wallet->id)->where('type', 'refund')->count());

        $second = $this->postJson("/api/v1/admin/finance/refunds/{$tx->id}/approve", [
            'reason' => 'Finance approve',
            'idempotency_key' => $key,
        ]);
        $second->assertSuccessful();

        $this->wallet->refresh();
        $this->assertEquals(61000.00, (float) $this->wallet->balance);
        $this->assertEquals(1, WalletMutation::where('wallet_id', $this->wallet->id)->where('type', 'refund')->count());
    }

    /**
     * SRS Bagian 24 #7 — 20 purchase attempts in 1 minute must hit rate limiting.
     */
    public function test_transaction_rate_limit_rejects_after_limit_within_20_attempts(): void
    {
        Sanctum::actingAs($this->customer);

        $statuses = [];
        for ($i = 0; $i < 20; $i++) {
            $res = $this->postJson('/api/v1/transactions', [
                'sku_code' => 'NO-SUCH-SKU',
                'target_number' => '081234567890',
                'pin' => '123456',
                'idempotency_key' => (string) Str::uuid(),
            ]);
            $statuses[] = $res->status();
        }

        $this->assertContains(429, $statuses, 'SRS 24 #7: rate limiting must reject attempts after the limit within 20 tries');
        $this->assertTrue(
            collect($statuses)->filter(fn ($s) => $s === 429)->count() >= 1
        );
    }

    /**
     * SRS Bagian 24 #8 — forged Midtrans signature rejected; no wallet credit / no job.
     */
    public function test_forged_midtrans_signature_rejected_no_wallet_credit(): void
    {
        Queue::fake();
        config(['services.midtrans.server_key' => 'testing_server_key']);

        $tx = Transaction::create([
            'user_id' => $this->customer->id,
            'invoice_number' => 'TRX-FORGED-SIG-1',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 25000.00,
            'admin_fee' => 0,
            'total_payment' => 25000.00,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::PENDING->value,
        ]);

        $payload = [
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'bank_transfer',
            'fraud_status' => 'accept',
            'signature_key' => 'forged-signature-not-matching-sha512',
        ];

        $response = $this->postJson('/api/v1/webhooks/midtrans', $payload);
        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Invalid webhook signature.',
            ]);

        Queue::assertNotPushed(ProcessMidtransCallback::class);

        $this->wallet->refresh();
        $this->assertEquals(50000.00, (float) $this->wallet->balance);
        $this->assertEquals(0, WalletMutation::where('wallet_id', $this->wallet->id)->where('type', 'topup')->count());
        $this->assertEquals(TransactionStatus::PENDING->value, $tx->fresh()->status);
    }
}
