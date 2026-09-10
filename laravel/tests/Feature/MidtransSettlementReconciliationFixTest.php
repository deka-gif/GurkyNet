<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Events\TransactionSuccess;
use App\Jobs\ProcessMidtransCallback;
use App\Models\MidtransTransaction;
use App\Models\Notification;
use App\Models\Transaction;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Finance\Reconciliation\MidtransReconciliationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Regression: Midtrans settlement stuck when MT row is settlement but local unpaid.
 * Ensures pollPendingDeposits includes stuck settlements and credits exactly once.
 */
class MidtransSettlementReconciliationFixTest extends TestCase
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
            'finance.midtrans_pending_age_minutes' => 5,
        ]);

        $this->user = User::create([
            'name' => 'Settle Recon User',
            'email' => 'settle-recon@gurkynet.test',
            'phone_number' => '081299990301',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
            'notify_transactions' => true,
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W90301',
            'balance' => 100000,
            'status' => 'active',
        ]);
    }

    protected function makeTopUp(array $txOverrides = [], array $mtOverrides = []): Transaction
    {
        $tx = Transaction::create(array_merge([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-TOPUP-TEST-'.uniqid(),
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 20000,
            'admin_fee' => 0,
            'total_payment' => 20000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::PROCESSING->value,
            'created_at' => now()->subMinutes(10),
            'updated_at' => now()->subMinutes(10),
        ], $txOverrides));

        MidtransTransaction::create(array_merge([
            'transaction_id' => $tx->id,
            'order_id' => $tx->invoice_number,
            'snap_token' => 'snap-test',
            'gross_amount' => $tx->total_payment,
            'transaction_status' => 'pending',
            'created_at' => now()->subMinutes(10),
            'updated_at' => now()->subMinutes(10),
        ], $mtOverrides));

        return $tx->fresh(['midtransTransaction']);
    }

    protected function settlementHttp(Transaction $tx, string $status = 'settlement'): void
    {
        Http::fake([
            'api.sandbox.midtrans.com/*' => Http::response([
                'order_id' => $tx->invoice_number,
                'status_code' => '200',
                'gross_amount' => number_format((float) $tx->total_payment, 2, '.', ''),
                'transaction_status' => $status,
                'fraud_status' => 'accept',
                'payment_type' => 'bank_transfer',
            ], 200),
        ]);
    }

    public function test_settlement_reconcile_credits_once_and_notifies_once(): void
    {
        $tx = $this->makeTopUp();
        $this->settlementHttp($tx);

        app(MidtransReconciliationService::class)->reconcileOrder($tx->invoice_number);

        $tx->refresh();
        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->status);
        $this->assertEquals(120000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $tx->id)->count());

        $listener = app(\App\Listeners\SendNotification::class);
        $listener->handle(new TransactionSuccess($tx->fresh()));
        $listener->handle(new TransactionSuccess($tx->fresh()));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
        $this->assertSame(1, UserNotification::where('user_id', $this->user->id)->count());
    }

    public function test_duplicate_settlement_webhook_one_credit(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::PENDING->value]);
        $payload = [
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '20000.00',
            'transaction_status' => 'settlement',
            'fraud_status' => 'accept',
        ];

        (new ProcessMidtransCallback($payload))->handle();
        (new ProcessMidtransCallback($payload))->handle();

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals(120000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $tx->id)->count());
    }

    public function test_poll_includes_stuck_midtrans_settlement_with_local_processing(): void
    {
        $tx = $this->makeTopUp(
            ['status' => TransactionStatus::PROCESSING->value],
            ['transaction_status' => 'settlement', 'updated_at' => now()->subMinutes(10)]
        );
        $this->settlementHttp($tx);

        $result = app(MidtransReconciliationService::class)->pollPendingDeposits();

        $this->assertGreaterThanOrEqual(1, $result['polled']);
        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals(120000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $tx->id)->count());
    }

    public function test_existing_topup_mutation_no_second_credit(): void
    {
        $tx = $this->makeTopUp(
            ['status' => TransactionStatus::PROCESSING->value],
            ['transaction_status' => 'settlement']
        );

        WalletMutation::create([
            'wallet_id' => $this->wallet->id,
            'type' => WalletMutation::TYPE_TOPUP,
            'amount' => 20000,
            'reference_id' => (string) $tx->id,
        ]);
        $this->wallet->update(['balance' => 120000]);

        $payload = [
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '20000.00',
            'transaction_status' => 'settlement',
            'fraud_status' => 'accept',
        ];
        (new ProcessMidtransCallback($payload))->handle();

        $this->assertEquals(120000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $tx->id)->count());
    }

    public function test_amount_mismatch_no_credit(): void
    {
        $tx = $this->makeTopUp();
        (new ProcessMidtransCallback([
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '19999.00',
            'transaction_status' => 'settlement',
            'fraud_status' => 'accept',
        ]))->handle();

        $this->assertNotSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals(100000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $tx->id)->count());
    }

    public function test_midtrans_pending_no_credit(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::PENDING->value]);
        (new ProcessMidtransCallback([
            'order_id' => $tx->invoice_number,
            'status_code' => '201',
            'gross_amount' => '20000.00',
            'transaction_status' => 'pending',
        ]))->handle();

        $this->assertSame(TransactionStatus::PROCESSING->value, $tx->fresh()->status);
        $this->assertEquals(100000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $tx->id)->count());
    }

    public function test_failed_jobs_table_persists_row(): void
    {
        $this->assertTrue(Schema::hasTable('failed_jobs'));

        \Illuminate\Support\Facades\DB::table('failed_jobs')->insert([
            'uuid' => (string) Str::uuid(),
            'connection' => 'database',
            'queue' => 'default',
            'payload' => json_encode(['job' => 'ProcessMidtransCallback']),
            'exception' => 'Simulated failure for schema test',
            'failed_at' => now(),
        ]);

        $this->assertDatabaseCount('failed_jobs', 1);
    }

    public function test_customer_final_notification_dedupe_key(): void
    {
        $tx = $this->makeTopUp(['status' => TransactionStatus::PENDING->value]);
        $payload = [
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '20000.00',
            'transaction_status' => 'settlement',
            'fraud_status' => 'accept',
        ];
        (new ProcessMidtransCallback($payload))->handle();

        $listener = app(\App\Listeners\SendNotification::class);
        $listener->handle(new TransactionSuccess($tx->fresh()));
        $listener->handle(new TransactionSuccess($tx->fresh()));

        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:'.$tx->id)->count());
    }

    /**
     * P1: SQL eligibility before limit(100) — stuck settlement after 100 historical
     * settlement rows must still be a poll candidate.
     */
    public function test_poll_selects_stuck_settlement_beyond_first_100_historical_settlements(): void
    {
        // 100 historical MT settlement rows that are NOT eligible (local already success).
        for ($i = 0; $i < 100; $i++) {
            $this->makeTopUp(
                ['status' => TransactionStatus::SUCCESS->value, 'invoice_number' => 'TRX-TOPUP-HIST-'.$i],
                ['transaction_status' => 'settlement']
            );
        }

        // Already-mutated settlement — must stay excluded from candidates.
        $mutated = $this->makeTopUp(
            ['status' => TransactionStatus::PROCESSING->value, 'invoice_number' => 'TRX-TOPUP-MUTATED'],
            ['transaction_status' => 'settlement']
        );
        WalletMutation::create([
            'wallet_id' => $this->wallet->id,
            'type' => WalletMutation::TYPE_TOPUP,
            'amount' => 20000,
            'reference_id' => (string) $mutated->id,
        ]);

        // Pending Midtrans — must not enter the settlement/capture stuck path.
        // created_at=now() so open-status age cutoff also excludes it from this assertion.
        $pending = $this->makeTopUp(
            [
                'status' => TransactionStatus::PROCESSING->value,
                'invoice_number' => 'TRX-TOPUP-PENDING-MT',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'transaction_status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        // Eligible stuck settlement AFTER the 100 historical rows.
        $stuck = $this->makeTopUp(
            ['status' => TransactionStatus::PROCESSING->value, 'invoice_number' => 'TRX-TOPUP-STUCK-101'],
            ['transaction_status' => 'settlement']
        );

        $service = app(MidtransReconciliationService::class);
        $method = new \ReflectionMethod($service, 'midtransPollCandidates');
        $method->setAccessible(true);
        /** @var \Illuminate\Support\Collection<int, MidtransTransaction> $candidates */
        $candidates = $method->invoke($service, now()->subMinutes(5));

        $orderIds = $candidates->pluck('order_id')->all();

        $this->assertContains($stuck->invoice_number, $orderIds, 'Eligible stuck beyond 100 historical settlements must be selected');
        $this->assertNotContains($mutated->invoice_number, $orderIds, 'Settlement with existing topup mutation must be excluded');
        $this->assertNotContains($pending->invoice_number, $orderIds, 'Pending Midtrans must not be in settlement stuck candidates (and is younger than open cutoff)');
        $this->assertNotContains('TRX-TOPUP-HIST-0', $orderIds);
        $this->assertNotContains('TRX-TOPUP-HIST-99', $orderIds);

        $this->settlementHttp($stuck);
        $result = $service->pollPendingDeposits();
        $this->assertGreaterThanOrEqual(1, $result['polled']);
        $this->assertSame(TransactionStatus::SUCCESS->value, $stuck->fresh()->status);
        $this->assertSame(1, WalletMutation::where('type', WalletMutation::TYPE_TOPUP)->where('reference_id', (string) $stuck->id)->count());
    }
}
