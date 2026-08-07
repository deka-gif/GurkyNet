<?php

namespace Tests\Feature\Finance;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\FinanceAlert;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceSettlement;
use App\Models\ProductProvider;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Workflow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceCommandCenterTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(UserRole $role, string $prefix = 'u'): User
    {
        return User::create([
            'name' => $role->label(),
            'email' => $prefix.'-'.uniqid().'@gurkypay.com',
            'phone_number' => '081'.random_int(100000000, 999999999),
            'password' => Hash::make('password123'),
            'role' => $role,
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    public function test_refund_approve_writes_ledger_entry(): void
    {
        $user = $this->makeUser(UserRole::USER, 'cust');
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '10'.random_int(1000000000, 9999999999),
            'balance' => 50000,
            'status' => 'active',
        ]);
        $fin = $this->makeUser(UserRole::FINANCE, 'fin');

        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'INV/FCC/'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
            'notes' => 'refund',
        ]);

        Sanctum::actingAs($fin);
        $this->postJson("/api/v1/admin/finance/refunds/{$tx->id}/approve", [
            'notes' => 'OK',
        ])->assertOk();

        $this->assertNotNull($tx->fresh()->refunded_at);
        $this->assertTrue(
            FinanceLedgerEntry::query()
                ->where('transaction_id', $tx->id)
                ->whereIn('event_type', ['wallet_refund', 'refund_approve'])
                ->exists()
        );

        // Immutable — no update/delete routes
        $ledgerId = FinanceLedgerEntry::query()->where('transaction_id', $tx->id)->value('id');
        $this->patchJson("/api/v1/admin/finance/ledger/{$ledgerId}", ['credit' => 1])->assertStatus(405);
        $this->deleteJson("/api/v1/admin/finance/ledger/{$ledgerId}")->assertStatus(405);
    }

    public function test_settlement_lifecycle_writes_ledger_without_autopayout(): void
    {
        $fin = $this->makeUser(UserRole::FINANCE, 'fin2');
        Sanctum::actingAs($fin);

        $created = $this->postJson('/api/v1/admin/finance/settlements', [
            'gateway' => 'midtrans',
            'amount' => 250000,
            'notes' => 'Batch A',
        ])->assertCreated()->json('data');

        $this->assertNotEmpty($created['settlementCode']);
        $this->assertNotNull($created['workflowId']);
        $this->assertFalse($created['autoPayout']);
        $this->assertDatabaseHas('workflows', [
            'id' => $created['workflowId'],
            'category' => 'settlement_batch',
            'current_division' => 'finance',
        ]);

        $id = $created['id'];
        $this->patchJson("/api/v1/admin/finance/settlements/{$id}", [
            'status' => 'processing',
        ])->assertOk();

        $this->patchJson("/api/v1/admin/finance/settlements/{$id}", [
            'status' => 'completed',
            'notes' => 'Done',
        ])->assertOk();

        $this->assertSame('completed', FinanceSettlement::find($id)->status);
        $this->assertTrue(
            FinanceLedgerEntry::query()
                ->where('event_type', 'settlement')
                ->where('reference', $created['settlementCode'])
                ->exists()
        );
        $meta = FinanceLedgerEntry::query()->where('event_type', 'settlement')->latest('id')->first()->meta;
        $this->assertTrue(($meta['no_auto_payout'] ?? false) === true);
    }

    public function test_cs_cannot_patch_settlement_or_approve_via_finance_route(): void
    {
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs');
        $fin = $this->makeUser(UserRole::FINANCE, 'fin3');

        Sanctum::actingAs($fin);
        $id = $this->postJson('/api/v1/admin/finance/settlements', [
            'gateway' => 'midtrans',
            'amount' => 1000,
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($cs);
        $this->patchJson("/api/v1/admin/finance/settlements/{$id}", [
            'status' => 'completed',
        ])->assertStatus(403);

        $this->postJson('/api/v1/admin/finance/refunds/1/approve')->assertStatus(403);
    }

    public function test_command_center_returns_numeric_aggregates(): void
    {
        $fin = $this->makeUser(UserRole::FINANCE, 'fin4');
        Sanctum::actingAs($fin);

        $data = $this->getJson('/api/v1/admin/finance/command-center')->assertOk()->json('data');
        $this->assertIsNumeric($data['todaysRevenue']);
        $this->assertIsNumeric($data['todaysProfit']);
        $this->assertIsNumeric($data['pendingRefund']);
        $this->assertIsNumeric($data['pendingSettlement']);
        $this->assertArrayHasKey('financialAlerts', $data);
        $this->assertArrayHasKey('recentFinancialActivity', $data);
    }

    public function test_low_provider_balance_creates_alert(): void
    {
        $provider = ProductProvider::query()->where('code', 'digiflazz')->first()
            ?? ProductProvider::query()->create([
                'code' => 'digiflazz-test-'.uniqid(),
                'name' => 'Digiflazz Test',
                'is_active' => true,
                'partner_status' => 'online',
                'balance' => 1000,
                'sort_order' => 1,
                'priority' => 1,
            ]);
        $provider->forceFill(['balance' => 1000])->save();

        $fin = $this->makeUser(UserRole::FINANCE, 'fin5');
        Sanctum::actingAs($fin);

        $this->postJson('/api/v1/admin/finance/alerts/evaluate')->assertOk();

        $this->assertTrue(
            FinanceAlert::query()->where('type', 'low_provider_deposit')->where('status', 'open')->exists()
        );
    }

    public function test_structured_report_sections(): void
    {
        $fin = $this->makeUser(UserRole::FINANCE, 'fin6');
        Sanctum::actingAs($fin);

        $data = $this->getJson('/api/v1/admin/finance/reports/structured')->assertOk()->json('data');
        $this->assertArrayHasKey('incomeStatement', $data);
        $this->assertArrayHasKey('profitLoss', $data);
        $this->assertArrayHasKey('cashFlow', $data);
        $this->assertArrayHasKey('margin', $data);
        $this->assertIsNumeric($data['incomeStatement']['revenue']);
    }

    public function test_ledger_list_readable_and_immutable(): void
    {
        $fin = $this->makeUser(UserRole::FINANCE, 'fin7');
        Sanctum::actingAs($fin);

        app(\App\Services\Finance\FinanceLedgerService::class)->record([
            'source_module' => 'system',
            'event_type' => 'manual_adjustment',
            'debit' => 0,
            'credit' => 1000,
            'reference' => 'test',
        ], $fin);

        $list = $this->getJson('/api/v1/admin/finance/ledger')->assertOk()->json('data.data');
        $this->assertNotEmpty($list);
        $id = $list[0]['id'];
        $this->getJson("/api/v1/admin/finance/ledger/{$id}")->assertOk();
        $this->putJson("/api/v1/admin/finance/ledger/{$id}", [])->assertStatus(405);
    }
}
