<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\BankStatementLine;
use App\Models\GatewayReconciliationItem;
use App\Models\MidtransTransaction;
use App\Models\ProductProvider;
use App\Models\ReconciliationClosing;
use App\Models\ReconciliationIncident;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Models\WithdrawRequest;
use App\Services\Finance\Reconciliation\InternalWalletReconciliationService;
use App\Services\Finance\Reconciliation\MidtransReconciliationService;
use App\Services\Finance\Reconciliation\ProviderDailyReconciliationService;
use App\Services\Finance\Reconciliation\ReconciliationIncidentService;
use App\Services\MidtransService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

/**
 * Sprint 7 — SRS Bagian 18 / FR-FIN-07 zero-loss reconciliation.
 */
class Sprint7ReconciliationTest extends TestCase
{
    use RefreshDatabase;

    protected User $finance;
    protected User $owner;
    protected User $agent;
    protected User $marketing;
    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->finance = $this->makeUser('fin-s7@gurkynet.test', '081711100001', UserRole::FINANCE);
        $this->owner = $this->makeUser('own-s7@gurkynet.test', '081711100002', UserRole::OWNER);
        $this->agent = $this->makeUser('user-s7@gurkynet.test', '081711100003', UserRole::USER);
        $this->marketing = $this->makeUser('mkt-s7@gurkynet.test', '081711100004', UserRole::MARKETING);

