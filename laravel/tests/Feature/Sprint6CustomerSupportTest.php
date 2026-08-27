<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\SupportTicket;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Models\Workflow;
use App\Repositories\Eloquent\CustomerSupportRepository;
use App\Services\Realtime\SseRealtimeTransport;
use App\Support\Support\TicketStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use ReflectionMethod;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Sprint 6 — FR-CS-01, 02, 04, 06, 07, 08 + FR-USR05.
 */
class Sprint6CustomerSupportTest extends TestCase
{
    use RefreshDatabase;

    protected User $cs;
    protected User $finance;
    protected User $ops;
    protected User $marketing;
    protected User $agent;
    protected User $otherUser;
    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        $this->cs = $this->makeUser('cs-s6@gurkynet.test', '081611100001', UserRole::CUSTOMER_SUPPORT);
        $this->finance = $this->makeUser('fin-s6@gurkynet.test', '081611100002', UserRole::FINANCE);
        $this->ops = $this->makeUser('ops-s6@gurkynet.test', '081611100003', UserRole::OPERATIONS);
        $this->marketing = $this->makeUser('mkt-s6@gurkynet.test', '081611100004', UserRole::MARKETING);
        $this->agent = $this->makeUser('user-s6@gurkynet.test', '081611100005', UserRole::USER);
        $this->otherUser = $this->makeUser('other-s6@gurkynet.test', '081611100006', UserRole::USER);

