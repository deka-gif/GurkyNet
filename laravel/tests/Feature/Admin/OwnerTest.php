<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\ActivityLog;
use App\Models\Provider;
use App\Models\BannerPromotion;
use App\Models\SupportTicket;
use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OwnerTest extends TestCase
{
    use RefreshDatabase;

    protected User $ownerUser;
    protected User $superAdminUser;
    protected User $regularUser;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Owner User
        $this->ownerUser = User::create([
            'name' => 'Owner Executive',
            'email' => 'owner@gurkypay.com',
            'phone_number' => '081222222227',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 2. Super Admin User
        $this->superAdminUser = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@gurkypay.com',
            'phone_number' => '081333333333',
            'password' => Hash::make('password123'),
            'role' => UserRole::SUPER_ADMIN,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 3. Regular User
        $this->regularUser = User::create([
            'name' => 'Budi Customer',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081555555555',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // Create Wallet for Budi
        Wallet::create([
            'user_id' => $this->regularUser->id,
            'wallet_number' => 'W10001',
            'balance' => 150000.00,
            'status' => 'active',
        ]);
    }

    public function test_unauthorized_user_cannot_access_executive_endpoints(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->getJson('/api/v1/admin/executive/dashboard');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_owner_can_access_dashboard(): void
    {
        Sanctum::actingAs($this->ownerUser);

        // Seed a transaction
        Transaction::create([
            'user_id' => $this->regularUser->id,
            'invoice_number' => 'INV-TEST-01',
            'service_name' => 'Pulsa',
            'target_number' => '081555555555',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => 'success',
        ]);

        $response = $this->getJson('/api/v1/admin/executive/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'today_revenue',
                    'monthly_revenue',
                    'total_users',
                    'active_users',
                    'total_transactions',
                    'success_rate',
                    'failed_rate',
                    'wallet_balance',
                    'provider_health',
                    'queue_status',
                    'system_health',
                ],
            ]);
    }

    public function test_owner_can_access_financial_overview(): void
    {
        Sanctum::actingAs($this->ownerUser);

        $response = $this->getJson('/api/v1/admin/executive/financial-overview');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'revenue_trend',
                    'transaction_trend',
                    'refund_trend',
                    'settlement_trend',
                ],
            ]);
    }

    public function test_owner_can_access_department_overview(): void
    {
        Sanctum::actingAs($this->ownerUser);

        $response = $this->getJson('/api/v1/admin/executive/department-overview');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'finance_kpi',
                    'operations_kpi',
                    'marketing_kpi',
                    'customer_support_kpi',
                ],
            ]);
    }

    public function test_owner_can_access_system_health(): void
    {
        Sanctum::actingAs($this->ownerUser);

        $response = $this->getJson('/api/v1/admin/executive/system-health');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'application_status',
                    'database_status',
                    'redis_status',
                    'queue_status',
                    'digiflazz_status',
                    'midtrans_status',
                    'storage_status',
                ],
            ]);
    }

    public function test_owner_can_list_audit_logs_with_filters(): void
    {
        Sanctum::actingAs($this->ownerUser);

        // Seed activity logs
        ActivityLog::create([
            'user_id' => $this->ownerUser->id,
            'activity' => 'OWNER_VIEW_DASHBOARD',
            'payload' => ['ip' => '127.0.0.1'],
        ]);

        $response = $this->getJson('/api/v1/admin/executive/audit-logs?search=VIEW');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'activity',
                        'payload',
                        'user' => [
                            'id',
                            'name',
                            'email',
                            'role',
                        ],
                        'created_at',
                    ]
                ],
                'meta' => [
                    'current_page',
                    'last_page',
                    'per_page',
                    'total',
                ]
            ]);
    }

    public function test_owner_can_access_activity_timeline(): void
    {
        Sanctum::actingAs($this->ownerUser);

        $response = $this->getJson('/api/v1/admin/executive/activity-timeline');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'recent_activities',
                    'system_events',
                    'admin_activities',
                    'gateway_events',
                ],
            ]);
    }

    public function test_super_admin_can_access_executive_dashboard(): void
    {
        Sanctum::actingAs($this->superAdminUser);

        $response = $this->getJson('/api/v1/admin/executive/dashboard');

        $response->assertStatus(200);
    }
}
