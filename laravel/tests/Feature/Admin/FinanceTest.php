<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Models\PaymentHistory;
use App\Enums\UserRole;
use App\Enums\TransactionStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use RefreshDatabase;

    protected User $financeUser;
    protected User $ownerUser;
    protected User $superAdminUser;
    protected User $regularUser;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Finance User
        $this->financeUser = User::create([
            'name' => 'Finance Admin',
            'email' => 'finance@gurkypay.com',
            'phone_number' => '081222222222',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 2. Owner User
        $this->ownerUser = User::create([
            'name' => 'Owner Admin',
            'email' => 'owner@gurkypay.com',
            'phone_number' => '081333333333',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 3. Super Admin
        $this->superAdminUser = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@gurkypay.com',
            'phone_number' => '081444444444',
            'password' => Hash::make('password123'),
            'role' => UserRole::SUPER_ADMIN,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 4. Regular User
        $this->regularUser = User::create([
            'name' => 'Budi Customer',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081555555555',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        Wallet::create([
            'user_id' => $this->regularUser->id,
            'wallet_number' => '104255555555',
            'balance' => 100000.00,
            'status' => 'active',
        ]);
    }

    public function test_regular_user_cannot_access_finance_dashboard(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->getJson('/api/v1/admin/finance/dashboard');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_finance_user_can_access_finance_dashboard(): void
    {
        Sanctum::actingAs($this->financeUser);

        $response = $this->getJson('/api/v1/admin/finance/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'revenue_summary' => [
                        'today_revenue',
                        'monthly_revenue',
                        'totalTransactions',
                        'pending_settlement_count',
                        'pending_settlement_amount',
                        'refund_pending_count',
                        'settlement_success_count',
                    ],
                    'recent_transactions',
                ],
                'meta',
                'errors',
            ]);
    }

    public function test_finance_user_can_fetch_financial_reports(): void
    {
        Sanctum::actingAs($this->financeUser);

        // Seed a transaction
        Transaction::create([
            'user_id' => $this->regularUser->id,
            'invoice_number' => 'INV/TEST/001',
            'service_name' => 'Pulsa 50k',
            'target_number' => '08123456789',
            'amount' => 50000,
            'admin_fee' => 1500,
            'total_payment' => 51500,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SUCCESS->value,
            'notes' => 'Test report transaction',
        ]);

        $response = $this->getJson('/api/v1/admin/finance/reports?start_date=' . now()->subDay()->toDateString());

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'summary' => [
                        'total_records',
                        'gross_revenue',
                        'total_admin_fees',
                        'net_revenue',
                    ],
                    'records',
                ],
            ]);
    }

    public function test_finance_user_can_list_refund_claims(): void
    {
        Sanctum::actingAs($this->financeUser);

        Transaction::create([
            'user_id' => $this->regularUser->id,
            'invoice_number' => 'INV/REFUND/001',
            'service_name' => 'PLN Token 100k',
            'target_number' => '1234567890',
            'amount' => 100000,
            'admin_fee' => 2000,
            'total_payment' => 102000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
            'notes' => 'Mohon refund, token gagal terbit',
        ]);

        $response = $this->getJson('/api/v1/admin/finance/refunds');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data',
                'meta' => [
                    'pagination' => ['currentPage', 'lastPage', 'perPage', 'total'],
                ],
            ]);
    }

    public function test_finance_user_can_approve_refund(): void
    {
        Sanctum::actingAs($this->financeUser);

        $transaction = Transaction::create([
            'user_id' => $this->regularUser->id,
            'invoice_number' => 'INV/REFUND/APPROVE',
            'service_name' => 'PDAM Bill',
            'target_number' => '987654321',
            'amount' => 75000,
            'admin_fee' => 2500,
            'total_payment' => 77500,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
            'notes' => 'Pengajuan refund',
        ]);

        $response = $this->postJson("/api/v1/admin/finance/refunds/{$transaction->id}/approve", [
            'notes' => 'Diproses pengembalian dana penuh',
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('transactions', [
            'id' => $transaction->id,
            'status' => TransactionStatus::CANCELED->value,
        ]);

        // Check user wallet balance credited (initial 100,000 + 77,500 = 177,500)
        $this->assertDatabaseHas('wallets', [
            'user_id' => $this->regularUser->id,
            'balance' => 177500.00,
        ]);
    }

    public function test_finance_user_can_reject_refund(): void
    {
        Sanctum::actingAs($this->financeUser);

        $transaction = Transaction::create([
            'user_id' => $this->regularUser->id,
            'invoice_number' => 'INV/REFUND/REJECT',
            'service_name' => 'Data Telkomsel 10GB',
            'target_number' => '081299998888',
            'amount' => 50000,
            'admin_fee' => 1000,
            'total_payment' => 51000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SUCCESS->value,
            'notes' => 'Minta refund padahal pulsa sudah masuk',
        ]);

        $response = $this->postJson("/api/v1/admin/finance/refunds/{$transaction->id}/reject", [
            'reason' => 'Transaksi sudah terverifikasi sukses dari provider',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_finance_user_can_list_settlements(): void
    {
        Sanctum::actingAs($this->financeUser);

        $transaction = Transaction::create([
            'user_id' => $this->regularUser->id,
            'invoice_number' => 'INV/SETTLE/001',
            'service_name' => 'Top Up Wallet',
            'target_number' => '104255555555',
            'amount' => 100000,
            'admin_fee' => 0,
            'total_payment' => 100000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::SUCCESS->value,
        ]);

        PaymentHistory::create([
            'transaction_id' => $transaction->id,
            'gateway' => 'midtrans',
            'payment_code' => 'BCA_VA',
            'payload' => ['bank' => 'bca'],
            'response' => ['status' => 'settlement'],
            'status' => 'settlement',
        ]);

        $response = $this->getJson('/api/v1/admin/finance/settlements');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data',
                'meta' => [
                    'pagination' => ['currentPage', 'lastPage', 'perPage', 'total'],
                ],
            ]);
    }
}