        $this->wallet = Wallet::create([
            'user_id' => $this->agent->id,
            'wallet_number' => '104711100003',
            'balance' => 100000,
            'status' => 'active',
        ]);
    }

    private function makeUser(string $email, string $phone, UserRole $role): User
    {
        return User::create([
            'name' => $email,
            'email' => $email,
            'phone_number' => $phone,
            'password' => Hash::make('password123'),
            'role' => $role,
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    public function test_internal_match_creates_no_incident(): void
    {
        WalletMutation::create([
            'wallet_id' => $this->wallet->id,
            'type' => WalletMutation::TYPE_TOPUP,
            'amount' => 100000,
            'reference_id' => 'seed',
        ]);

        $result = app(InternalWalletReconciliationService::class)->run();
        $this->assertSame(0, $result['mismatches']);
        $this->assertEquals(0, ReconciliationIncident::query()->count());
    }

    public function test_internal_mismatch_creates_incident_alert_and_freeze(): void
    {
        // Balance 100000 but mutations sum 50000 → variance
        WalletMutation::create([
            'wallet_id' => $this->wallet->id,
            'type' => WalletMutation::TYPE_TOPUP,
            'amount' => 50000,
            'reference_id' => 'partial',
        ]);

        $result = app(InternalWalletReconciliationService::class)->run();
        $this->assertSame(1, $result['mismatches']);

        $incident = ReconciliationIncident::query()->first();
        $this->assertNotNull($incident);
        $this->assertSame(ReconciliationIncident::STATUS_OPEN, $incident->status);
        $this->assertTrue($incident->freeze_withdraw);
        $this->assertTrue($incident->restrict_purchase);
        $this->assertFalse($incident->system_wide_freeze);

        $this->assertTrue(app(ReconciliationIncidentService::class)->isWithdrawFrozen($this->agent->id));
        $this->assertTrue(app(ReconciliationIncidentService::class)->isPurchaseRestricted($this->agent->id));

        $this->assertDatabaseHas('finance_alerts', [
            'related_type' => 'reconciliation_incident',
            'related_id' => $incident->id,
        ]);

        // Rerun must not duplicate open incident
        app(InternalWalletReconciliationService::class)->run();
        $this->assertEquals(1, ReconciliationIncident::query()->where('status', 'open')->count());
    }

    public function test_withdraw_blocked_while_frozen_and_unfreeze_on_resolve(): void
    {
        WalletMutation::create([
            'wallet_id' => $this->wallet->id,
            'type' => WalletMutation::TYPE_TOPUP,
            'amount' => 50000,
            'reference_id' => 'partial',
        ]);
        app(InternalWalletReconciliationService::class)->run();
        $incident = ReconciliationIncident::query()->first();

        // Existing pending withdraw must not be destroyed
        $tx = Transaction::create([
            'user_id' => $this->agent->id,
            'invoice_number' => 'TRX-WD-EXIST',
            'service_name' => 'Penarikan Dana',
            'target_number' => 'BCA:123',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => TransactionStatus::LOCKED->value,
        ]);
        $existingWd = WithdrawRequest::create([
            'user_id' => $this->agent->id,
            'amount' => 10000,
            'admin_fee' => 0,
            'method' => 'bank_transfer',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'status' => 'pending',
            'transaction_id' => $tx->id,
            'workflow' => WithdrawRequest::WORKFLOW_HOLD_QUEUE,
        ]);

        Sanctum::actingAs($this->agent);
        $this->postJson('/api/v1/wallet/withdraw', [
            'amount' => 10000,
            'pin' => '123456',
            'bank_name' => 'BCA',
            'account_number' => '999',
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
        ])->assertStatus(422);

        $this->assertDatabaseHas('withdraw_requests', ['id' => $existingWd->id, 'status' => 'pending']);

        Sanctum::actingAs($this->finance);
        $this->postJson("/api/v1/admin/finance/reconciliation/incidents/{$incident->id}/resolve", [
            'notes' => 'Ledger fixed',
        ])->assertOk();

        $incident->refresh();
        $this->assertSame(ReconciliationIncident::STATUS_RESOLVED, $incident->status);
        $this->assertFalse(app(ReconciliationIncidentService::class)->isWithdrawFrozen($this->agent->id));
    }

    public function test_provider_variance_over_threshold_creates_system_freeze(): void
    {
        ProductProvider::query()->updateOrCreate(
            ['code' => ProductProvider::CODE_DIGIFLAZZ],
            ['name' => 'Digiflazz', 'balance' => 500000, 'is_active' => true]
        );
        ProductProvider::query()->updateOrCreate(
            ['code' => ProductProvider::CODE_VIP],
            ['name' => 'VIP', 'balance' => 1000, 'is_active' => true]
        );

        // Force threshold low via config
        config(['finance.recon_threshold_amount' => 50000]);

        // Mock artisan sync to no-op by not calling real providers — sync may fail silently
        $result = app(ProviderDailyReconciliationService::class)->run();
        $this->assertGreaterThanOrEqual(1, $result['items']);

        // Digi: balance 500000 vs success 0 → variance 500000 > 50k
        $this->assertTrue(
            ReconciliationIncident::query()
                ->where('type', ReconciliationIncident::TYPE_PROVIDER_H2H)
                ->where('source', ProductProvider::CODE_DIGIFLAZZ)
                ->where('status', 'open')
                ->exists()
        );

        $this->assertTrue(app(ReconciliationIncidentService::class)->isWithdrawFrozen($this->agent->id));
        $this->assertFalse(app(ReconciliationIncidentService::class)->isPurchaseRestricted($this->agent->id));
    }

    public function test_provider_within_threshold_no_critical_incident(): void
    {
        config(['finance.recon_threshold_amount' => 50000]);
        ProductProvider::query()->delete();
        ProductProvider::query()->create([
            'code' => ProductProvider::CODE_DIGIFLAZZ,
            'name' => 'Digiflazz',
            'balance' => 0,
            'is_active' => true,
        ]);
        ProductProvider::query()->create([
            'code' => ProductProvider::CODE_VIP,
            'name' => 'VIP',
            'balance' => 0,
            'is_active' => true,
        ]);

        app(ProviderDailyReconciliationService::class)->run();
        $this->assertEquals(
            0,
            ReconciliationIncident::query()->where('type', ReconciliationIncident::TYPE_PROVIDER_H2H)->count()
        );
    }

    public function test_midtrans_settlement_mismatch_incident(): void
    {
        config(['finance.recon_threshold_amount' => 1000]);
        $tx = Transaction::create([
            'user_id' => $this->agent->id,
            'invoice_number' => 'ORD-S7-1',
            'service_name' => 'Top Up',
            'target_number' => '0817',
            'amount' => 50000,
            'admin_fee' => 0,
            'total_payment' => 50000,
            'status' => TransactionStatus::PENDING->value,
        ]);
        MidtransTransaction::create([
            'transaction_id' => $tx->id,
            'order_id' => 'ORD-S7-1',
            'gross_amount' => 50000,
            'transaction_status' => 'settlement',
        ]);
        // No TOPUP mutation → mismatch

        $result = app(MidtransReconciliationService::class)->runDailySettlement();
        $this->assertNotEmpty($result['incidents']);
        $this->assertDatabaseHas('gateway_reconciliation_items', [
            'source' => 'midtrans',
            'external_reference' => 'ORD-S7-1',
        ]);
    }

    public function test_midtrans_pending_poll_dispatches_once_idempotent(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->agent->id,
            'invoice_number' => 'ORD-S7-PEND',
            'service_name' => 'Top Up',
            'target_number' => '0817',
            'amount' => 25000,
            'admin_fee' => 0,
            'total_payment' => 25000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::PENDING->value,
        ]);
        MidtransTransaction::create([
            'transaction_id' => $tx->id,
            'order_id' => 'ORD-S7-PEND',
            'gross_amount' => 25000,
            'transaction_status' => 'pending',
        ]);
        MidtransTransaction::query()->where('order_id', 'ORD-S7-PEND')->update([
            'created_at' => now()->subMinutes(10),
            'updated_at' => now()->subMinutes(10),
        ]);

        $mock = Mockery::mock(MidtransService::class);
        $mock->shouldReceive('isConfigured')->andReturn(true);
        $mock->shouldReceive('checkStatus')->atLeast()->once()->andReturn([
            'order_id' => 'ORD-S7-PEND',
            'transaction_status' => 'settlement',
            'gross_amount' => 25000,
            'payment_type' => 'bank_transfer',
            'status_code' => '200',
            'signature_key' => 'x',
        ]);
        $this->app->instance(MidtransService::class, $mock);

        $before = (float) $this->wallet->fresh()->balance;
        app(MidtransReconciliationService::class)->pollPendingDeposits();
        // Second run must not double-credit (row now settlement / already success).
        app(MidtransReconciliationService::class)->pollPendingDeposits();

        $after = (float) $this->wallet->fresh()->balance;
        $this->assertEquals($before + 25000, $after);
        $this->assertEquals(
            1,
            WalletMutation::query()->where('wallet_id', $this->wallet->id)->where('type', 'topup')->count()
        );
    }

    public function test_daily_closing_snapshot_and_access(): void
    {
        config(['finance.recon_threshold_amount' => 999999999]);
        ProductProvider::query()->updateOrCreate(
            ['code' => ProductProvider::CODE_DIGIFLAZZ],
            ['name' => 'Digiflazz', 'balance' => 0, 'is_active' => true]
        );
        ProductProvider::query()->updateOrCreate(
            ['code' => ProductProvider::CODE_VIP],
            ['name' => 'VIP', 'balance' => 0, 'is_active' => true]
        );

        Sanctum::actingAs($this->finance);
        $this->postJson('/api/v1/admin/finance/reconciliation/run', ['mode' => 'closing'])->assertOk();
        $this->assertTrue(
            ReconciliationClosing::query()->whereDate('closing_date', now()->toDateString())->exists()
        );

        Sanctum::actingAs($this->finance);
        $this->getJson('/api/v1/admin/finance/reconciliation/closings')->assertOk();

        Sanctum::actingAs($this->owner);
        $this->getJson('/api/v1/admin/finance/reconciliation/closings')->assertOk();
    }

    public function test_fr_fin_07_match_discrepancy_and_rbac(): void
    {
        Sanctum::actingAs($this->finance);
        $csv = "date,amount,reference,description\n2026-08-27,75000,REF-BANK-1,Transfer\n";
        $file = UploadedFile::fake()->createWithContent('bank.csv', $csv);
        $this->post('/api/v1/admin/finance/reconciliation/bank-import', [
            'file' => $file,
        ], ['Accept' => 'application/json'])->assertCreated();

        $line = BankStatementLine::query()->first();
        $this->assertNotNull($line);

        $this->postJson("/api/v1/admin/finance/reconciliation/bank-lines/{$line->id}/match", [
            'internal_amount' => 75000,
            'evidence' => 'matched to midtrans ORD-X',
        ])->assertOk();
        $this->assertSame('matched', $line->fresh()->match_status);

        $line2 = BankStatementLine::create([
            'bank_statement_import_id' => $line->bank_statement_import_id,
            'amount' => 90000,
            'external_reference' => 'REF-BANK-2',
            'match_status' => 'unmatched',
        ]);
        config(['finance.recon_threshold_amount' => 1000]);
        $this->postJson("/api/v1/admin/finance/reconciliation/bank-lines/{$line2->id}/discrepancy", [
            'internal_amount' => 0,
            'evidence' => 'no match',
        ])->assertOk();
        $this->assertSame('discrepancy', $line2->fresh()->match_status);

        // Gateway match
        $item = GatewayReconciliationItem::create([
            'recon_date' => now()->toDateString(),
            'source' => 'midtrans',
            'external_reference' => 'G-1',
            'external_amount' => 10000,
            'internal_amount' => 10000,
            'variance' => 0,
            'match_status' => 'unmatched',
        ]);
        $this->postJson("/api/v1/admin/finance/reconciliation/gateway/{$item->id}/match", [
            'evidence' => 'ok',
        ])->assertOk();

        Sanctum::actingAs($this->marketing);
        $this->getJson('/api/v1/admin/finance/reconciliation/incidents')->assertStatus(403);
    }

    public function test_hanging_schedule_still_every_minute(): void
    {
        $events = collect(\Illuminate\Support\Facades\Schedule::events());
        $hit = $events->first(fn ($e) => str_contains($e->command ?? $e->description ?? '', 'transactions:reconcile-pending'));
        $this->assertNotNull($hit);
        $this->assertSame('* * * * *', $hit->expression);
    }
}
