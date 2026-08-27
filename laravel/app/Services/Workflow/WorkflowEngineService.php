<?php

namespace App\Services\Workflow;

use App\Contracts\Realtime\RealtimeTransport;
use App\Models\ActivityLog;
use App\Models\ChatMessage;
use App\Models\DivisionNotification;
use App\Models\User;
use App\Models\Workflow;
use App\Models\WorkflowEvent;
use App\Services\Support\ChatService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WorkflowEngineService
{
    public function __construct(
        protected RealtimeTransport $realtime,
        protected ChatService $chat
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $actor, array $data): Workflow
    {
        $division = $data['current_division'] ?? $data['currentDivision'] ?? 'customer_support';
        $category = $data['category'] ?? 'other_ops';
        $priority = $this->normalizePriority($data['priority'] ?? 'medium');
        $source = $data['source'] ?? 'manual';

        if (! in_array($division, Workflow::DIVISIONS, true)) {
            throw ValidationException::withMessages(['current_division' => 'Divisi tidak valid.']);
        }

        $status = $data['status'] ?? Workflow::waitingStatusForDivision($division);

        return DB::transaction(function () use ($actor, $data, $division, $category, $priority, $source, $status) {
            $workflow = Workflow::create([
                'workflow_code' => $this->nextCode(),
                'source' => $source,
                'category' => $category,
                'current_division' => $division,
                'status' => $status,
                'priority' => $priority,
                'title' => $data['title'] ?? 'Workflow',
                'description' => $data['description'] ?? null,
                'created_by' => $actor->id,
                'owner_id' => $data['owner_id'] ?? $data['ownerId'] ?? $actor->id,
                'assigned_to' => $data['assigned_to'] ?? $data['assignedTo'] ?? null,
                'conversation_id' => $data['conversation_id'] ?? $data['conversationId'] ?? null,
                'support_ticket_id' => $data['support_ticket_id'] ?? $data['supportTicketId'] ?? null,
                'transaction_id' => $data['transaction_id'] ?? $data['transactionId'] ?? null,
                'product_id' => $data['product_id'] ?? $data['productId'] ?? null,
                'product_provider_sku_id' => $data['product_provider_sku_id'] ?? $data['productProviderSkuId'] ?? null,
                'meta' => array_merge(
                    is_array($data['meta'] ?? null) ? $data['meta'] : [],
                    $this->buildChatSummaryMeta($data['conversation_id'] ?? $data['conversationId'] ?? null)
                ),
            ]);

            $this->recordEvent($workflow, $actor, [
                'event_type' => 'created',
                'to_division' => $division,
                'to_status' => $status,
                'body' => 'Workflow dibuat: '.$workflow->title,
            ]);

            ActivityLog::create([
                'user_id' => $actor->id,
                'activity' => 'WORKFLOW_CREATED',
                'payload' => [
                    'workflow_id' => $workflow->id,
                    'workflow_code' => $workflow->workflow_code,
                    'division' => $division,
                    'category' => $category,
                ],
            ]);

            $this->notifyDivision($division, 'workflow_new', 'Workflow baru: '.$workflow->title, $workflow);
            $this->publish($workflow, 'WorkflowCreated');

            return $workflow->fresh($this->defaultRelations());
        });
    }

    /**
     * CS escalate from inbox / help — creates workflow routed to target division.
     *
     * @param  array<string, mixed>  $data
     */
    public function createFromCs(User $agent, array $data): Workflow
    {
        $target = $data['target_division'] ?? $data['targetDivision'] ?? null;
        if (! in_array($target, ['operations', 'finance', 'marketing'], true)) {
            throw ValidationException::withMessages(['target_division' => 'Divisi target tidak valid.']);
        }

        $category = $data['category'] ?? $this->defaultCategoryForDivision($target, $data['type'] ?? null);
        $priority = $this->normalizePriority($data['priority'] ?? 'medium');

        $workflow = $this->create($agent, [
            'source' => ($data['conversation_id'] ?? $data['conversationId'] ?? null) ? 'chat' : 'manual',
            'category' => $category,
            'current_division' => $target,
            'status' => Workflow::waitingStatusForDivision($target),
            'priority' => $priority,
            'title' => $data['title'] ?? 'Eskalasi CS',
            'description' => $data['description'] ?? null,
            'conversation_id' => $data['conversation_id'] ?? $data['conversationId'] ?? null,
            'support_ticket_id' => $data['support_ticket_id'] ?? $data['supportTicketId'] ?? null,
            'transaction_id' => $data['transaction_id'] ?? $data['transactionId'] ?? null,
            'product_id' => $data['product_id'] ?? $data['productId'] ?? null,
            'product_provider_sku_id' => $data['product_provider_sku_id'] ?? $data['productProviderSkuId'] ?? null,
            'meta' => array_merge(
                is_array($data['meta'] ?? null) ? $data['meta'] : [],
                [
                    'cs_notes' => $data['description'] ?? null,
                    'escalated_from' => 'customer_support',
                ]
            ),
        ]);

        $this->recordEvent($workflow, $agent, [
            'event_type' => 'escalated',
            'from_division' => 'customer_support',
            'to_division' => $target,
            'from_status' => 'waiting_cs',
            'to_status' => $workflow->status,
            'body' => 'Dieskalasi ke '.ucfirst($target).' oleh CS',
        ]);

        if ($workflow->conversation_id) {
            $conv = $workflow->conversation;
            if ($conv) {
                $this->chat->systemMessage(
                    $conv,
                    'Kasus dieskalasi ke '.ucfirst($target).' ('.$workflow->workflow_code.'): '.$workflow->title
                );
            }
        }

        $this->notifyDivision('customer_support', 'workflow_escalated', 'Eskalasi dikirim: '.$workflow->title, $workflow);
        $this->publish($workflow, 'WorkflowStatusChanged');

        // FR-CS-02 / 06 / 07 — mark linked ticket with explicit escalation status (SRS 7.8).
        if ($workflow->support_ticket_id) {
            $ticket = \App\Models\SupportTicket::query()->find($workflow->support_ticket_id);
            if ($ticket) {
                $ticket->update([
                    'status' => \App\Support\Support\TicketStatus::forEscalationDivision($target),
                ]);
            }
        }

        return $workflow->fresh($this->defaultRelations());
    }

    /**
     * Re-route an existing workflow to another division.
     */
    public function escalate(Workflow $workflow, User $actor, string $targetDivision, ?string $note = null): Workflow
    {
        if (! in_array($targetDivision, ['operations', 'finance', 'marketing', 'admin', 'customer_support'], true)) {
            throw ValidationException::withMessages(['target_division' => 'Divisi target tidak valid.']);
        }

        $fromDivision = $workflow->current_division;
        $fromStatus = $workflow->status;
        $toStatus = Workflow::waitingStatusForDivision($targetDivision === 'admin' ? 'customer_support' : $targetDivision);
        if ($targetDivision === 'admin') {
            $toStatus = 'waiting_cs';
        }

        $workflow->update([
            'current_division' => $targetDivision === 'admin' ? 'admin' : $targetDivision,
            'status' => $targetDivision === 'admin' ? 'waiting_cs' : $toStatus,
            'assigned_to' => null,
            'resolved_at' => null,
        ]);

        $this->recordEvent($workflow, $actor, [
            'event_type' => 'escalated',
            'from_division' => $fromDivision,
            'to_division' => $workflow->current_division,
            'from_status' => $fromStatus,
            'to_status' => $workflow->status,
            'body' => $note ?: ('Diedarkan ke '.$workflow->current_division),
        ]);

        ActivityLog::create([
            'user_id' => $actor->id,
            'activity' => 'WORKFLOW_ESCALATED',
            'payload' => [
                'workflow_id' => $workflow->id,
                'from' => $fromDivision,
                'to' => $workflow->current_division,
            ],
        ]);

        $this->notifyDivision(
            $workflow->current_division === 'admin' ? 'customer_support' : $workflow->current_division,
            'workflow_new',
            'Workflow masuk antrian: '.$workflow->title,
            $workflow
        );
        $this->notifyDivision('customer_support', 'workflow_update', 'Workflow diarahkan ulang: '.$workflow->workflow_code, $workflow);
        $this->publish($workflow, 'WorkflowStatusChanged');

        return $workflow->fresh($this->defaultRelations());
    }

    public function assign(Workflow $workflow, User $actor, User $assignee, bool $reassign = false): Workflow
    {
        $workflow->update(['assigned_to' => $assignee->id]);

        $this->recordEvent($workflow, $actor, [
            'event_type' => $reassign ? 'reassigned' : 'assigned',
            'body' => ($reassign ? 'Reassign' : 'Assign').' ke '.$assignee->name,
            'payload' => ['assigned_to' => $assignee->id],
        ]);

        ActivityLog::create([
            'user_id' => $actor->id,
            'activity' => $reassign ? 'WORKFLOW_REASSIGNED' : 'WORKFLOW_ASSIGNED',
            'payload' => [
                'workflow_id' => $workflow->id,
                'assigned_to' => $assignee->id,
            ],
        ]);

        $this->publish($workflow, 'WorkflowAssigned');

        return $workflow->fresh($this->defaultRelations());
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    public function transitionStatus(
        Workflow $workflow,
        User $actor,
        string $toStatus,
        ?string $note = null,
        string $eventType = 'status_changed',
        ?string $action = null,
        array $extra = []
    ): Workflow {
        if (! in_array($toStatus, Workflow::STATUSES, true)) {
            throw ValidationException::withMessages(['status' => 'Status tidak valid.']);
        }

        $fromStatus = $workflow->status;
        $updates = [
            'status' => $toStatus,
            'assigned_to' => $workflow->assigned_to ?: $actor->id,
        ];

        if (in_array($toStatus, ['resolved', 'rejected', 'cancelled', 'closed'], true)) {
            $updates['resolved_at'] = now();
            if ($toStatus !== 'closed') {
                $updates['current_division'] = 'customer_support';
            }
        }

        if (! empty($extra['meta']) && is_array($extra['meta'])) {
            $updates['meta'] = array_merge($workflow->meta ?? [], $extra['meta']);
        }

        $workflow->update($updates);

        $this->recordEvent($workflow, $actor, [
            'event_type' => $eventType,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'from_division' => $extra['from_division'] ?? null,
            'to_division' => $workflow->current_division,
            'action' => $action,
            'body' => $note ?: ('Status: '.$fromStatus.' → '.$toStatus),
            'payload' => $extra['payload'] ?? null,
        ]);

        ActivityLog::create([
            'user_id' => $actor->id,
            'activity' => 'WORKFLOW_STATUS_CHANGED',
            'payload' => [
                'workflow_id' => $workflow->id,
                'from' => $fromStatus,
                'to' => $toStatus,
                'action' => $action,
            ],
        ]);

        $this->notifyDivision('customer_support', 'workflow_update', 'Workflow diupdate: '.$workflow->workflow_code, $workflow);

        // FR-CS-02 / FR-CS-08 — when escalation resolves, return ticket to resolved for CS follow-up.
        if ($workflow->support_ticket_id && in_array($toStatus, ['resolved', 'rejected', 'closed'], true)) {
            $ticket = \App\Models\SupportTicket::query()->find($workflow->support_ticket_id);
            if ($ticket) {
                $ticket->update([
                    'status' => $toStatus === 'closed'
                        ? \App\Support\Support\TicketStatus::CLOSED
                        : \App\Support\Support\TicketStatus::RESOLVED,
                    'resolved_at' => now(),
                ]);
            }
        }

        if ($workflow->conversation_id && in_array($toStatus, ['resolved', 'rejected', 'closed'], true)) {
            $conv = $workflow->conversation;
            if ($conv) {
                $this->chat->systemMessage(
                    $conv,
                    'Update workflow '.$workflow->workflow_code.': '.str_replace('_', ' ', $toStatus)
                    .($note ? ' — '.$note : '')
                );
            }
        }

        $eventName = in_array($toStatus, ['resolved', 'rejected', 'closed'], true)
            ? 'WorkflowResolved'
            : 'WorkflowStatusChanged';
        $this->publish($workflow, $eventName);

        return $workflow->fresh($this->defaultRelations());
    }

    public function close(Workflow $workflow, User $actor, ?string $note = null): Workflow
    {
        return $this->transitionStatus($workflow, $actor, 'closed', $note ?: 'Ditutup', 'closed');
    }

    public function forceResolve(Workflow $workflow, User $actor, ?string $note = null): Workflow
    {
        return $this->transitionStatus(
            $workflow,
            $actor,
            'resolved',
            $note ?: 'Force resolve oleh Admin',
            'overridden',
            'force_resolve'
        );
    }

    public function overrideStatus(Workflow $workflow, User $actor, string $status, ?string $note = null): Workflow
    {
        return $this->transitionStatus($workflow, $actor, $status, $note ?: 'Override Admin', 'overridden', 'override');
    }

    /**
     * Record action without necessarily changing status.
     *
     * @param  array<string, mixed>  $payload
     */
    public function recordAction(
        Workflow $workflow,
        User $actor,
        string $action,
        ?string $body = null,
        array $payload = [],
        ?array $metaMerge = null
    ): WorkflowEvent {
        if ($metaMerge) {
            $workflow->update(['meta' => array_merge($workflow->meta ?? [], $metaMerge)]);
        }

        $event = $this->recordEvent($workflow, $actor, [
            'event_type' => 'action_executed',
            'action' => $action,
            'body' => $body ?: ('Aksi: '.$action),
            'payload' => $payload,
        ]);

        ActivityLog::create([
            'user_id' => $actor->id,
            'activity' => 'WORKFLOW_ACTION_EXECUTED',
            'payload' => [
                'workflow_id' => $workflow->id,
                'action' => $action,
                'payload' => $payload,
            ],
        ]);

        $this->notifyDivision('customer_support', 'workflow_update', 'Aksi workflow: '.$action.' — '.$workflow->workflow_code, $workflow);
        $this->publish($workflow->fresh($this->defaultRelations()), 'WorkflowActionExecuted');

        return $event;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function recordEvent(Workflow $workflow, ?User $actor, array $data): WorkflowEvent
    {
        return WorkflowEvent::create([
            'workflow_id' => $workflow->id,
            'actor_id' => $actor?->id,
            'event_type' => $data['event_type'] ?? 'note_added',
            'from_division' => $data['from_division'] ?? null,
            'to_division' => $data['to_division'] ?? null,
            'from_status' => $data['from_status'] ?? null,
            'to_status' => $data['to_status'] ?? null,
            'action' => $data['action'] ?? null,
            'body' => $data['body'] ?? null,
            'payload' => $data['payload'] ?? null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(Workflow $workflow): array
    {
        $workflow->loadMissing($this->defaultRelations());

        return [
            'id' => $workflow->id,
            'workflowCode' => $workflow->workflow_code,
            'source' => $workflow->source,
            'category' => $workflow->category,
            'currentDivision' => $workflow->current_division,
            'status' => $workflow->status,
            'priority' => $workflow->priority,
            'title' => $workflow->title,
            'description' => $workflow->description,
            'createdBy' => $workflow->created_by,
            'createdByName' => $workflow->creator?->name,
            'ownerId' => $workflow->owner_id,
            'assignedTo' => $workflow->assigned_to,
            'assignedToName' => $workflow->assignee?->name,
            'conversationId' => $workflow->conversation_id,
            'supportTicketId' => $workflow->support_ticket_id,
            'transactionId' => $workflow->transaction_id,
            'productId' => $workflow->product_id,
            'productProviderSkuId' => $workflow->product_provider_sku_id,
            'meta' => $workflow->meta,
            'resolvedAt' => optional($workflow->resolved_at)?->toIso8601String(),
            'createdAt' => optional($workflow->created_at)?->toIso8601String(),
            'updatedAt' => optional($workflow->updated_at)?->toIso8601String(),
            'events' => $workflow->relationLoaded('events')
                ? $workflow->events->map(fn (WorkflowEvent $e) => $this->eventPayload($e))->values()->all()
                : [],
            'transaction' => $workflow->transaction ? [
                'id' => $workflow->transaction->id,
                'invoice' => $workflow->transaction->invoice_number ?? null,
                'status' => $workflow->transaction->status,
                'totalPayment' => $workflow->transaction->total_payment,
                'customerName' => $workflow->transaction->user?->name,
                'customerEmail' => $workflow->transaction->user?->email,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function eventPayload(WorkflowEvent $event): array
    {
        return [
            'id' => $event->id,
            'eventType' => $event->event_type,
            'fromDivision' => $event->from_division,
            'toDivision' => $event->to_division,
            'fromStatus' => $event->from_status,
            'toStatus' => $event->to_status,
            'action' => $event->action,
            'body' => $event->body,
            'payload' => $event->payload,
            'actorId' => $event->actor_id,
            'actorName' => $event->actor?->name,
            'createdAt' => optional($event->created_at)?->toIso8601String(),
        ];
    }

    public function normalizePriority(mixed $priority): string
    {
        $p = strtolower((string) $priority);
        $map = [
            'rendah' => 'low',
            'sedang' => 'medium',
            'tinggi' => 'high',
            'kritis' => 'critical',
            'low' => 'low',
            'medium' => 'medium',
            'high' => 'high',
            'critical' => 'critical',
        ];

        return $map[$p] ?? 'medium';
    }

    public function defaultCategoryForDivision(string $division, ?string $legacyType = null): string
    {
        if ($legacyType) {
            return match ($legacyType) {
                'provider_issue' => 'provider_failure',
                'refund_request' => 'refund_request',
                'feedback' => 'suggestion',
                default => match ($division) {
                    'finance' => 'refund_request',
                    'marketing' => 'suggestion',
                    default => 'other_ops',
                },
            };
        }

        return match ($division) {
            'finance' => 'refund_request',
            'marketing' => 'suggestion',
            'operations' => 'provider_failure',
            default => 'other_ops',
        };
    }

    /**
     * @return list<string>
     */
    public function defaultRelations(): array
    {
        return ['creator:id,name', 'assignee:id,name', 'owner:id,name', 'events.actor:id,name', 'transaction.user:id,name,email'];
    }

    protected function nextCode(): string
    {
        $date = now()->format('Ymd');
        $seq = Workflow::withTrashed()->whereDate('created_at', today())->count() + 1;

        return sprintf('WF-%s-%04d', $date, $seq);
    }

    /**
     * @return array<string, mixed>
     */
    protected function buildChatSummaryMeta(mixed $conversationId): array
    {
        if (! $conversationId) {
            return [];
        }

        $messages = ChatMessage::query()
            ->where('conversation_id', $conversationId)
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->reverse()
            ->values();

        if ($messages->isEmpty()) {
            return [];
        }

        $summary = $messages->map(function (ChatMessage $m) {
            return '['.($m->sender_role).'] '.mb_substr((string) $m->body, 0, 200);
        })->implode("\n");

        return [
            'chat_summary' => mb_substr($summary, 0, 4000),
            'chat_message_count' => $messages->count(),
        ];
    }

    protected function notifyDivision(string $role, string $type, string $title, Workflow $workflow): void
    {
        $role = $role === 'admin' ? 'owner' : $role;

        DivisionNotification::create([
            'role' => $role,
            'type' => $type,
            'title' => $title,
            'body' => $workflow->description,
            'payload' => [
                'workflow_id' => $workflow->id,
                'workflow_code' => $workflow->workflow_code,
                'status' => $workflow->status,
                'division' => $workflow->current_division,
            ],
            'related_type' => 'workflow',
            'related_id' => $workflow->id,
        ]);
    }

    protected function publish(Workflow $workflow, string $event): void
    {
        $payload = $this->payload($workflow);
        $this->realtime->publish('workflow.'.$workflow->id, $event, $payload);

        $div = $workflow->current_division;
        if ($div === 'admin') {
            $this->realtime->publish('division.customer_support', $event, $payload);
        } elseif (in_array($div, ['operations', 'finance', 'marketing', 'customer_support'], true)) {
            $this->realtime->publish('division.'.$div, $event, $payload);
        }

        $this->realtime->publish('division.customer_support', $event, $payload);
    }
}
