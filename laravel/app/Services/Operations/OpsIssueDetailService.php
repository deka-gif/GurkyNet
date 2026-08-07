<?php

namespace App\Services\Operations;

use App\Models\ChatMessage;
use App\Models\ProductProviderLog;
use App\Models\SupportTicket;
use App\Models\Transaction;
use App\Models\Workflow;
use App\Services\Workflow\WorkflowEngineService;
use Illuminate\Support\Facades\Schema;

class OpsIssueDetailService
{
    public function __construct(
        protected WorkflowEngineService $engine
    ) {}

    /**
     * Rich issue payload for Ops Issue Queue detail pane.
     *
     * @return array<string, mixed>
     */
    public function build(Workflow $workflow): array
    {
        $workflow->loadMissing($this->engine->defaultRelations());
        $base = $this->engine->payload($workflow);

        $snapshot = $this->transactionSnapshot($workflow);
        if ($snapshot) {
            $meta = is_array($workflow->meta) ? $workflow->meta : [];
            $meta['ops_snapshot'] = array_merge($meta['ops_snapshot'] ?? [], [
                'rc' => $snapshot['rc'],
                'retry_count' => $snapshot['retryCount'],
                'api_request' => $snapshot['apiRequest'],
                'api_response' => $snapshot['apiResponse'],
                'provider_code' => $snapshot['providerCode'],
                'sku' => $snapshot['sku'],
                'enriched_at' => now()->toIso8601String(),
            ]);
            // Persist enrichment without firing extra events
            Workflow::query()->whereKey($workflow->id)->update(['meta' => $meta]);
            $workflow->meta = $meta;
            $base['meta'] = $meta;
        }

        $base['opsDetail'] = [
            'transaction' => $snapshot,
            'chatSummary' => $this->chatSummary($workflow),
            'providerLogs' => $this->providerLogs($workflow),
            'safeActions' => [
                'retry' => 'intent_only',
                'need_refund' => 'escalate_finance',
                'maintenance' => 'product_provider_control',
                'resolve' => 'close_issue',
            ],
        ];

        return $base;
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function transactionSnapshot(Workflow $workflow): ?array
    {
        if (! $workflow->transaction_id) {
            return null;
        }

        /** @var Transaction|null $tx */
        $tx = Transaction::query()->with(['user:id,name,email'])->find($workflow->transaction_id);
        if (! $tx) {
            return null;
        }

        $resp = is_array($tx->provider_response) ? $tx->provider_response : [];
        $rc = $resp['rc'] ?? $resp['response_code'] ?? $resp['status'] ?? $tx->provider_last_status ?? null;

        $logs = [];
        if (Schema::hasTable('product_provider_logs')) {
            $logs = ProductProviderLog::query()
                ->where('transaction_id', $tx->id)
                ->orderByDesc('id')
                ->limit(5)
                ->get();
        }

        $retryCount = $logs ? $logs->max('attempt') : (int) (($resp['attempt'] ?? $resp['retry'] ?? 0));
        $lastLog = $logs ? $logs->first() : null;
        $logMeta = is_array($lastLog?->meta) ? $lastLog->meta : [];

        return [
            'id' => $tx->id,
            'invoice' => $tx->invoice_number,
            'customerName' => $tx->user?->name,
            'customerEmail' => $tx->user?->email,
            'serviceName' => $tx->service_name,
            'targetNumber' => $tx->target_number,
            'status' => $tx->status,
            'amount' => (float) $tx->amount,
            'totalPayment' => (float) $tx->total_payment,
            'providerCode' => $tx->fulfillment_provider_code ?: ($lastLog?->selected_provider_code),
            'sku' => $tx->provider_sku_used,
            'providerRef' => $tx->provider_ref,
            'rc' => $rc,
            'retryCount' => (int) $retryCount,
            'apiRequest' => $logMeta['request'] ?? $resp['request'] ?? null,
            'apiResponse' => $logMeta['response'] ?? $resp,
            'lastError' => $lastLog?->error_message,
            'responseTimeMs' => $lastLog?->response_time_ms,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function chatSummary(Workflow $workflow): ?array
    {
        $ticketId = $workflow->support_ticket_id ?? ($workflow->meta['support_ticket_id'] ?? null);
        if (! $ticketId || ! Schema::hasTable('support_tickets')) {
            return null;
        }

        $ticket = SupportTicket::query()->find($ticketId);
        if (! $ticket) {
            return null;
        }

        $conversationId = $ticket->conversation_id ?? null;
        if (! $conversationId || ! Schema::hasTable('chat_messages')) {
            return [
                'ticketId' => $ticket->id,
                'subject' => $ticket->subject ?? null,
                'messages' => [],
            ];
        }

        $messages = ChatMessage::query()
            ->where('conversation_id', $conversationId)
            ->orderByDesc('id')
            ->limit(8)
            ->get()
            ->map(fn (ChatMessage $m) => [
                'id' => $m->id,
                'body' => $m->body ?? null,
                'senderRole' => $m->sender_role ?? null,
                'createdAt' => optional($m->created_at)?->toIso8601String(),
            ])
            ->reverse()
            ->values()
            ->all();

        return [
            'ticketId' => $ticket->id,
            'conversationId' => $conversationId,
            'subject' => $ticket->subject ?? null,
            'messages' => $messages,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function providerLogs(Workflow $workflow): array
    {
        if (! $workflow->transaction_id || ! Schema::hasTable('product_provider_logs')) {
            return [];
        }

        return ProductProviderLog::query()
            ->where('transaction_id', $workflow->transaction_id)
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (ProductProviderLog $log) => [
                'id' => $log->id,
                'eventType' => $log->event_type,
                'providerCode' => $log->selected_provider_code,
                'attempt' => $log->attempt,
                'success' => $log->success,
                'responseTimeMs' => $log->response_time_ms,
                'errorMessage' => $log->error_message,
                'meta' => $log->meta,
                'createdAt' => optional($log->created_at)?->toIso8601String(),
            ])
            ->all();
    }
}
