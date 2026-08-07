<?php

namespace Tests\Feature\Support;

use App\Enums\UserRole;
use App\Models\ChatMessage;
use App\Models\Conversation;
use App\Models\DivisionNotification;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Realtime\RealtimeChannelAuthorizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CsCommunicationHubTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(UserRole $role, string $emailPrefix = 'u'): User
    {
        return User::create([
            'name' => $role->label(),
            'email' => $emailPrefix.'-'.uniqid().'@gurkypay.com',
            'phone_number' => '081'.random_int(100000000, 999999999),
            'password' => Hash::make('password123'),
            'role' => $role,
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    public function test_user_message_persists_and_appears_in_cs_inbox(): void
    {
        $user = $this->makeUser(UserRole::USER, 'customer');
        $agent = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs');

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/chat/conversation')->assertOk();
        $convId = Conversation::query()->where('user_id', $user->id)->value('id');
        $this->assertNotNull($convId);

        $this->postJson("/api/v1/chat/conversations/{$convId}/messages", [
            'body' => 'Pulsa gagal masuk',
            'clientMessageId' => 'c_test_1',
        ])->assertCreated();

        $this->assertDatabaseHas('chat_messages', [
            'conversation_id' => $convId,
            'body' => 'Pulsa gagal masuk',
            'sender_role' => 'user',
        ]);

        Sanctum::actingAs($agent);
        $inbox = $this->getJson('/api/v1/admin/customer-support/inbox')->assertOk()->json('data.data');
        $this->assertTrue(collect($inbox)->contains(fn ($c) => (int) $c['id'] === (int) $convId));
    }

    public function test_agent_reply_visible_to_user(): void
    {
        $user = $this->makeUser(UserRole::USER, 'user2');
        $agent = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs2');

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/chat/conversation')->assertOk();
        $convId = Conversation::first()->id;
        $this->postJson("/api/v1/chat/conversations/{$convId}/messages", ['body' => 'Halo CS'])->assertCreated();

        Sanctum::actingAs($agent);
        $this->postJson("/api/v1/admin/customer-support/inbox/{$convId}/messages", [
            'body' => 'Baik, kami bantu.',
        ])->assertCreated();

        Sanctum::actingAs($user);
        $msgs = $this->getJson("/api/v1/chat/conversations/{$convId}/messages")->assertOk()->json('data.messages');
        $this->assertTrue(collect($msgs)->contains(fn ($m) => $m['body'] === 'Baik, kami bantu.' && $m['senderRole'] === 'agent'));
    }

    public function test_convert_chat_to_ticket_seeds_replies(): void
    {
        $user = $this->makeUser(UserRole::USER, 'user3');
        $agent = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs3');

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/chat/conversation')->assertOk();
        $convId = Conversation::first()->id;
        $this->postJson("/api/v1/chat/conversations/{$convId}/messages", ['body' => 'Butuh tiket'])->assertCreated();

        Sanctum::actingAs($agent);
        $res = $this->postJson("/api/v1/admin/customer-support/inbox/{$convId}/convert-ticket", [
            'category' => 'Live Chat',
        ])->assertCreated()->json('data');

        $this->assertNotEmpty($res['ticket']['ticketNumber']);
        $ticket = SupportTicket::find($res['ticket']['id']);
        $this->assertSame('chat_convert', $ticket->source);
        $this->assertSame((int) $convId, (int) $ticket->conversation_id);
        $this->assertGreaterThan(0, $ticket->replies()->count());
    }

    public function test_escalate_to_operations_creates_queue_and_notification(): void
    {
        $user = $this->makeUser(UserRole::USER, 'user4');
        $agent = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs4');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops');

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/chat/conversation')->assertOk();
        $convId = Conversation::first()->id;

        Sanctum::actingAs($agent);
        $this->postJson("/api/v1/admin/customer-support/inbox/{$convId}/escalate", [
            'targetDivision' => 'operations',
            'title' => 'Provider timeout',
            'description' => 'RC 99',
            'type' => 'provider_issue',
        ])->assertCreated();

        $this->assertDatabaseHas('workflows', [
            'current_division' => 'operations',
            'title' => 'Provider timeout',
            'status' => 'waiting_operations',
        ]);
        $this->assertDatabaseHas('division_notifications', [
            'role' => 'operations',
            'type' => 'workflow_new',
        ]);

        Sanctum::actingAs($ops);
        $list = $this->getJson('/api/v1/admin/escalations/operations')->assertOk()->json('data.data');
        $this->assertNotEmpty($list);

        $id = $list[0]['id'];
        $this->patchJson("/api/v1/admin/escalations/items/{$id}", [
            'status' => 'resolved',
            'resolutionNote' => 'Provider recovered',
        ])->assertOk();

        $this->assertSame('resolved', \App\Models\Workflow::find($id)->status);
        $this->assertTrue(
            ChatMessage::query()->where('conversation_id', $convId)->where('sender_role', 'system')->exists()
        );
    }

    public function test_sse_poll_rejects_unauthorized_channel(): void
    {
        $user = $this->makeUser(UserRole::USER, 'user5');
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/realtime/poll?channels[]=chat.agents')->assertStatus(403);
        $this->getJson('/api/v1/realtime/poll?channels[]=chat.user.'.$user->id)->assertOk();
    }

    public function test_channel_authorizer_blocks_foreign_user_chat(): void
    {
        $a = $this->makeUser(UserRole::USER, 'a');
        $b = $this->makeUser(UserRole::USER, 'b');
        $auth = new RealtimeChannelAuthorizer;
        $this->assertTrue($auth->canSubscribe($a, 'chat.user.'.$a->id));
        $this->assertFalse($auth->canSubscribe($a, 'chat.user.'.$b->id));
    }

    public function test_marketing_cannot_access_operations_queue(): void
    {
        $mkt = $this->makeUser(UserRole::MARKETING, 'mkt');
        Sanctum::actingAs($mkt);
        $this->getJson('/api/v1/admin/escalations/operations')->assertStatus(403);
    }
}
