<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\SupportTicket;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * P1-A — chat/complaint must not bind or expose another user's transaction_id.
 */
class ComplaintChatTransactionOwnershipTest extends TestCase
{
    use RefreshDatabase;

    protected User $userA;

    protected User $userB;

    protected Transaction $txB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userA = User::create([
            'name' => 'Owner A',
            'email' => 'p1a-a@gurkypay.com',
            'phone_number' => '081234567820',
            'password' => Hash::make('password123'),
        ]);
        Wallet::create([
            'user_id' => $this->userA->id,
            'wallet_number' => 'W-P1A-A',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $this->userB = User::create([
            'name' => 'Owner B',
            'email' => 'p1a-b@gurkypay.com',
            'phone_number' => '081234567821',
            'password' => Hash::make('password123'),
        ]);
        Wallet::create([
            'user_id' => $this->userB->id,
            'wallet_number' => 'W-P1A-B',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $this->txB = Transaction::create([
            'user_id' => $this->userB->id,
            'invoice_number' => 'TRX-P1A-B-1',
            'service_name' => 'Pulsa',
            'target_number' => '081200000001',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'payment_method' => 'wallet',
            'status' => 'success',
        ]);
    }

    public function test_complaint_cannot_attach_other_user_transaction(): void
    {
        Sanctum::actingAs($this->userA);

        $this->postJson('/api/v1/complaints', [
            'category' => 'Transaksi',
            'subject' => 'Hijack attempt',
            'description' => 'Trying to attach B transaction',
            'transaction_id' => $this->txB->id,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['transaction_id'], 'errors');

        $this->assertDatabaseMissing('support_tickets', [
            'user_id' => $this->userA->id,
            'transaction_id' => $this->txB->id,
        ]);
    }

    public function test_complaint_can_attach_own_transaction(): void
    {
        $txA = Transaction::create([
            'user_id' => $this->userA->id,
            'invoice_number' => 'TRX-P1A-A-1',
            'service_name' => 'Pulsa',
            'target_number' => '081200000002',
            'amount' => 15000,
            'admin_fee' => 0,
            'total_payment' => 15000,
            'payment_method' => 'wallet',
            'status' => 'failed',
        ]);

        Sanctum::actingAs($this->userA);
        $this->postJson('/api/v1/complaints', [
            'category' => 'Transaksi',
            'subject' => 'Own trx',
            'description' => 'My failed trx',
            'transaction_id' => $txA->id,
        ])->assertCreated()
            ->assertJsonPath('data.transactionId', $txA->id);

        $this->assertDatabaseHas('support_tickets', [
            'user_id' => $this->userA->id,
            'transaction_id' => $txA->id,
        ]);
    }

    public function test_user_b_cannot_read_user_a_complaint(): void
    {
        Sanctum::actingAs($this->userA);
        $id = $this->postJson('/api/v1/complaints', [
            'category' => 'Umum',
            'subject' => 'Private',
            'description' => 'Only A',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($this->userB);
        $this->getJson('/api/v1/complaints/'.$id)->assertNotFound();
    }

    public function test_chat_cannot_link_other_user_transaction(): void
    {
        Sanctum::actingAs($this->userA);

        $this->postJson('/api/v1/chat/conversation', [
            'transaction_id' => $this->txB->id,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['transaction_id'], 'errors');

        $this->assertDatabaseMissing('conversations', [
            'user_id' => $this->userA->id,
            'transaction_id' => $this->txB->id,
        ]);
    }

    public function test_chat_open_conversation_cannot_be_updated_with_foreign_transaction(): void
    {
        Sanctum::actingAs($this->userA);
        $convId = $this->postJson('/api/v1/chat/conversation', [])
            ->assertOk()
            ->json('data.conversation.id');

        $this->postJson('/api/v1/chat/conversation', [
            'transactionId' => $this->txB->id,
        ])->assertStatus(422);

        $conv = Conversation::query()->findOrFail($convId);
        $this->assertNull($conv->transaction_id);
    }

    public function test_chat_can_link_own_transaction(): void
    {
        $txA = Transaction::create([
            'user_id' => $this->userA->id,
            'invoice_number' => 'TRX-P1A-A-2',
            'service_name' => 'Data',
            'target_number' => '081200000003',
            'amount' => 20000,
            'admin_fee' => 0,
            'total_payment' => 20000,
            'payment_method' => 'wallet',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->userA);
        $this->postJson('/api/v1/chat/conversation', [
            'transaction_id' => $txA->id,
        ])->assertOk()
            ->assertJsonPath('data.conversation.transactionId', $txA->id);
    }

    public function test_user_b_cannot_read_or_message_user_a_conversation(): void
    {
        Sanctum::actingAs($this->userA);
        $convId = $this->postJson('/api/v1/chat/conversation', [])
            ->assertOk()
            ->json('data.conversation.id');

        Sanctum::actingAs($this->userB);
        $this->getJson("/api/v1/chat/conversations/{$convId}/messages")->assertForbidden();
        $this->postJson("/api/v1/chat/conversations/{$convId}/messages", [
            'body' => 'intrusion',
        ])->assertForbidden();
        $this->postJson("/api/v1/chat/conversations/{$convId}/read")->assertForbidden();
    }
}