        $this->wallet = Wallet::create([
            'user_id' => $this->agent->id,
            'wallet_number' => '104611100005',
            'balance' => 75000.00,
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

    // ─── FR-CS-01 ───────────────────────────────────────────────

    public function test_fr_cs_01_user_chat_and_cs_reply_persist(): void
    {
        Sanctum::actingAs($this->agent);
        $this->postJson('/api/v1/chat/conversation')->assertOk();
        $convId = \App\Models\Conversation::query()->where('user_id', $this->agent->id)->value('id');
        $this->assertNotNull($convId);

        $this->postJson("/api/v1/chat/conversations/{$convId}/messages", [
            'body' => 'Halo CS, pulsa gagal',
        ])->assertCreated();

        Sanctum::actingAs($this->cs);
        $this->getJson('/api/v1/admin/customer-support/inbox')->assertOk();
        $this->postJson("/api/v1/admin/customer-support/inbox/{$convId}/messages", [
            'body' => 'Baik, kami cek segera.',
        ])->assertCreated();

        Sanctum::actingAs($this->agent);
        $msgs = $this->getJson("/api/v1/chat/conversations/{$convId}/messages")->assertOk()->json('data.messages');
        $this->assertTrue(collect($msgs)->contains(fn ($m) => ($m['body'] ?? '') === 'Baik, kami cek segera.'));
    }

    public function test_fr_cs_01_sse_channel_authorization(): void
    {
        Sanctum::actingAs($this->agent);
        $this->getJson('/api/v1/realtime/poll?channels[]=chat.agents')
            ->assertStatus(403);

        Sanctum::actingAs($this->cs);
        $this->getJson('/api/v1/realtime/poll?channels[]=chat.agents')
            ->assertStatus(200);
    }

    public function test_fr_cs_01_sse_reconnect_uses_after_cursor_no_duplicate_events(): void
    {
        $channel = 'chat.agents';
        $transport = app(SseRealtimeTransport::class);
        $transport->publish($channel, 'ChatMessageSent', ['message_id' => 1, 'body' => 'first']);
        $transport->publish($channel, 'ChatMessageSent', ['message_id' => 2, 'body' => 'second']);

        $all = SseRealtimeTransport::drain($channel, null);
        $this->assertCount(2, $all);
        $firstId = $all[0]['id'];
        $secondId = $all[1]['id'];

        // Poll fallback with cursor — only events after first.
        Sanctum::actingAs($this->cs);
        $poll = $this->getJson(
            '/api/v1/realtime/poll?channels[]='.rawurlencode($channel).'&after['.rawurlencode($channel).']='.rawurlencode($firstId)
        )->assertOk()->json('data.events');
        $this->assertCount(1, $poll);
        $this->assertSame($secondId, $poll[0]['id']);

        // SSE reconnect with same after cursor — must not replay first event.
        $stream = $this->get(
            '/api/v1/realtime/stream?channels[]='.rawurlencode($channel).'&after['.rawurlencode($channel).']='.rawurlencode($firstId),
            ['Accept' => 'text/event-stream']
        );
        $stream->assertOk();
        $body = method_exists($stream, 'streamedContent') ? $stream->streamedContent() : $stream->getContent();
        $this->assertStringContainsString($secondId, $body);
        $this->assertStringNotContainsString('id: '.$firstId."\n", $body);

        // Second reconnect after latest cursor — empty (no duplicates).
        $stream2 = $this->get(
            '/api/v1/realtime/stream?channels[]='.rawurlencode($channel).'&after['.rawurlencode($channel).']='.rawurlencode($secondId),
            ['Accept' => 'text/event-stream']
        );
        $stream2->assertOk();
        $body2 = method_exists($stream2, 'streamedContent') ? $stream2->streamedContent() : $stream2->getContent();
        $this->assertStringNotContainsString('id: '.$firstId."\n", $body2);
        $this->assertStringNotContainsString('id: '.$secondId."\n", $body2);
    }

    // ─── FR-CS-02 + FR-USR05 ────────────────────────────────────

    public function test_fr_cs_02_and_usr05_complaint_lifecycle_with_attachment(): void
    {
        Sanctum::actingAs($this->agent);
        $file = UploadedFile::fake()->create('bukti.pdf', 100, 'application/pdf');
        $create = $this->post('/api/v1/complaints', [
            'category' => 'Transaksi',
            'subject' => 'Pulsa tidak masuk',
            'description' => 'Sudah sukses di app tapi belum masuk',
            'attachment' => $file,
        ], ['Accept' => 'application/json']);

        $create->assertStatus(201);
        $ticketId = $create->json('data.id');
        $ref = $create->json('data.ticketNumber') ?? $create->json('data.ticket_number');
        $this->assertNotEmpty($ref);
        $this->assertEquals('Open', $create->json('data.status'));
        $this->assertEquals(TicketStatus::OPEN, $create->json('data.statusRaw'));
        $this->assertNotEmpty($create->json('data.attachment'));

        Sanctum::actingAs($this->otherUser);
        $this->getJson("/api/v1/complaints/{$ticketId}")->assertStatus(404);

        Sanctum::actingAs($this->cs);
        $this->postJson("/api/v1/admin/customer-support/tickets/{$ticketId}/reply", [
            'message' => 'Mohon ditunggu, sedang dicek.',
        ])->assertSuccessful();

        $this->assertDatabaseHas('support_tickets', [
            'id' => $ticketId,
            'status' => TicketStatus::ASSIGNED_CS,
        ]);

        Sanctum::actingAs($this->agent);
        $show = $this->getJson("/api/v1/complaints/{$ticketId}");
        $show->assertStatus(200)
            ->assertJsonPath('data.ticketNumber', $ref);
        $this->assertNotEmpty($show->json('data.replies'));
        $this->assertEquals('Processing', $show->json('data.status'));
    }

    public function test_fr_cs_02_status_lifecycle_to_resolved_closed(): void
    {
        Sanctum::actingAs($this->cs);
        $ticket = SupportTicket::create([
            'ticket_number' => 'TKT-S6-LIFE',
            'user_id' => $this->agent->id,
            'category' => 'Umum',
            'priority' => 'Sedang',
            'status' => TicketStatus::OPEN,
        ]);

        $this->putJson("/api/v1/admin/customer-support/tickets/{$ticket->id}/status", [
            'status' => 'assigned_cs',
            'assigned_to' => $this->cs->id,
        ])->assertStatus(200)->assertJsonPath('data.status', TicketStatus::ASSIGNED_CS);

        $this->putJson("/api/v1/admin/customer-support/tickets/{$ticket->id}/status", [
            'status' => 'resolved',
        ])->assertStatus(200)->assertJsonPath('data.status', TicketStatus::RESOLVED);

        $this->putJson("/api/v1/admin/customer-support/tickets/{$ticket->id}/status", [
            'status' => 'closed',
        ])->assertStatus(200)->assertJsonPath('data.status', TicketStatus::CLOSED);
    }

    // ─── FR-CS-04 ───────────────────────────────────────────────

    public function test_fr_cs_04_investigation_read_only_and_cs_cannot_mutate_wallet(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->agent->id,
            'invoice_number' => 'INV-S6-INV',
            'service_name' => 'Pulsa',
            'target_number' => '081611100005',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => TransactionStatus::FAILED->value,
        ]);

        Sanctum::actingAs($this->cs);
        $inv = $this->getJson('/api/v1/admin/customer-support/investigations/INV-S6-INV')->assertOk();
        $code = $inv->json('data.transaction.transactionCode')
            ?? $inv->json('data.transaction.invoice_number')
            ?? $inv->json('data.transaction.invoiceNumber');
        $this->assertSame('INV-S6-INV', $code);

        $before = (float) $this->wallet->fresh()->balance;
        $this->putJson("/api/v1/admin/customer-support/refunds/{$tx->id}", [
            'status' => 'approved',
            'notes' => 'should fail',
        ])->assertStatus(403);

        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertEquals(0, WalletMutation::where('wallet_id', $this->wallet->id)->count());
    }

