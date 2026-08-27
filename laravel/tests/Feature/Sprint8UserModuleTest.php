<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 8 — FR-USR01..06 User/Agen web module + public transaction gates.
 */
class Sprint8UserModuleTest extends TestCase
{
    use RefreshDatabase;

    protected User $userA;
    protected User $userB;
    protected User $finance;
    protected Wallet $walletA;

    protected function setUp(): void
    {
        parent::setUp();

        // Sprint 8 go-live gates — OFF for safety assertions.
        config([
            'features.purchase_enabled' => false,
            'features.withdraw_enabled' => false,
            'features.auto_topup_enabled' => false,
        ]);

        $this->userA = $this->makeUser('user-a-s8@gurkynet.test', '081811100001', UserRole::USER);
        $this->userB = $this->makeUser('user-b-s8@gurkynet.test', '081811100002', UserRole::USER);
        $this->finance = $this->makeUser('fin-s8@gurkynet.test', '081811100003', UserRole::FINANCE);

        $this->walletA = Wallet::create([
            'user_id' => $this->userA->id,
            'wallet_number' => '104811100001',
            'balance' => 250000,
            'status' => 'active',
        ]);
        Wallet::create([
            'user_id' => $this->userB->id,
            'wallet_number' => '104811100002',
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

    public function test_feature_flags_expose_gates_disabled(): void
    {
        $this->getJson('/api/v1/features')
            ->assertOk()
            ->assertJsonPath('data.purchase_enabled', false)
            ->assertJsonPath('data.withdraw_enabled', false)
            ->assertJsonPath('data.auto_topup_enabled', false);
    }

    public function test_auth_login_and_me(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'phone_or_email' => 'user-a-s8@gurkynet.test',
            'password' => 'password123',
        ])->assertOk();

        Sanctum::actingAs($this->userA);
        $this->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_public_announcements_home_source(): void
    {
        $this->getJson('/api/v1/public/announcements')->assertOk();
        $this->getJson('/api/v1/public/banners')->assertOk();
    }

    public function test_catalog_browse_available(): void
    {
        Sanctum::actingAs($this->userA);
        $this->getJson('/api/v1/catalog/taxonomy')->assertOk();
    }

    public function test_purchase_gate_rejects_direct_post_no_wallet_debit(): void
    {
        $before = (float) $this->walletA->fresh()->balance;
        $beforeMut = WalletMutation::query()->where('wallet_id', $this->walletA->id)->count();

        Sanctum::actingAs($this->userA);
        $this->postJson('/api/v1/transactions', [
            'sku_code' => 'S8-PULSA-10',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(422);

        $this->assertSame($before, (float) $this->walletA->fresh()->balance);
        $this->assertSame($beforeMut, WalletMutation::query()->where('wallet_id', $this->walletA->id)->count());
        $this->assertEquals(0, Transaction::query()->where('user_id', $this->userA->id)->count());
    }

    public function test_withdraw_gate_rejects_direct_post_no_hold(): void
    {
        $before = (float) $this->walletA->fresh()->balance;
        $beforeMut = WalletMutation::query()->where('wallet_id', $this->walletA->id)->count();

        Sanctum::actingAs($this->userA);
        $this->postJson('/api/v1/wallet/withdraw', [
            'amount' => 20000,
            'pin' => '123456',
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(422);

        $this->assertSame($before, (float) $this->walletA->fresh()->balance);
        $this->assertSame($beforeMut, WalletMutation::query()->where('wallet_id', $this->walletA->id)->count());
    }

    public function test_auto_topup_gate_rejects_midtrans_path(): void
    {
        Sanctum::actingAs($this->userA);
        $this->postJson('/api/v1/wallet/topup', [
            'amount' => 50000,
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(422);
    }

    public function test_history_ownership_isolation(): void
    {
        $txA = Transaction::create([
            'user_id' => $this->userA->id,
            'invoice_number' => 'TRX-S8-A',
            'service_name' => 'Pulsa',
            'target_number' => '0812',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => TransactionStatus::SUCCESS->value,
        ]);
        $txB = Transaction::create([
            'user_id' => $this->userB->id,
            'invoice_number' => 'TRX-S8-B',
            'service_name' => 'Pulsa',
            'target_number' => '0813',
            'amount' => 15000,
            'admin_fee' => 0,
            'total_payment' => 15000,
            'status' => TransactionStatus::SUCCESS->value,
        ]);

        Sanctum::actingAs($this->userA);
        $this->getJson('/api/v1/transactions')->assertOk();
        $this->getJson('/api/v1/transactions/'.$txA->id)->assertOk();
        $this->getJson('/api/v1/transactions/'.$txB->id)->assertStatus(404);
    }

    public function test_receipt_pdf_own_ok_other_denied_no_mutation(): void
    {
        $txA = Transaction::create([
            'user_id' => $this->userA->id,
            'invoice_number' => 'TRX-S8-RCPT',
            'service_name' => 'Pulsa',
            'target_number' => '0812',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => TransactionStatus::PENDING->value,
            'payment_method' => 'wallet',
        ]);
        $txB = Transaction::create([
            'user_id' => $this->userB->id,
            'invoice_number' => 'TRX-S8-RCPT-B',
            'service_name' => 'Pulsa',
            'target_number' => '0813',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => TransactionStatus::SUCCESS->value,
        ]);

        $beforeStatus = $txA->fresh()->status;
        $beforeBal = (float) $this->walletA->fresh()->balance;

        Sanctum::actingAs($this->userA);
        $own = $this->get('/api/v1/transactions/'.$txA->id.'/receipt.pdf');
        $own->assertOk();
        $this->assertStringContainsString('pdf', strtolower((string) $own->headers->get('content-type')));

        $this->getJson('/api/v1/transactions/'.$txB->id.'/receipt.pdf')->assertStatus(404);

        $this->assertSame($beforeStatus, $txA->fresh()->status);
        $this->assertSame($beforeBal, (float) $this->walletA->fresh()->balance);
    }

    public function test_help_complaint_and_attachment_ownership(): void
    {
        Sanctum::actingAs($this->userA);

        $this->getJson('/api/v1/help')->assertOk();

        $create = $this->postJson('/api/v1/complaints', [
            'category' => 'Transaksi',
            'subject' => 'S8 complaint',
            'description' => 'Need help with pending trx',
        ]);
        $create->assertStatus(201);
        $id = $create->json('data.id');
        $this->assertNotNull($id);

        $this->getJson('/api/v1/complaints/'.$id)->assertOk();

        Sanctum::actingAs($this->userB);
        $this->getJson('/api/v1/complaints/'.$id)->assertStatus(404);
    }

    public function test_wallet_balance_history_and_manual_deposit_path(): void
    {
        Sanctum::actingAs($this->userA);
        $this->getJson('/api/v1/wallet')->assertOk();
        $this->getJson('/api/v1/wallet/history')->assertOk();

        Storage::fake('public');
        $proof = UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf');
        $this->post('/api/v1/wallet/deposit-manual', [
            'amount' => 75000,
            'notes' => 'Transfer BCA',
            'proof' => $proof,
        ], ['Accept' => 'application/json'])->assertStatus(201);

        // Balance unchanged until Finance approval.
        $this->assertSame(250000.0, (float) $this->walletA->fresh()->balance);
    }

    public function test_user_cannot_access_finance_admin_mutation(): void
    {
        Sanctum::actingAs($this->userA);
        $this->getJson('/api/v1/admin/finance/dashboard')->assertStatus(403);
    }

    public function test_chat_conversation_linkage(): void
    {
        Sanctum::actingAs($this->userA);
        $res = $this->postJson('/api/v1/chat/conversation', []);
        $this->assertTrue(in_array($res->status(), [200, 201], true), 'Chat conversation should open for user');
    }
}
