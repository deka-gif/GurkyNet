<?php

namespace Tests\Feature\Finance;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\FinanceAlert;
use App\Models\RevenueAllocationCategory;
use App\Models\RevenueAllocationEntry;
use App\Models\RevenueAllocationRuleSet;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Finance\RevenueAllocationService;
use App\Services\Transactions\TransactionSuccessTransitionService;
use App\Services\WalletRefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FR-FIN-10 — revenue allocation (admin_fee + margin → kategori %).
 */
class RevenueAllocationTest extends TestCase
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

    protected function seedDefaultRules(): void
    {
        // Migration 2026_09_16_100000 seeds categories + initial current rule set.
        $this->assertTrue(
            RevenueAllocationRuleSet::query()->where('is_current', true)->exists(),
            'Default rule set should be seeded by migration'
        );
    }

    protected function makeTx(User $user, float $adminFee, float $margin, string $status = 'pending'): Transaction
    {
        $sell = 10000 + $adminFee + $margin;
        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'GRK-RA-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => $sell - $adminFee,
            'admin_fee' => $adminFee,
            'total_payment' => $sell,
            'payment_method' => 'wallet',
            'status' => $status === 'pending'
                ? TransactionStatus::PENDING_SUPPLIER->value
                : $status,
            'timeout_at' => now()->addMinutes(10),
        ]);

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => 'TEST.PULSA',
            'product_name' => 'Test Pulsa',
            'price' => $sell - $adminFee,
            'quantity' => 1,
            'custom_metadata' => [
                'base_price' => 10000,
                'margin' => $margin,
                'admin_fee' => $adminFee,
            ],
        ]);

        return $tx->fresh(['items']);
    }

    public function test_1_reject_rules_when_total_not_100(): void
    {
        $this->seedDefaultRules();
        $fin = $this->makeUser(UserRole::FINANCE, 'fin1');
        Sanctum::actingAs($fin);

        $cats = RevenueAllocationCategory::query()->where('is_active', true)->orderBy('sort_order')->get();
        $lines = $cats->map(fn ($c, $i) => [
            'category_id' => $c->id,
            'percentage' => $i === 0 ? 50 : 0,
        ])->all();

        $this->putJson('/api/v1/admin/finance/revenue-allocation/rules', [
            'reason' => 'bad total',
            'lines' => $lines,
        ])->assertStatus(422);
    }

    public function test_2_save_rules_when_total_100_versions_old_set(): void
    {
        $this->seedDefaultRules();
        $fin = $this->makeUser(UserRole::FINANCE, 'fin2');
        Sanctum::actingAs($fin);

        $oldId = RevenueAllocationRuleSet::query()->where('is_current', true)->value('id');
        $cats = RevenueAllocationCategory::query()->where('is_active', true)->orderBy('sort_order')->get();
        $lines = $cats->values()->map(function ($c, $i) use ($cats) {
            // Keep default-ish but bump first category: redistribute evenly to 100
            $n = $cats->count();
            $base = intdiv(10000, $n) / 100; // e.g. 14.28 for 7
            return [
                'category_id' => $c->id,
                'percentage' => $i === $n - 1
                    ? round(100 - ($base * ($n - 1)), 4)
                    : $base,
            ];
        })->all();

        $sum = collect($lines)->sum('percentage');
        $this->assertTrue(abs($sum - 100) <= 0.01, 'test fixture sum='.$sum);

        $this->putJson('/api/v1/admin/finance/revenue-allocation/rules', [
            'reason' => 'rebalance Q3',
            'lines' => $lines,
        ])->assertOk();

        $this->assertFalse((bool) RevenueAllocationRuleSet::query()->find($oldId)?->is_current);
        $this->assertTrue(RevenueAllocationRuleSet::query()->where('is_current', true)->where('id', '!=', $oldId)->exists());
        $this->assertDatabaseHas('revenue_allocation_rule_sets', [
            'id' => $oldId,
            'is_current' => false,
        ]);
    }

    public function test_3_owner_cannot_write_rules(): void
    {
        $this->seedDefaultRules();
        $owner = $this->makeUser(UserRole::OWNER, 'own');
        Sanctum::actingAs($owner);

        $cats = RevenueAllocationCategory::query()->where('is_active', true)->get();
        $lines = $cats->map(fn ($c) => [
            'category_id' => $c->id,
            'percentage' => round(100 / max(1, $cats->count()), 4),
        ])->all();
        // Fix rounding to ~100
        $diff = 100 - collect($lines)->sum('percentage');
        $lines[0]['percentage'] = round($lines[0]['percentage'] + $diff, 4);

        $res = $this->putJson('/api/v1/admin/finance/revenue-allocation/rules', [
            'reason' => 'owner attempt',
            'lines' => $lines,
        ]);
        $res->assertStatus(403);
    }

    public function test_4_and_5_new_success_uses_new_percent_old_entry_keeps_snapshot(): void
    {
        $this->seedDefaultRules();
        $user = $this->makeUser(UserRole::USER, 'cust');
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '10'.random_int(1000000000, 9999999999),
            'balance' => 500000,
            'status' => 'active',
        ]);
        $fin = $this->makeUser(UserRole::FINANCE, 'fin45');

        $txOld = $this->makeTx($user, 0, 1500);
        app(TransactionSuccessTransitionService::class)->apply($txOld->id, [
            'source' => 'test',
            'provider_code' => 'digiflazz',
            'sn' => 'SN-OLD',
        ]);
        $entryOld = RevenueAllocationEntry::query()->where('transaction_id', $txOld->id)->first();
        $this->assertNotNull($entryOld);
        $this->assertSame(RevenueAllocationEntry::STATUS_POSTED, $entryOld->status);
        $oldRuleSetId = $entryOld->rule_set_id;
        $oldPctMap = $entryOld->lines()->pluck('percentage_snapshot', 'category_id')->map(fn ($v) => (float) $v)->all();

        Sanctum::actingAs($fin);
        $cats = RevenueAllocationCategory::query()->where('is_active', true)->orderBy('id')->get();
        // New rule: 100% to first category
        $lines = $cats->map(fn ($c, $i) => [
            'category_id' => $c->id,
            'percentage' => $i === 0 ? 100 : 0,
        ])->all();
        $this->putJson('/api/v1/admin/finance/revenue-allocation/rules', [
            'reason' => 'all to first',
            'lines' => $lines,
        ])->assertOk();

        $newRuleSetId = RevenueAllocationRuleSet::query()->where('is_current', true)->value('id');
        $this->assertNotEquals($oldRuleSetId, $newRuleSetId);

        $txNew = $this->makeTx($user, 0, 2000);
        app(TransactionSuccessTransitionService::class)->apply($txNew->id, [
            'source' => 'test',
            'provider_code' => 'digiflazz',
            'sn' => 'SN-NEW',
        ]);
        $entryNew = RevenueAllocationEntry::query()->where('transaction_id', $txNew->id)->with('lines')->first();
        $this->assertSame($newRuleSetId, $entryNew->rule_set_id);
        $this->assertEquals(2000.0, (float) $entryNew->gross_allocable);
        $firstCat = $cats->first()->id;
        $this->assertEquals(100.0, (float) $entryNew->lines->firstWhere('category_id', $firstCat)->percentage_snapshot);
        $this->assertEquals(2000.0, (float) $entryNew->lines->firstWhere('category_id', $firstCat)->amount);

        // Old entry unchanged snapshot
        $entryOld->refresh()->load('lines');
        $this->assertSame($oldRuleSetId, $entryOld->rule_set_id);
        foreach ($entryOld->lines as $line) {
            $this->assertEquals(
                $oldPctMap[$line->category_id],
                (float) $line->percentage_snapshot
            );
        }
    }

    public function test_6_refund_reverses_allocation_excluded_from_accumulation(): void
    {
        $this->seedDefaultRules();
        $user = $this->makeUser(UserRole::USER, 'cust6');
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '10'.random_int(1000000000, 9999999999),
            'balance' => 500000,
            'status' => 'active',
        ]);

        $tx = $this->makeTx($user, 500, 1500);
        app(TransactionSuccessTransitionService::class)->apply($tx->id, [
            'source' => 'test',
            'sn' => 'SN-REF',
        ]);
        $entry = RevenueAllocationEntry::query()->where('transaction_id', $tx->id)->first();
        $this->assertSame(RevenueAllocationEntry::STATUS_POSTED, $entry->status);
        $this->assertEquals(2000.0, (float) $entry->gross_allocable);

        app(WalletRefundService::class)->refundSuccessToRefunded($tx->fresh(), 'refund test', 'test');
        $entry->refresh();
        $this->assertSame(RevenueAllocationEntry::STATUS_REVERSED, $entry->status);

        $acc = app(RevenueAllocationService::class)->accumulation(
            now()->subDay()->toDateString(),
            now()->addDay()->toDateString()
        );
        $this->assertEquals(0.0, (float) $acc['gross']);
    }

    public function test_7_success_without_rule_set_skips_and_alerts(): void
    {
        $this->seedDefaultRules();
        // Remove all current rule sets to simulate go-live without config.
        RevenueAllocationRuleSet::query()->update(['is_current' => false]);

        $user = $this->makeUser(UserRole::USER, 'cust7');
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '10'.random_int(1000000000, 9999999999),
            'balance' => 500000,
            'status' => 'active',
        ]);

        $tx = $this->makeTx($user, 0, 1500);
        $result = app(TransactionSuccessTransitionService::class)->apply($tx->id, [
            'source' => 'test',
            'sn' => 'SN-SKIP',
        ]);
        $this->assertSame(TransactionSuccessTransitionService::OUTCOME_APPLIED, $result['outcome']);
        $this->assertTrue(TransactionStatus::tryFrom((string) $tx->fresh()->status) === TransactionStatus::SUCCESS
            || strtolower((string) $tx->fresh()->status) === 'success');

        $entry = RevenueAllocationEntry::query()->where('transaction_id', $tx->id)->first();
        $this->assertNotNull($entry);
        $this->assertSame(RevenueAllocationEntry::STATUS_SKIPPED, $entry->status);
        $this->assertSame('no_current_rule_set', $entry->skip_reason);

        $this->assertTrue(
            FinanceAlert::query()
                ->where('type', 'revenue_allocation_rules_missing')
                ->where('status', 'open')
                ->exists()
        );
    }

    public function test_allocate_idempotent_on_double_success(): void
    {
        $this->seedDefaultRules();
        $user = $this->makeUser(UserRole::USER, 'cust8');
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '10'.random_int(1000000000, 9999999999),
            'balance' => 500000,
            'status' => 'active',
        ]);
        $tx = $this->makeTx($user, 0, 1000);
        $svc = app(TransactionSuccessTransitionService::class);
        $svc->apply($tx->id, ['source' => 'test', 'sn' => 'A']);
        $svc->apply($tx->id, ['source' => 'test', 'sn' => 'A']);
        $this->assertEquals(1, RevenueAllocationEntry::query()->where('transaction_id', $tx->id)->count());
    }

    public function test_owner_can_view_overview(): void
    {
        $this->seedDefaultRules();
        $owner = $this->makeUser(UserRole::OWNER, 'ownv');
        Sanctum::actingAs($owner);
        $this->getJson('/api/v1/admin/finance/revenue-allocation')->assertOk();
        $this->getJson('/api/v1/admin/finance/revenue-allocation/accumulation')->assertOk();
        $this->getJson('/api/v1/admin/finance/revenue-allocation/history')->assertOk();
    }

    /** Bug: inactive category still listed in current rule lines must fail with named message. */
    public function test_save_rejects_inactive_category_with_named_error(): void
    {
        $this->seedDefaultRules();
        $fin = $this->makeUser(UserRole::FINANCE, 'fin-inactive');
        Sanctum::actingAs($fin);

        $cats = RevenueAllocationCategory::query()->where('is_active', true)->orderBy('sort_order')->get();
        $this->assertGreaterThanOrEqual(2, $cats->count());
        $victim = $cats->first();
        $victim->update(['is_active' => false]);

        $active = RevenueAllocationCategory::query()->where('is_active', true)->orderBy('sort_order')->get();
        $lines = $active->values()->map(function ($c, $i) use ($active) {
            $n = $active->count();
            $base = intdiv(10000, $n) / 100;

            return [
                'category_id' => $c->id,
                'percentage' => $i === $n - 1
                    ? round(100 - ($base * ($n - 1)), 4)
                    : $base,
            ];
        })->all();
        // Re-inject inactive category (simulates FE sending stale current rule lines).
        $lines[] = ['category_id' => $victim->id, 'percentage' => 0];
        $lines[0]['percentage'] = round((float) $lines[0]['percentage'], 4);

        $res = $this->putJson('/api/v1/admin/finance/revenue-allocation/rules', [
            'reason' => 'should fail on inactive',
            'lines' => $lines,
        ]);
        $res->assertStatus(422);
        $body = $res->json();
        $flat = collect($body['errors'] ?? [])->flatten()->implode(' ');
        $this->assertStringContainsString($victim->code, $flat);
        $this->assertStringContainsString('tidak aktif', $flat);
        $this->assertStringNotContainsString('Kategori tidak aktif atau tidak ditemukan.', $flat);
    }

    public function test_overview_marks_inactive_category_on_current_lines(): void
    {
        $this->seedDefaultRules();
        $fin = $this->makeUser(UserRole::FINANCE, 'fin-overview-flag');
        Sanctum::actingAs($fin);

        $victim = RevenueAllocationCategory::query()->where('is_active', true)->orderBy('sort_order')->first();
        $this->assertNotNull($victim);
        $victim->update(['is_active' => false]);

        $res = $this->getJson('/api/v1/admin/finance/revenue-allocation')->assertOk();
        $lines = collect($res->json('data.current.lines') ?? []);
        $hit = $lines->firstWhere('categoryId', $victim->id);
        $this->assertNotNull($hit);
        $this->assertFalse((bool) $hit['categoryIsActive']);
        $this->assertFalse(
            collect($res->json('data.categories') ?? [])->contains(fn ($c) => (int) $c['id'] === (int) $victim->id)
        );
    }
}
