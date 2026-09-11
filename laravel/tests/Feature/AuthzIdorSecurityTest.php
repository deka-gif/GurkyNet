<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\DivisionNotification;
use App\Models\LoyaltyPoint;
use App\Models\LoyaltyPointLedger;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Loyalty\LoyaltyPointService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * P1-E — BOLA/IDOR / function-level authorization regressions.
 */
class AuthzIdorSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_loyalty_redeem_same_key_does_not_leak_other_user_transaction(): void
    {
        $indexes = Schema::getIndexes('loyalty_point_ledgers');
        $names = collect($indexes)->pluck('name')->all();
        $this->assertContains('loyalty_ledger_user_idem_type_unique', $names);
        $this->assertNotContains('loyalty_ledger_idem_type_unique', $names);

        $userA = $this->makeCustomer('p1e-a', 50000);
        $userB = $this->makeCustomer('p1e-b', 50000);
        $this->seedPoints($userA, 500);
        $this->seedPoints($userB, 500);

        $key = 'shared-redeem-'.Str::uuid();
        $loyalty = app(LoyaltyPointService::class);

        $b = $loyalty->redeemPoints($userB, 100, $key);
        $this->assertFalse($b['already_processed']);
        $txB = (int) $b['transaction_id'];
        $this->assertGreaterThan(0, $txB);

        // Outer HTTP SoT is per-user; call service directly to prove ledger scoping.
        $a = $loyalty->redeemPoints($userA, 100, $key);
        $this->assertFalse($a['already_processed']);
        $this->assertNotSame($txB, (int) $a['transaction_id']);
        $this->assertSame($userA->id, (int) \App\Models\Transaction::findOrFail($a['transaction_id'])->user_id);

        $this->assertEquals(2, LoyaltyPointLedger::query()
            ->where('idempotency_key', $key)
            ->where('type', LoyaltyPointLedger::TYPE_REDEEM)
            ->count());
    }

    public function test_loyalty_adjust_same_key_is_scoped_to_target_user(): void
    {
        $finance = User::create([
            'name' => 'Finance P1E',
            'email' => 'finance-p1e@gurkynet.test',
            'phone_number' => '081211109001',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
        ]);
        $targetA = $this->makeCustomer('p1e-adj-a', 10000);
        $targetB = $this->makeCustomer('p1e-adj-b', 10000);
        $this->seedPoints($targetA, 0);
        $this->seedPoints($targetB, 0);

        $key = 'shared-adjust-'.Str::uuid();
        $loyalty = app(LoyaltyPointService::class);

        $r1 = $loyalty->adjustPoints($targetA, 50, 'credit', 'bonus A', $finance, $key);
        $this->assertTrue($r1['adjusted']);

        $r2 = $loyalty->adjustPoints($targetB, 50, 'credit', 'bonus B', $finance, $key);
        $this->assertTrue($r2['adjusted']);
        $this->assertFalse($r2['already_processed'] ?? false);

        $this->assertEquals(50, (int) LoyaltyPoint::query()->where('user_id', $targetA->id)->value('points_balance'));
        $this->assertEquals(50, (int) LoyaltyPoint::query()->where('user_id', $targetB->id)->value('points_balance'));
    }

    public function test_finance_cannot_mark_operations_division_notification_read(): void
    {
        $finance = User::create([
            'name' => 'Finance Notif',
            'email' => 'fin-notif-p1e@gurkynet.test',
            'phone_number' => '081211109002',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
        ]);

        $opsNotif = DivisionNotification::create([
            'role' => 'operations',
            'type' => 'workflow',
            'title' => 'Ops secret',
            'body' => 'Sensitive ops payload',
            'payload' => ['conversation_id' => 999],
        ]);

        Sanctum::actingAs($finance);
        $this->putJson('/api/v1/admin/escalations/notifications/'.$opsNotif->id.'/read')
            ->assertNotFound();

        $this->assertNull($opsNotif->fresh()->read_at);
    }

    public function test_finance_can_mark_own_division_notification_read(): void
    {
        $finance = User::create([
            'name' => 'Finance Own Notif',
            'email' => 'fin-own-notif-p1e@gurkynet.test',
            'phone_number' => '081211109003',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
        ]);

        $finNotif = DivisionNotification::create([
            'role' => 'finance',
            'type' => 'refund',
            'title' => 'Finance inbox',
            'body' => 'OK',
            'payload' => ['ticket_id' => 1],
        ]);

        Sanctum::actingAs($finance);
        $this->putJson('/api/v1/admin/escalations/notifications/'.$finNotif->id.'/read')
            ->assertOk();

        $this->assertNotNull($finNotif->fresh()->read_at);
    }

    public function test_owner_cannot_create_workflow(): void
    {
        $owner = User::create([
            'name' => 'Owner P1E',
            'email' => 'owner-p1e@gurkynet.test',
            'phone_number' => '081211109004',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
        ]);

        Sanctum::actingAs($owner);
        $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Owner create bypass',
            'targetDivision' => 'finance',
        ])->assertForbidden();
    }

    public function test_cs_can_still_create_workflow(): void
    {
        $cs = User::create([
            'name' => 'CS P1E',
            'email' => 'cs-p1e@gurkynet.test',
            'phone_number' => '081211109005',
            'password' => Hash::make('password123'),
            'role' => UserRole::CUSTOMER_SUPPORT,
        ]);

        Sanctum::actingAs($cs);
        $this->postJson('/api/v1/admin/workflows', [
            'title' => 'CS create OK',
            'targetDivision' => 'operations',
        ])->assertCreated();
    }

    public function test_customer_cannot_read_other_user_transaction(): void
    {
        $userA = $this->makeCustomer('p1e-tx-a', 50000);
        $userB = $this->makeCustomer('p1e-tx-b', 50000);

        $txB = \App\Models\Transaction::create([
            'user_id' => $userB->id,
            'invoice_number' => 'TRX-P1E-B-1',
            'service_name' => 'Pulsa',
            'target_number' => '081200000099',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'payment_method' => 'wallet',
            'status' => 'success',
        ]);

        Sanctum::actingAs($userA);
        $this->getJson('/api/v1/transactions/'.$txB->id)->assertNotFound();
        $this->getJson('/api/v1/transactions/'.$txB->invoice_number.'/receipt')->assertNotFound();
        $this->postJson('/api/v1/transactions/'.$txB->id.'/cancel', [
            'reason' => 'probe',
        ])->assertNotFound();
    }

    protected function makeCustomer(string $slug, float $balance): User
    {
        $user = User::create([
            'name' => 'User '.$slug,
            'email' => $slug.'@gurkynet.test',
            'phone_number' => '0812'.substr(md5($slug), 0, 8),
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => 'W-'.strtoupper($slug),
            'balance' => $balance,
            'status' => 'active',
        ]);

        return $user;
    }

    protected function seedPoints(User $user, int $points): void
    {
        LoyaltyPoint::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'points_balance' => $points,
                'points_held_clawback' => 0,
            ]
        );

        if ($points > 0) {
            LoyaltyPointLedger::query()->create([
                'user_id' => $user->id,
                'type' => LoyaltyPointLedger::TYPE_EARN,
                'points' => $points,
                'remaining_points' => $points,
                'status' => 'posted',
                'reference' => 'SEED-'.Str::upper(Str::random(6)),
                'reason' => 'test seed',
                'expires_at' => now()->addMonths(6),
            ]);
        }
    }
}
