<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Services\Support\ChatService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * End-user Live Chat API (Sprint 8.0).
 */
class ChatController extends Controller
{
    use ApiResponseTrait;

    public function __construct(protected ChatService $chat) {}

    public function conversation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'transactionId' => 'nullable|integer|exists:transactions,id',
            'transaction_id' => 'nullable|integer|exists:transactions,id',
            'subject' => 'nullable|string|max:255',
        ]);

        $txId = $data['transactionId'] ?? $data['transaction_id'] ?? null;
        $conv = $this->chat->getOrCreateForUser($request->user(), $txId, $data['subject'] ?? null);

        return $this->successResponse('Percakapan siap.', [
            'conversation' => $this->chat->conversationPayload($conv),
        ]);
    }

    public function messages(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::query()->findOrFail($id);
        if ((int) $conv->user_id !== (int) $request->user()->id) {
            abort(403, 'Akses ditolak.');
        }

        return $this->successResponse('Pesan berhasil dimuat.', $this->chat->thread($conv));
    }

    public function send(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::query()->findOrFail($id);
        if ((int) $conv->user_id !== (int) $request->user()->id) {
            abort(403, 'Akses ditolak.');
        }

        $data = $request->validate([
            'body' => 'required|string|max:5000',
            'clientMessageId' => 'nullable|string|max:64',
            'client_message_id' => 'nullable|string|max:64',
        ]);

        $msg = $this->chat->sendMessage(
            $conv,
            $request->user(),
            $data['body'],
            'user',
            $data['clientMessageId'] ?? $data['client_message_id'] ?? null
        );

        return $this->successResponse('Pesan terkirim.', $this->chat->messagePayload($msg->load('sender:id,name')), 201);
    }

    public function read(Request $request, int $id): JsonResponse
    {
        $conv = Conversation::query()->findOrFail($id);
        if ((int) $conv->user_id !== (int) $request->user()->id) {
            abort(403, 'Akses ditolak.');
        }

        $conv = $this->chat->markRead($conv, $request->user(), 'user');

        return $this->successResponse('Ditandai dibaca.', [
            'conversation' => $this->chat->conversationPayload($conv),
        ]);
    }

    public function refundStatuses(Request $request): JsonResponse
    {
        $user = $request->user();
        $engine = app(\App\Services\Workflow\WorkflowEngineService::class);

        $workflows = \App\Models\Workflow::query()
            ->whereIn('category', ['refund_request', 'partial_refund', 'wallet_exception', 'other_finance'])
            ->where(function ($q) use ($user) {
                $q->whereHas('conversation', fn ($c) => $c->where('user_id', $user->id))
                    ->orWhereHas('ticket', fn ($t) => $t->where('user_id', $user->id))
                    ->orWhereHas('transaction', fn ($t) => $t->where('user_id', $user->id));
            })
            ->with(['transaction'])
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn ($w) => $engine->payload($w));

        // Legacy Phase 1 escalations (read-only history)
        $rows = \App\Models\SupportEscalation::query()
            ->where('type', 'refund_request')
            ->where(function ($q) use ($user) {
                $q->whereHas('conversation', fn ($c) => $c->where('user_id', $user->id))
                    ->orWhereHas('ticket', fn ($t) => $t->where('user_id', $user->id));
            })
            ->with(['transaction'])
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn ($e) => app(\App\Services\Support\EscalationService::class)->payload($e));

        $txRefunds = \App\Models\Transaction::query()
            ->where('user_id', $user->id)
            ->where(function ($q) {
                $q->whereNotNull('refunded_at')
                    ->orWhereIn('status', ['failed', 'canceled', 'cancelled']);
            })
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'invoice' => $t->invoice_number ?? $t->invoice ?? null,
                'status' => $t->status,
                'refundedAt' => optional($t->refunded_at)?->toIso8601String(),
                'amount' => $t->total_amount ?? $t->amount ?? null,
            ]);

        return $this->successResponse('Status refund.', [
            'workflows' => $workflows,
            'escalations' => $rows,
            'transactions' => $txRefunds,
        ]);
    }
}
