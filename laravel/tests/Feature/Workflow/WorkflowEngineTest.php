<?php

namespace Tests\Feature\Workflow;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Jobs\ProcessDigiflazzTransaction;
use App\Models\Conversation;
use App\Models\DivisionNotification;
use App\Models\Faq;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Workflow;
use App\Models\WorkflowEvent;
use App\Services\Realtime\RealtimeChannelAuthorizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkflowEngineTest extends TestCase
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

    public function test_cs_escalate_appears_in_operations_queue(): void
    {
        $user = $this->makeUser(UserRole::USER, 'cust');
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops');

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/chat/conversation')->assertOk();
        $convId = Conversation::first()->id;

        Sanctum::actingAs($cs);
        $res = $this->postJson("/api/v1/admin/customer-support/inbox/{$convId}/escalate", [
            'targetDivision' => 'operations',
            'title' => 'API timeout',
            'description' => 'Provider lambat',
            'type' => 'provider_issue',
            'priority' => 'high',
        ])->assertCreated()->json('data');

        $this->assertSame('waiting_operations', $res['status']);
        $this->assertSame('operations', $res['currentDivision']);
        $this->assertNotEmpty($res['workflowCode']);

        Sanctum::actingAs($ops);
        $list = $this->getJson('/api/v1/admin/workflows?division=operations')->assertOk()->json('data.data');
        $this->assertTrue(collect($list)->contains(fn ($w) => $w['id'] === $res['id']));
    }

    public function test_ops_resolve_notifies_cs_and_writes_timeline(): void
    {
        $user = $this->makeUser(UserRole::USER, 'cust2');
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs2');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops2');

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/chat/conversation')->assertOk();
        $convId = Conversation::first()->id;

        Sanctum::actingAs($cs);
        $wfId = $this->postJson("/api/v1/admin/customer-support/inbox/{$convId}/escalate", [
            'targetDivision' => 'operations',
            'title' => 'SKU error',
            'type' => 'provider_issue',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($ops);
        $this->postJson("/api/v1/admin/workflows/{$wfId}/actions", [
            'action' => 'resolve',
            'note' => 'Fixed mapping',
        ])->assertOk();

        $wf = Workflow::find($wfId);
        $this->assertSame('resolved', $wf->status);
        $this->assertTrue(
            WorkflowEvent::query()->where('workflow_id', $wfId)->where('event_type', 'resolved')->exists()
        );
        $this->assertDatabaseHas('division_notifications', [
            'role' => 'customer_support',
            'related_type' => 'workflow',
            'related_id' => $wfId,
        ]);
    }

    public function test_finance_approve_credits_wallet_via_existing_service(): void
    {
        $user = $this->makeUser(UserRole::USER, 'cust3');
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '10'.random_int(1000000000, 9999999999),
            'balance' => 100000,
            'status' => 'active',
        ]);
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs3');
        $fin = $this->makeUser(UserRole::FINANCE, 'fin');

        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'INV/WF/REFUND/'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 20000,
            'admin_fee' => 0,
            'total_payment' => 20000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
            'notes' => 'Gagal',
        ]);

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Refund request',
            'targetDivision' => 'finance',
            'transactionId' => $tx->id,
            'type' => 'refund_request',
            'priority' => 'medium',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($fin);
        $this->postJson("/api/v1/admin/workflows/{$wfId}/actions", [
            'action' => 'approve',
            'note' => 'Full refund OK',
        ])->assertOk();

        $this->assertSame('resolved', Workflow::find($wfId)->status);
        $this->assertDatabaseHas('wallets', [
            'user_id' => $user->id,
            'balance' => 120000.00,
        ]);
        $this->assertNotNull($tx->fresh()->refunded_at);
    }

    public function test_marketing_faq_draft_and_resolve_without_homepage_publish(): void
    {
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs4');
        $mkt = $this->makeUser(UserRole::MARKETING, 'mkt');

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'UI confusing',
            'targetDivision' => 'marketing',
            'type' => 'feedback',
            'category' => 'feedback_ui',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($mkt);
        $this->postJson("/api/v1/admin/workflows/{$wfId}/actions", [
            'action' => 'create_faq_draft',
            'payload' => [
                'question' => '[DRAFT] Bagaimana top up?',
                'answer' => 'Lewati menu Wallet.',
            ],
        ])->assertOk();

        $this->assertDatabaseHas('faq', [
            'question' => '[DRAFT] Bagaimana top up?',
        ]);
        $this->assertTrue(Faq::query()->where('question', '[DRAFT] Bagaimana top up?')->exists());

        $this->postJson("/api/v1/admin/workflows/{$wfId}/actions", [
            'action' => 'resolve',
            'note' => 'FAQ drafted',
        ])->assertOk();

        $this->assertSame('resolved', Workflow::find($wfId)->status);
        $meta = Workflow::find($wfId)->meta ?? [];
        $this->assertArrayHasKey('faq_id', $meta);
    }

    public function test_ops_retry_is_intent_only_no_digiflazz_job(): void
    {
        Queue::fake();

        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs5');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops5');

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Retry needed',
            'targetDivision' => 'operations',
            'type' => 'provider_issue',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($ops);
        $this->postJson("/api/v1/admin/workflows/{$wfId}/actions", [
            'action' => 'retry',
            'note' => 'Please retry later',
        ])->assertOk();

        Queue::assertNotPushed(ProcessDigiflazzTransaction::class);
        $this->assertTrue(
            WorkflowEvent::query()
                ->where('workflow_id', $wfId)
                ->where('action', 'retry_intent')
                ->exists()
        );
    }

    public function test_finance_cannot_list_ops_queue_and_cs_cannot_approve(): void
    {
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs6');
        $fin = $this->makeUser(UserRole::FINANCE, 'fin6');

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Ops case',
            'targetDivision' => 'operations',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($fin);
        $this->getJson('/api/v1/admin/workflows?division=operations')->assertStatus(403);
        $this->getJson('/api/v1/admin/escalations/operations')->assertStatus(403);

        Sanctum::actingAs($cs);
        $this->postJson("/api/v1/admin/workflows/{$wfId}/actions", [
            'action' => 'approve',
        ])->assertStatus(403);
    }

    public function test_owner_force_resolve_and_reassign(): void
    {
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs7');
        $ops = $this->makeUser(UserRole::OPERATIONS, 'ops7');
        $owner = $this->makeUser(UserRole::OWNER, 'own');

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Stuck case',
            'targetDivision' => 'operations',
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($owner);
        $this->postJson("/api/v1/admin/workflows/{$wfId}/reassign", [
            'assignedTo' => $ops->id,
        ])->assertOk();

        $this->assertSame($ops->id, (int) Workflow::find($wfId)->assigned_to);

        $this->postJson("/api/v1/admin/workflows/{$wfId}/force-resolve", [
            'note' => 'Admin closed',
        ])->assertOk();

        $this->assertSame('resolved', Workflow::find($wfId)->status);
    }

    public function test_sse_rejects_foreign_workflow_channel(): void
    {
        $user = $this->makeUser(UserRole::USER, 'u8');
        $fin = $this->makeUser(UserRole::FINANCE, 'fin8');
        $cs = $this->makeUser(UserRole::CUSTOMER_SUPPORT, 'cs8');

        Sanctum::actingAs($cs);
        $wfId = $this->postJson('/api/v1/admin/workflows', [
            'title' => 'Ops channel test',
            'targetDivision' => 'operations',
        ])->assertCreated()->json('data.id');

        $auth = new RealtimeChannelAuthorizer;
        $this->assertFalse($auth->canSubscribe($user, 'workflow.'.$wfId));
        $this->assertFalse($auth->canSubscribe($fin, 'workflow.'.$wfId));
        $this->assertTrue($auth->canSubscribe($cs, 'workflow.'.$wfId));

        Sanctum::actingAs($user);
        $this->getJson('/api/v1/realtime/poll?channels[]=workflow.'.$wfId)->assertStatus(403);
    }
}
