<?php

namespace App\Services\Support;

use App\Contracts\Realtime\RealtimeTransport;
use App\Models\ActivityLog;
use App\Models\DivisionNotification;
use App\Models\SupportEscalation;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class EscalationService
{
    public function __construct(
        protected RealtimeTransport $realtime,
        protected ChatService $chat
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $agent, array $data): SupportEscalation
    {
        $division = $data['target_division'] ?? $data['targetDivision'] ?? null;
        $type = $data['type'] ?? 'other';

        if (! in_array($division, ['operations', 'finance', 'marketing'], true)) {
            throw ValidationException::withMessages(['target_division' => 'Divisi target tidak valid.']);
        }

        $escalation = SupportEscalation::create([
            'conversation_id' => $data['conversation_id'] ?? $data['conversationId'] ?? null,
            'support_ticket_id' => $data['support_ticket_id'] ?? $data['supportTicketId'] ?? null,
            'transaction_id' => $data['transaction_id'] ?? $data['transactionId'] ?? null,
            'from_user_id' => $agent->id,
            'target_division' => $division,
            'type' => $type,
            'title' => $data['title'] ?? 'Escalation',
            'description' => $data['description'] ?? null,
            'priority' => $data['priority'] ?? 'Sedang',
            'status' => 'open',
        ]);

        ActivityLog::create([
            'user_id' => $agent->id,
            'activity' => 'ESCALATION_CREATED',
            'payload' => [
                'escalation_id' => $escalation->id,
                'target_division' => $division,
                'type' => $type,
            ],
        ]);

        DivisionNotification::create([
            'role' => $division,
            'type' => 'escalation_new',
            'title' => 'Eskalasi baru: '.$escalation->title,
            'body' => $escalation->description,
            'payload' => ['escalation_id' => $escalation->id],
            'related_type' => 'support_escalation',
            'related_id' => $escalation->id,
        ]);

        $this->realtime->publish('division.'.$division, 'EscalationCreated', $this->payload($escalation));
        $this->realtime->publish('division.customer_support', 'EscalationCreated', $this->payload($escalation));

        if ($escalation->conversation_id) {
            $conv = $escalation->conversation;
            if ($conv) {
                $this->chat->systemMessage(
                    $conv,
                    'Kasus dieskalasi ke '.ucfirst($division).': '.$escalation->title
                );
            }
        }

        return $escalation->fresh(['fromUser', 'conversation', 'ticket', 'transaction']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateStatus(SupportEscalation $escalation, User $actor, array $data): SupportEscalation
    {
        $status = $data['status'] ?? null;
        if (! in_array($status, ['open', 'in_progress', 'resolved', 'rejected', 'closed'], true)) {
            throw ValidationException::withMessages(['status' => 'Status tidak valid.']);
        }

        $role = $actor->role instanceof \App\Enums\UserRole ? $actor->role->value : (string) $actor->role;
        $allowed = match ($escalation->target_division) {
            'operations' => ['operations', 'owner', 'super_admin'],
            'finance' => ['finance', 'owner', 'super_admin'],
            'marketing' => ['marketing', 'owner', 'super_admin'],
            default => ['owner', 'super_admin'],
        };
        if (! in_array($role, $allowed, true)) {
            abort(403, 'Anda tidak berwenang mengubah eskalasi divisi ini.');
        }

        $escalation->update([
            'status' => $status,
            'resolution_note' => $data['resolution_note'] ?? $data['resolutionNote'] ?? $escalation->resolution_note,
            'assigned_to' => $escalation->assigned_to ?: $actor->id,
            'resolved_at' => in_array($status, ['resolved', 'rejected', 'closed'], true) ? now() : null,
        ]);

        ActivityLog::create([
            'user_id' => $actor->id,
            'activity' => 'ESCALATION_STATUS_UPDATED',
            'payload' => [
                'escalation_id' => $escalation->id,
                'status' => $status,
            ],
        ]);

        DivisionNotification::create([
            'role' => 'customer_support',
            'type' => 'escalation_update',
            'title' => 'Update eskalasi: '.$escalation->title,
            'body' => 'Status: '.$status,
            'payload' => ['escalation_id' => $escalation->id, 'status' => $status],
            'related_type' => 'support_escalation',
            'related_id' => $escalation->id,
        ]);

        $this->realtime->publish('division.customer_support', 'EscalationStatusUpdated', $this->payload($escalation));
        $this->realtime->publish('division.'.$escalation->target_division, 'EscalationStatusUpdated', $this->payload($escalation));

        if ($escalation->conversation_id && $escalation->conversation) {
            $this->chat->systemMessage(
                $escalation->conversation,
                'Update eskalasi ('.ucfirst($escalation->target_division).'): status '.$status
                    .($escalation->resolution_note ? ' — '.$escalation->resolution_note : '')
            );
            $this->realtime->publish(
                'user.notifications.'.$escalation->conversation->user_id,
                'EscalationStatusUpdated',
                $this->payload($escalation)
            );
        }

        return $escalation->fresh(['fromUser', 'assignee', 'conversation']);
    }

    /**
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator
     */
    public function listForDivision(string $division, ?string $status = null, int $perPage = 30)
    {
        $q = SupportEscalation::query()
            ->with(['fromUser:id,name', 'assignee:id,name', 'conversation', 'ticket', 'transaction'])
            ->where('target_division', $division)
            ->orderByDesc('id');

        if ($status && $status !== 'all') {
            $q->where('status', $status);
        }

        return $q->paginate($perPage);
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(SupportEscalation $e): array
    {
        return [
            'id' => $e->id,
            'conversationId' => $e->conversation_id,
            'supportTicketId' => $e->support_ticket_id,
            'transactionId' => $e->transaction_id,
            'fromUserId' => $e->from_user_id,
            'fromUserName' => $e->fromUser?->name,
            'targetDivision' => $e->target_division,
            'type' => $e->type,
            'title' => $e->title,
            'description' => $e->description,
            'priority' => $e->priority,
            'status' => $e->status,
            'resolutionNote' => $e->resolution_note,
            'assignedTo' => $e->assigned_to,
            'resolvedAt' => optional($e->resolved_at)?->toIso8601String(),
            'createdAt' => optional($e->created_at)?->toIso8601String(),
            'updatedAt' => optional($e->updated_at)?->toIso8601String(),
        ];
    }
}
