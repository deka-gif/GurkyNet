<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Services\Support\ChatService;
use App\Services\Workflow\WorkflowEngineService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CS Inbox + hub APIs (Sprint 8.0) — escalate via Workflow Engine (8.2).
 */
class SupportInboxController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected ChatService $chat,
        protected WorkflowEngineService $workflows
    ) {}

    public function hubStats(): JsonResponse
    {
        return $this->successResponse('CS Hub stats.', $this->chat->hubStats());
    }

    public function index(Request $request): JsonResponse
    {
        $paginator = $this->chat->inbox(
            $request->query('status'),
            $request->query('keyword'),
            (int) $request->query('per_page', 30)
        );

        $items = collect($paginator->items())->map(fn (Conversation $c) => $this->chat->conversationPayload($c));

        return $this->successResponse('Inbox dimuat.', [
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $conv = Conversation::query()->with(['user', 'assignedAgent'])->findOrFail($id);
        $thread = $this->chat->thread($conv);
        $snapshot = $this->chat->customerSnapshot($conv->user);

        return $this->successResponse('Detail inbox.', array_merge($thread, [
            'customer' => $snapshot,
        ]));
    }

    public function send(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::query()->findOrFail($id);
        $data = $request->validate([
            'body' => 'required|string|max:5000',
            'clientMessageId' => 'nullable|string|max:64',
            'client_message_id' => 'nullable|string|max:64',
        ]);

        $msg = $this->chat->sendMessage(
            $conv,
            $request->user(),
            $data['body'],
            'agent',
            $data['clientMessageId'] ?? $data['client_message_id'] ?? null
        );

        return $this->successResponse('Balasan terkirim.', $this->chat->messagePayload($msg->load('sender:id,name')), 201);
    }

    public function assign(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::query()->findOrFail($id);
        $conv = $this->chat->assign($conv, $request->user());

        return $this->successResponse('Percakapan di-assign.', [
            'conversation' => $this->chat->conversationPayload($conv),
        ]);
    }

    public function close(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::query()->findOrFail($id);
        $conv = $this->chat->close($conv, $request->user());

        return $this->successResponse('Percakapan ditutup.', [
            'conversation' => $this->chat->conversationPayload($conv),
        ]);
    }

    public function read(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::query()->findOrFail($id);
        $conv = $this->chat->markRead($conv, $request->user(), 'agent');

        return $this->successResponse('Ditandai dibaca.', [
            'conversation' => $this->chat->conversationPayload($conv),
        ]);
    }

    public function convertTicket(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::query()->findOrFail($id);
        $data = $request->validate([
            'category' => 'nullable|string|max:255',
            'priority' => 'nullable|string|max:32',
        ]);

        $ticket = $this->chat->convertToTicket(
            $conv,
            $request->user(),
            $data['category'] ?? null,
            $data['priority'] ?? null
        );

        return $this->successResponse('Tiket dibuat dari chat.', [
            'ticket' => [
                'id' => $ticket->id,
                'ticketNumber' => $ticket->ticket_number,
                'status' => $ticket->status,
                'source' => $ticket->source,
            ],
            'conversation' => $this->chat->conversationPayload($conv->fresh(['user', 'assignedAgent'])),
        ], 201);
    }

    public function escalate(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::query()->findOrFail($id);
        $data = $request->validate([
            'targetDivision' => 'required|in:operations,finance,marketing',
            'target_division' => 'nullable|in:operations,finance,marketing',
            'type' => 'nullable|in:provider_issue,refund_request,feedback,other',
            'category' => 'nullable|string|max:64',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'priority' => 'nullable|string|max:32',
            'transactionId' => 'nullable|integer|exists:transactions,id',
            'transaction_id' => 'nullable|integer|exists:transactions,id',
        ]);

        // FR-CS-02 — ensure a ticket exists so escalation status can be persisted.
        if (! $conv->support_ticket_id) {
            $this->chat->convertToTicket($conv, $request->user());
            $conv->refresh();
        }

        $target = $data['targetDivision'] ?? $data['target_division'];
        $workflow = $this->workflows->createFromCs($request->user(), [
            'conversation_id' => $conv->id,
            'support_ticket_id' => $conv->support_ticket_id,
            'transaction_id' => $data['transactionId'] ?? $data['transaction_id'] ?? $conv->transaction_id,
            'target_division' => $target,
            'type' => $data['type'] ?? null,
            'category' => $data['category'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'priority' => $data['priority'] ?? 'medium',
        ]);

        return $this->successResponse('Eskalasi dikirim sebagai Workflow.', $this->workflows->payload($workflow), 201);
    }
}
