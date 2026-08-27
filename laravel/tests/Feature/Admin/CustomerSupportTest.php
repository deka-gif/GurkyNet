<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\SupportTicket;
use App\Models\TicketReply;
use App\Models\DigiflazzTransaction;
use App\Models\MidtransTransaction;
use App\Models\ActivityLog;
use App\Models\Faq;
use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerSupportTest extends TestCase
{
    use RefreshDatabase;

    protected User $supportUser;
    protected User $ownerUser;
    protected User $regularUser;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Support User
        $this->supportUser = User::create([
            'name' => 'Support Agent',
            'email' => 'support@gurkypay.com',
            'phone_number' => '081222222227',
            'password' => Hash::make('password123'),
            'role' => UserRole::CUSTOMER_SUPPORT,
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

    public function test_unauthorized_user_cannot_access_support_dashboard(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->getJson('/api/v1/admin/customer-support/dashboard');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_support_user_can_access_dashboard(): void
    {
        Sanctum::actingAs($this->supportUser);

        // Seed support ticket
        SupportTicket::create([
            'ticket_number' => 'TCK-1001',
            'user_id' => $this->regularUser->id,
            'category' => 'Gagal Isi Pulsa',
            'priority' => 'Tinggi',
            'status' => 'Terbuka',
        ]);

        $response = $this->getJson('/api/v1/admin/customer-support/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'open_tickets',
                    'pending_tickets',
                    'resolved_today',
                    'avg_response_time',
                    'recent_tickets',
                    'recent_refund_requests',
                ],
            ]);
    }

    public function test_support_user_can_list_tickets_with_filters(): void
    {
        Sanctum::actingAs($this->supportUser);

        SupportTicket::create([
            'ticket_number' => 'TCK-1001',
            'user_id' => $this->regularUser->id,
            'category' => 'Gagal Isi Pulsa',
            'priority' => 'Tinggi',
            'status' => 'Terbuka',
        ]);

        SupportTicket::create([
            'ticket_number' => 'TCK-1002',
            'user_id' => $this->regularUser->id,
            'category' => 'Token PLN Delay',
            'priority' => 'Tinggi',
            'status' => 'Pending',
        ]);

        // Filter by Status: Terbuka
        $response = $this->getJson('/api/v1/admin/customer-support/tickets?status=open');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // Filter by Search
        $response = $this->getJson('/api/v1/admin/customer-support/tickets?search=PLN');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    public function test_support_user_can_view_ticket_detail(): void
    {
        Sanctum::actingAs($this->supportUser);

        $ticket = SupportTicket::create([
            'ticket_number' => 'TCK-1001',
            'user_id' => $this->regularUser->id,
            'category' => 'Gagal Isi Pulsa',
            'priority' => 'Tinggi',
            'status' => 'Terbuka',
        ]);

        $response = $this->getJson("/api/v1/admin/customer-support/tickets/{$ticket->id}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'id',
                    'ticketNumber',
                    'user' => [
                        'id',
                        'name',
                        'email',
                    ],
                    'category',
                    'priority',
                    'status',
                    'replies',
                ],
            ]);
    }

    public function test_support_user_can_reply_to_ticket(): void
    {
        Sanctum::actingAs($this->supportUser);

        $ticket = SupportTicket::create([
            'ticket_number' => 'TCK-1001',
            'user_id' => $this->regularUser->id,
            'category' => 'Gagal Isi Pulsa',
            'priority' => 'Tinggi',
            'status' => 'Terbuka',
        ]);

        $response = $this->postJson("/api/v1/admin/customer-support/tickets/{$ticket->id}/reply", [
            'message' => 'Baik, keluhan Anda sedang kami proses silakan ditunggu.',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'message' => 'Baik, keluhan Anda sedang kami proses silakan ditunggu.',
                ],
            ]);

        $this->assertDatabaseHas('ticket_replies', [
            'support_ticket_id' => $ticket->id,
            'user_id' => $this->supportUser->id,
            'message' => 'Baik, keluhan Anda sedang kami proses silakan ditunggu.',
        ]);
    }

    public function test_support_user_can_update_ticket_status(): void
    {
        Sanctum::actingAs($this->supportUser);

        $ticket = SupportTicket::create([
            'ticket_number' => 'TCK-1001',
            'user_id' => $this->regularUser->id,
            'category' => 'Gagal Isi Pulsa',
            'priority' => 'Tinggi',
            'status' => 'Terbuka',
        ]);

        $response = $this->putJson("/api/v1/admin/customer-support/tickets/{$ticket->id}/status", [
            'status' => 'assigned_cs',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'assigned_cs',
                ],
            ]);

        $this->assertDatabaseHas('support_tickets', [
            'id' => $ticket->id,
            'status' => 'assigned_cs',
        ]);
    }

    public function test_support_user_can_list_customers_with_statistics(): void
    {
        Sanctum::actingAs($this->supportUser);

        $response = $this->getJson('/api/v1/admin/customer-support/customers');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => [
                        'id',
                        'name',
                        'email',
                        'walletBalance',
                        'transactionsCount',
                        'supportTicketsCount',
                        'recentTransactions',
                    ]
                ],
            ]);
    }

    public function test_support_user_can_investigate_transaction(): void
    {
        Sanctum::actingAs($this->supportUser);

        $transaction = Transaction::create([
            'user_id' => $this->regularUser->id,
            'invoice_number' => 'INV-99999',
            'service_name' => 'Pulsa',
            'target_number' => '081555555555',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => 'success',
        ]);

        $response = $this->getJson("/api/v1/admin/customer-support/investigations/{$transaction->invoice_number}");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'transaction',
                    'wallet_mutation',
                    'digiflazz_logs',
                    'midtrans_logs',
                    'activity_logs',
                ],
            ]);
    }

    public function test_support_user_can_view_refund_queue(): void
    {
        Sanctum::actingAs($this->supportUser);

        Transaction::create([
            'user_id' => $this->regularUser->id,
            'invoice_number' => 'INV-88888',
            'service_name' => 'Pulsa',
            'target_number' => '081555555555',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => 'failed',
        ]);

        $response = $this->getJson('/api/v1/admin/customer-support/refunds');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    public function test_support_user_can_view_knowledge_base(): void
    {
        Sanctum::actingAs($this->supportUser);

        Faq::create([
            'question' => 'Bagaimana cara top up?',
            'answer' => 'Silakan buka halaman dompet lalu tekan top up.',
            'order' => 1,
        ]);

        $response = $this->getJson('/api/v1/admin/customer-support/knowledge-base');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'faqs',
                    'sops',
                ],
            ]);
    }
}
