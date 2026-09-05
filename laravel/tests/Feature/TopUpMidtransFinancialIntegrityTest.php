<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Enums\WalletHistoryType;
use App\Jobs\ProcessMidtransCallback;
use App\Models\MidtransTransaction;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * FR-TOPUP-FIX-02 — Midtrans Top Up financial integrity (exactly-once credit, status safety).
 */
class TopUpMidtransFinancialIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.midtrans.server_key' => 'testing_server_key',
            'services.midtrans.client_key' => 'testing_client_key',
            'services.midtrans.is_production' => false,
        ]);

        $this->user = User::create([
            'name' => 'TopUp Integrity User',
            'email' => 'topup-integrity@gurkynet.test',
            'phone_number' => '081299990201',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W90201',
            'balance' => 100000,
            'status' => 'active',
        ]);
    }

    protected function makeTopUp(array $overrides = []): Transaction
    {
        $tx = Transaction::create(array_merge([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-TUI-'.uniqid(),
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 25000,
            'admin_fee' => 0,
            'total_payment' => 25000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::PENDING->value,
        ], $overrides));

        MidtransTransaction::create([
            'transaction_id' => $tx->id,
            'order_id' => $tx->invoice_number,
            'snap_token' => 'snap-tui',
            'gross_amount' => $tx->total_payment,
            'transaction_status' => 'pending',
        ]);

        return $tx;
    }

    protected function settlementPayload(Transaction $tx, array $extra = []): array
    {
        return array_merge([
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => number_format((float) $tx->total_payment, 2, '.', ''),
            'transaction_status' => 'settlement',
            'payment_type' => 'qris',
        ], $extra);
    }

    protected function process(array $payload): void
    {
        (new ProcessMidtransCallback($payload))->handle();
    }

    protected function metricTypeFor(string $invoice): ?string
    {
        $log = \App\Models\ActivityLog::query()
            ->where('activity', 'midtrans_callback_metric')
            ->where('payload->order_id', $invoice)
            ->latest('id')
            ->first();

        return is_array($log?->payload) ? ($log->payload['metric_type'] ?? null) : null;
    }

    public function test_a_pending_does_not_credit_or_mark_failed_metric(): void
    {
        $tx = $this->makeTopUp();
        $before = (float) $this->wallet->fresh()->balance;

        $this->process([
            'order_id' => $tx->invoice_number,
            'status_code' => '201',
            'gross_amount' => '25000.00',
            'transaction_status' => 'pending',
        ]);

        $this->assertSame(TransactionStatus::PROCESSING->value, $tx->fresh()->status);
        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::where('reference_id', (string) $tx->id)->count());
        $this->assertSame('payment_pending', $this->metricTypeFor($tx->invoice_number));
    }

    public function test_b_settlement_credits_once_with_ledger_rows(): void
    {
        $tx = $this->makeTopUp();
        $before = (float) $this->wallet->fresh()->balance;

        $this->process($this->settlementPayload($tx));

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals($before + 25000, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('reference_id', (string) $tx->id)->where('type', WalletMutation::TYPE_TOPUP)->count());
        $this->assertDatabaseHas('wallet_histories', [
            'wallet_id' => $this->wallet->id,
            'reference_id' => $tx->id,
            'type' => WalletHistoryType::CREDIT->value,
        ]);
        $this->assertSame('payment_success', $this->metricTypeFor($tx->invoice_number));
    }

    public function test_c_duplicate_settlement_is_idempotent(): void
    {
        $tx = $this->makeTopUp();
        $payload = $this->settlementPayload($tx);

        $this->process($payload);
        $this->process($payload);

        $this->assertEquals(125000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('reference_id', (string) $tx->id)->where('type', WalletMutation::TYPE_TOPUP)->count());
        $this->assertSame(1, WalletHistory::where('reference_id', $tx->id)->where('type', WalletHistoryType::CREDIT->value)->count());
    }

    public function test_d_concurrent_settlement_attempts_credit_once(): void
    {
        $tx = $this->makeTopUp();
        $payload = $this->settlementPayload($tx);

        // Simulate two processors arriving back-to-back (same as webhook + reconciliation race).
        $this->process($payload);
        $this->process($payload);
        $this->process($payload);

        $this->assertEquals(125000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $tx->id)->count());
    }

    public function test_e_amount_mismatch_does_not_credit_or_success(): void
    {
        $tx = $this->makeTopUp();
        $before = (float) $this->wallet->fresh()->balance;

        $this->process($this->settlementPayload($tx, ['gross_amount' => '24999.00']));

        $this->assertNotSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::where('reference_id', (string) $tx->id)->count());
        $this->assertDatabaseHas('activity_logs', [
            'activity' => 'MIDTRANS_AMOUNT_MISMATCH',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_f_missing_wallet_does_not_mark_success(): void
    {
        $tx = $this->makeTopUp(['user_id' => $this->user->id]);
        $this->wallet->delete();

        try {
            $this->process($this->settlementPayload($tx));
            $this->fail('Expected RuntimeException when wallet missing');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('Wallet', $e->getMessage());
        }

        $this->assertNotSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertSame(0, WalletMutation::count());
    }

    public function test_g_expire_leaves_wallet_unchanged(): void
    {
        $tx = $this->makeTopUp();
        $before = (float) $this->wallet->fresh()->balance;

        $this->process([
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'expire',
        ]);

        $this->assertSame(TransactionStatus::EXPIRED->value, $tx->fresh()->status);
        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::where('reference_id', (string) $tx->id)->count());
        $this->assertSame('payment_expired', $this->metricTypeFor($tx->invoice_number));
    }

    public function test_h_cancel_leaves_wallet_unchanged(): void
    {
        $tx = $this->makeTopUp();

        $this->process([
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'cancel',
        ]);

        $this->assertSame(TransactionStatus::CANCELED->value, $tx->fresh()->status);
        $this->assertSame(0, WalletMutation::where('reference_id', (string) $tx->id)->count());
        $this->assertSame('payment_canceled', $this->metricTypeFor($tx->invoice_number));
    }

    public function test_i_deny_leaves_wallet_unchanged(): void
    {
        $tx = $this->makeTopUp();

        $this->process([
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'deny',
        ]);

        $this->assertSame(TransactionStatus::FAILED->value, $tx->fresh()->status);
        $this->assertSame(0, WalletMutation::where('reference_id', (string) $tx->id)->count());
        $this->assertSame('payment_failed', $this->metricTypeFor($tx->invoice_number));
    }

    public function test_j_challenge_stays_pending_metric(): void
    {
        $tx = $this->makeTopUp();

        $this->process([
            'order_id' => $tx->invoice_number,
            'status_code' => '201',
            'gross_amount' => '25000.00',
            'transaction_status' => 'challenge',
        ]);

        $this->assertSame(TransactionStatus::PROCESSING->value, $tx->fresh()->status);
        $this->assertSame(0, WalletMutation::where('reference_id', (string) $tx->id)->count());
        $this->assertSame('payment_pending', $this->metricTypeFor($tx->invoice_number));
    }

    public function test_k_webhook_and_reconciliation_path_credit_once(): void
    {
        $tx = $this->makeTopUp();
        $payload = $this->settlementPayload($tx);

        ProcessMidtransCallback::dispatchSync($payload);
        (new ProcessMidtransCallback($payload))->handle();

        $this->assertEquals(125000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $tx->id)->count());
    }

    public function test_l_late_settlement_on_expired_does_not_credit(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::EXPIRED->value]);
        $before = (float) $this->wallet->fresh()->balance;

        $this->process($this->settlementPayload($tx));

        $this->assertSame(TransactionStatus::EXPIRED->value, $tx->fresh()->status);
        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::where('reference_id', (string) $tx->id)->count());
        $this->assertDatabaseHas('activity_logs', [
            'activity' => 'MIDTRANS_LATE_SETTLEMENT_ON_TERMINAL',
            'user_id' => $this->user->id,
        ]);
    }

    /**
     * @dataProvider terminalFailureStatusesProvider
     */
    public function test_e_terminal_failure_cannot_be_revived_by_settlement(string $terminalStatus): void
    {
        $tx = $this->makeTopUp(['status' => $terminalStatus]);
        $before = (float) $this->wallet->fresh()->balance;

        $this->process($this->settlementPayload($tx));

        $this->assertSame($terminalStatus, $tx->fresh()->status);
        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::where('reference_id', (string) $tx->id)->count());
        $this->assertDatabaseHas('activity_logs', [
            'activity' => 'MIDTRANS_LATE_SETTLEMENT_ON_TERMINAL',
            'user_id' => $this->user->id,
        ]);
    }

    /** @return array<string, array{0: string}> */
    public static function terminalFailureStatusesProvider(): array
    {
        return [
            'failed' => [TransactionStatus::FAILED->value],
            'expired' => [TransactionStatus::EXPIRED->value],
            'canceled' => [TransactionStatus::CANCELED->value],
            'legacy gagal' => [TransactionStatus::GAGAL->value],
        ];
    }

    public function test_m_refund_after_credit_opens_manual_incident_not_second_topup(): void
    {
        $tx = $this->makeTopUp();
        $this->process($this->settlementPayload($tx));
        $before = (float) $this->wallet->fresh()->balance;

        $this->process([
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'refund',
        ]);

        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $tx->id)->count());
        $this->assertDatabaseHas('activity_logs', [
            'activity' => 'MIDTRANS_TOPUP_REFUND_REQUIRES_MANUAL',
            'user_id' => $this->user->id,
        ]);
    }
}
