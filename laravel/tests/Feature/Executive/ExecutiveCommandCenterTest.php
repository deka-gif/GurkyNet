<?php

namespace Tests\Feature\Executive;

use App\Enums\UserRole;
use App\Models\ProductProvider;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Workflow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExecutiveCommandCenterTest extends TestCase
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

    public function test_command_center_returns_health_treasury_insights_from_db(): void
    {
        $owner = $this->makeUser(UserRole::OWNER, 'own');
        $user = $this->makeUser(UserRole::USER, 'cust');
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '10'.random_int(1000000000, 9999999999),
            'balance' => 250000,
            'status' => 'active',
        ]);
        Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'INV/EXEC/'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 20000,
            'admin_fee' => 0,
            'total_payment' => 20000,
            'payment_method' => 'wallet',
            'status' => 'success',
        ]);
        ProductProvider::query()->create([
            'code' => 'exec-digi-'.uniqid(),
            'name' => 'Exec Digi',
            'is_active' => true,
            'partner_status' => 'online',
            'balance' => 7_500_000,
            'sort_order' => 1,
            'priority' => 1,
        ]);

        Sanctum::actingAs($owner);
        $data = $this->getJson('/api/v1/admin/executive/command-center')->assertOk()->json('data');

        $this->assertArrayHasKey('businessHealth', $data);
        $this->assertIsNumeric($data['businessHealth']['overall'] ?? null);
        $this->assertArrayHasKey('indicators', $data['businessHealth']);
        $this->assertFalse($data['businessHealth']['indicators']['customerSatisfaction']['available'] ?? true);

        $this->assertArrayHasKey('treasury', $data);
        $this->assertIsNumeric($data['treasury']['walletLiability'] ?? null);
        $this->assertFalse($data['treasury']['reserveFundAvailable'] ?? true);

        $this->assertArrayHasKey('profit', $data);
        $this->assertIsNumeric($data['profit']['grossRevenue'] ?? null);
        $this->assertNull($data['profit']['ebitda']);

        $this->assertArrayHasKey('headline', $data);
        $this->assertArrayHasKey('crossDivision', $data);
        $this->assertArrayHasKey('insights', $data);
        $this->assertIsArray($data['insights']);
        $this->assertArrayHasKey('goals', $data);
        $this->assertArrayHasKey('workflowMonitor', $data);
        $this->assertArrayHasKey('alerts', $data);
        $this->assertArrayHasKey('risks', $data);

        // Legacy keys still present
        $this->assertArrayHasKey('today_revenue', $data);
        $this->assertArrayHasKey('wallet_balance', $data);
    }

    public function test_goal_progress_uses_settings_target_when_present(): void
    {
        if (! Schema::hasTable('settings')) {
            $this->markTestSkipped('settings table missing');
        }

        Setting::query()->updateOrCreate(
            ['key' => 'executive_goal_revenue_monthly'],
            ['value' => '100000']
        );

        $owner = $this->makeUser(UserRole::OWNER, 'own2');
        $user = $this->makeUser(UserRole::USER, 'cust2');
        Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'INV/GOAL/'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567891',
            'amount' => 50000,
            'admin_fee' => 0,
            'total_payment' => 50000,
            'status' => 'success',
        ]);

        Sanctum::actingAs($owner);
        $goals = $this->getJson('/api/v1/admin/executive/goals')->assertOk()->json('data');
        $this->assertTrue($goals['revenue']['targetAvailable'] ?? false);
        $this->assertSame(100000.0, (float) ($goals['revenue']['target'] ?? 0));
        $this->assertNotNull($goals['revenue']['progress'] ?? null);
    }

    public function test_owner_approval_does_not_refund_and_ops_cannot_access_executive(): void
    {
        $owner = $this->makeUser(UserRole::OWNER, 'own3');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops');
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs');
        $user = $this->makeUser(UserRole::USER, 'cust3');

        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '10'.random_int(1000000000, 9999999999),
            'balance' => 100000,
            'status' => 'active',
        ]);

        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'INV/APPR/'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081200000001',
            'amount' => 2_000_000,
            'admin_fee' => 0,
            'total_payment' => 2_000_000,
            'status' => 'failed',
        ]);

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Large refund needs owner',
            'targetDivision' => 'finance',
            'transactionId' => $tx->id,
            'type' => 'refund_request',
            'category' => 'refund_request',
            'priority' => 'critical',
        ])->assertCreated()->json('data.id');

        Workflow::query()->whereKey($wfId)->update([
            'current_division' => 'admin',
            'status' => 'waiting_cs',
            'meta' => ['requires_owner_approval' => true, 'owner_approval_return_division' => 'finance'],
        ]);

        Sanctum::actingAs($ops);
        $this->getJson('/api/v1/admin/executive/command-center')->assertStatus(403);
        $this->postJson("/api/v1/admin/executive/approvals/{$wfId}/decide", [
            'decision' => 'approve',
        ])->assertStatus(403);

        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/admin/executive/approvals/{$wfId}/decide", [
            'decision' => 'approve',
            'note' => 'OK strategic',
        ])->assertOk();

        $wf = Workflow::find($wfId);
        $this->assertSame('finance', $wf->current_division);
        $this->assertSame('approve', $wf->meta['owner_approval']['decision'] ?? null);
        // Owner does not execute refund
        $this->assertNull($tx->fresh()->refunded_at);
        $this->assertSame(100000.0, (float) Wallet::query()->where('user_id', $user->id)->value('balance'));
    }

    public function test_infra_os_metrics_remain_na_in_risks_or_health(): void
    {
        $owner = $this->makeUser(UserRole::OWNER, 'own4');
        Sanctum::actingAs($owner);

        $data = $this->getJson('/api/v1/admin/executive/command-center')->assertOk()->json('data');
        $csat = $data['businessHealth']['indicators']['customerSatisfaction'] ?? [];
        $this->assertFalse($csat['available'] ?? true);

        $diskRisk = collect($data['risks'] ?? [])->firstWhere('code', 'disk_metric_na');
        $this->assertNotNull($diskRisk);
        $this->assertStringContainsString('Metric Not Available', $diskRisk['detail'] ?? '');
    }
}