    public function test_fr_cs_04_dead_cs_refund_mutators_always_403_and_no_wallet_change(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->agent->id,
            'invoice_number' => 'INV-S6-DEAD',
            'service_name' => 'Pulsa',
            'target_number' => '081611100005',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'status' => TransactionStatus::FAILED->value,
        ]);

        // No CS approve/reject route exists — only escalate + notes update.
        $routes = collect(\Illuminate\Support\Facades\Route::getRoutes())->map(fn ($r) => [
            'uri' => $r->uri(),
            'methods' => $r->methods(),
            'action' => $r->getActionName(),
        ]);
        $csApprove = $routes->first(fn ($r) => str_contains($r['uri'], 'admin/customer-support/refunds')
            && str_contains(strtolower($r['action']), 'approve'));
        $this->assertNull($csApprove);

        Sanctum::actingAs($this->cs);
        $before = (float) $this->wallet->fresh()->balance;
        $repo = app(CustomerSupportRepository::class);

        foreach (['approveRefund', 'rejectRefund'] as $methodName) {
            $method = new ReflectionMethod(CustomerSupportRepository::class, $methodName);
            $method->setAccessible(true);
            try {
                $method->invoke($repo, $tx->id, 'should not mutate');
                $this->fail("Expected HttpException 403 from {$methodName}");
            } catch (HttpException $e) {
                $this->assertSame(403, $e->getStatusCode());
            }
        }

        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertEquals(0, WalletMutation::where('wallet_id', $this->wallet->id)->count());
        $this->assertSame(TransactionStatus::FAILED->value, $tx->fresh()->status);
    }

    public function test_fr_cs_04_finance_refund_approve_still_works_and_idempotent(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->agent->id,
            'invoice_number' => 'INV-S6-FIN-OK',
            'service_name' => 'Pulsa',
            'target_number' => '081611100005',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::FAILED->value,
            'notes' => 'refund claim',
        ]);

        $key = (string) \Illuminate\Support\Str::uuid();
        Sanctum::actingAs($this->finance);
        $this->postJson("/api/v1/admin/finance/refunds/{$tx->id}/approve", [
            'reason' => 'Finance approve',
            'idempotency_key' => $key,
        ])->assertSuccessful();

        $this->assertEquals(85000.00, (float) $this->wallet->fresh()->balance);
        $this->assertEquals(1, WalletMutation::where('wallet_id', $this->wallet->id)->where('type', 'refund')->count());

        $this->postJson("/api/v1/admin/finance/refunds/{$tx->id}/approve", [
            'reason' => 'Finance approve',
            'idempotency_key' => $key,
        ])->assertSuccessful();

        $this->assertEquals(85000.00, (float) $this->wallet->fresh()->balance);
        $this->assertEquals(1, WalletMutation::where('wallet_id', $this->wallet->id)->where('type', 'refund')->count());
    }

    // ─── FR-CS-06 / 07 / 08 ─────────────────────────────────────

    public function test_fr_cs_06_07_08_escalation_workflow_and_cs_notification(): void
    {
        Sanctum::actingAs($this->agent);
        $this->postJson('/api/v1/chat/conversation')->assertOk();
        $convId = \App\Models\Conversation::query()->where('user_id', $this->agent->id)->value('id');

        Sanctum::actingAs($this->cs);
        $opsEsc = $this->postJson("/api/v1/admin/customer-support/inbox/{$convId}/escalate", [
            'targetDivision' => 'operations',
            'title' => 'Pulsa tidak masuk',
            'description' => 'Status sukses supplier belum masuk',
            'type' => 'provider_issue',
            'priority' => 'high',
        ]);
        $opsEsc->assertCreated();
        $opsWfId = $opsEsc->json('data.id');
        $this->assertNotEmpty($opsWfId);

        $ticketId = SupportTicket::query()->where('conversation_id', $convId)->value('id');
        $this->assertNotNull($ticketId);
        $this->assertEquals(
            TicketStatus::ESCALATED_OPS,
            TicketStatus::normalize((string) SupportTicket::find($ticketId)->status)
        );

        Sanctum::actingAs($this->ops);
        $list = $this->getJson('/api/v1/admin/escalations/operations')->assertOk()->json('data.data');
        $this->assertNotEmpty($list);

        $this->postJson("/api/v1/admin/workflows/{$opsWfId}/actions", [
            'action' => 'resolve',
            'note' => 'Sudah retry sukses',
        ])->assertSuccessful();

        $this->assertDatabaseHas('division_notifications', [
            'role' => 'customer_support',
        ]);

        Sanctum::actingAs($this->cs);
        $finEsc = $this->postJson("/api/v1/admin/customer-support/inbox/{$convId}/escalate", [
            'targetDivision' => 'finance',
            'title' => 'Refund saldo',
            'description' => 'Saldo terpotong transaksi gagal',
            'type' => 'refund_request',
            'priority' => 'high',
        ]);
        $finEsc->assertCreated();

        $this->getJson('/api/v1/admin/escalations/notifications')->assertOk();

        Sanctum::actingAs($this->marketing);
        $this->postJson("/api/v1/admin/customer-support/inbox/{$convId}/messages", [
            'body' => 'Marketing should not reply as CS',
        ])->assertStatus(403);
    }

    public function test_fr_cs_rbac_finance_cannot_mutate_cs_tickets(): void
    {
        $ticket = SupportTicket::create([
            'ticket_number' => 'TKT-S6-RBAC',
            'user_id' => $this->agent->id,
            'category' => 'Umum',
            'priority' => 'Sedang',
            'status' => TicketStatus::OPEN,
        ]);

        Sanctum::actingAs($this->finance);
        $this->postJson("/api/v1/admin/customer-support/tickets/{$ticket->id}/reply", [
            'message' => 'Finance reply',
        ])->assertStatus(403);

        Sanctum::actingAs($this->ops);
        $this->putJson("/api/v1/admin/customer-support/tickets/{$ticket->id}/status", [
            'status' => 'closed',
        ])->assertStatus(403);
    }

    public function test_fr_cs_07_escalate_refund_links_ticket_and_sets_escalated_finance(): void
    {
        $tx = Transaction::create([
            'user_id' => $this->agent->id,
            'invoice_number' => 'INV-S6-ESC-REF',
            'service_name' => 'Pulsa',
            'target_number' => '081611100005',
            'amount' => 12000,
            'admin_fee' => 0,
            'total_payment' => 12000,
            'status' => TransactionStatus::FAILED->value,
            'notes' => 'Saldo terpotong transaksi gagal',
        ]);

        $existingTicket = SupportTicket::create([
            'ticket_number' => 'TKT-S6-REF',
            'user_id' => $this->agent->id,
            'transaction_id' => $tx->id,
            'category' => 'Refund',
            'subject' => 'Refund claim',
            'priority' => 'Tinggi',
            'status' => TicketStatus::ASSIGNED_CS,
            'assigned_to' => $this->cs->id,
            'source' => 'cs_manual',
        ]);

        Sanctum::actingAs($this->cs);
        $this->postJson("/api/v1/admin/customer-support/refunds/{$tx->id}/escalate", [
            'note' => 'Saldo terpotong tapi transaksi gagal',
        ])->assertSuccessful();

        $workflow = Workflow::query()
            ->where('transaction_id', $tx->id)
            ->where('current_division', 'finance')
            ->first();
        $this->assertNotNull($workflow);
        $this->assertSame($existingTicket->id, (int) $workflow->support_ticket_id);
        $this->assertSame('refund_request', $workflow->category);
        $this->assertStringContainsString('INV-S6-ESC-REF', (string) $workflow->title);

        $this->assertDatabaseHas('support_tickets', [
            'id' => $existingTicket->id,
            'status' => TicketStatus::ESCALATED_FINANCE,
        ]);

        // Second escalate must not duplicate open finance workflow / ticket.
        $this->postJson("/api/v1/admin/customer-support/refunds/{$tx->id}/escalate", [
            'note' => 'retry escalate',
        ])->assertSuccessful();

        $this->assertEquals(
            1,
            Workflow::query()
                ->where('transaction_id', $tx->id)
                ->where('current_division', 'finance')
                ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                ->count()
        );
        $this->assertEquals(1, SupportTicket::query()->where('transaction_id', $tx->id)->count());
    }
}
