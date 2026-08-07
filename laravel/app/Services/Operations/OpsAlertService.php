<?php

namespace App\Services\Operations;

use App\Contracts\Realtime\RealtimeTransport;
use App\Models\DivisionNotification;
use App\Models\OpsAlert;
use App\Models\ProductProvider;
use App\Models\User;
use App\Models\Workflow;
use App\Services\Payment\PaymentGatewayControlService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class OpsAlertService
{
    public function __construct(
        protected RealtimeTransport $realtime,
        protected OpsMonitoringService $monitoring,
        protected PaymentGatewayControlService $gateways
    ) {}

    /**
     * @return list<OpsAlert>
     */
    public function evaluate(): array
    {
        $created = [];
        $infra = $this->monitoring->probe();

        if (($infra['redis']['status'] ?? '') === 'down') {
            $a = $this->upsertOpen('redis_down', 'critical', 'Redis unreachable', 'Redis connection probe failed.', ['probe' => $infra['redis']], 'infra', null);
            if ($a) {
                $created[] = $a;
            }
        }
        if (($infra['database']['status'] ?? '') === 'down') {
            $a = $this->upsertOpen('db_unreachable', 'critical', 'Database unreachable', 'DB ping failed.', ['probe' => $infra['database']], 'infra', null);
            if ($a) {
                $created[] = $a;
            }
        }
        if (($infra['scheduler']['status'] ?? '') === 'stale') {
            $a = $this->upsertOpen('scheduler_failed', 'warning', 'Scheduler heartbeat stale', 'No ops heartbeat within 15 minutes.', ['probe' => $infra['scheduler']], 'infra', null);
            if ($a) {
                $created[] = $a;
            }
        }
        $failedJobs = (int) ($infra['failed_jobs']['value'] ?? 0);
        if ($failedJobs >= 10) {
            $a = $this->upsertOpen('queue_delay', 'warning', 'Failed jobs elevated', "Failed jobs count: {$failedJobs}", ['count' => $failedJobs], 'queue', null);
            if ($a) {
                $created[] = $a;
            }
        }

        foreach (ProductProvider::query()->get() as $provider) {
            $status = strtolower((string) ($provider->partner_status ?? ''));
            if (in_array($status, ['offline', 'down', 'error'], true) || ($provider->health_color ?? '') === 'red') {
                $a = $this->upsertOpen(
                    'provider_offline',
                    'critical',
                    'Provider issue: '.$provider->name,
                    'Status: '.$status,
                    ['provider_id' => $provider->id, 'code' => $provider->code],
                    'product_provider',
                    $provider->id
                );
                if ($a) {
                    $created[] = $a;
                }
            }
            $latency = $provider->avg_response_ms !== null ? (int) $provider->avg_response_ms : null;
            if ($latency !== null && $latency > 3000) {
                $a = $this->upsertOpen(
                    'latency_high',
                    'warning',
                    'High latency: '.$provider->name,
                    "avg_response_ms={$latency}",
                    ['provider_id' => $provider->id, 'latency' => $latency],
                    'product_provider',
                    $provider->id
                );
                if ($a) {
                    $created[] = $a;
                }
            }
        }

        foreach ($this->gateways->listControlCenter() as $gw) {
            $status = strtolower((string) ($gw['status'] ?? $gw['partner_status'] ?? ''));
            if (in_array($status, ['offline', 'error', 'down'], true)) {
                $a = $this->upsertOpen(
                    'gateway_error',
                    'critical',
                    'Gateway offline: '.($gw['name'] ?? $gw['code'] ?? 'unknown'),
                    'Status: '.$status,
                    ['gateway' => $gw],
                    'payment_gateway',
                    null
                );
                if ($a) {
                    $created[] = $a;
                }
            }
        }

        $backlog = Workflow::query()
            ->where('current_division', 'operations')
            ->where('status', 'waiting_operations')
            ->where('created_at', '<', now()->subHours(24))
            ->count();
        if ($backlog > 0) {
            $a = $this->upsertOpen(
                'workflow_backlog',
                'warning',
                'Ops workflow backlog',
                "{$backlog} issues waiting > 24h",
                ['count' => $backlog],
                null,
                null
            );
            if ($a) {
                $created[] = $a;
            }
        }

        return $created;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function upsertOpen(
        string $type,
        string $severity,
        string $title,
        string $body,
        array $payload,
        ?string $relatedType,
        ?int $relatedId
    ): ?OpsAlert {
        $q = OpsAlert::query()->where('type', $type)->whereIn('status', ['open', 'acknowledged', 'investigating']);
        if ($relatedType && $relatedId) {
            $q->where('related_type', $relatedType)->where('related_id', $relatedId);
        } else {
            $q->whereDate('created_at', today())->whereNull('related_id');
        }
        $existing = $q->first();
        if ($existing) {
            $existing->update([
                'severity' => $severity,
                'title' => $title,
                'body' => $body,
                'payload' => $payload,
            ]);

            return null;
        }

        $alert = OpsAlert::create([
            'alert_code' => sprintf('OPS-ALT-%s-%04d', now()->format('Ymd'), OpsAlert::query()->whereDate('created_at', today())->count() + 1),
            'type' => $type,
            'severity' => $severity,
            'title' => $title,
            'body' => $body,
            'payload' => $payload,
            'status' => 'open',
            'source' => 'monitor',
            'related_type' => $relatedType,
            'related_id' => $relatedId,
        ]);

        DivisionNotification::create([
            'role' => 'operations',
            'type' => 'ops_alert',
            'title' => $title,
            'body' => $body,
            'payload' => ['alert_id' => $alert->id, 'severity' => $severity],
            'related_type' => 'ops_alert',
            'related_id' => $alert->id,
        ]);
        $this->realtime->publish('division.operations', 'OpsAlertCreated', $this->payload($alert));

        return $alert;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator
    {
        $q = OpsAlert::query()
            ->with(['assignee:id,name'])
            ->orderByRaw("CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END")
            ->orderByDesc('id');

        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['severity'])) {
            $q->where('severity', $filters['severity']);
        }
        if (! empty($filters['type'])) {
            $q->where('type', $filters['type']);
        }

        return $q->paginate(max(1, min(100, (int) ($filters['per_page'] ?? 30))));
    }

    public function transition(OpsAlert $alert, User $actor, string $status): OpsAlert
    {
        if (! in_array($status, OpsAlert::STATUSES, true)) {
            throw ValidationException::withMessages(['status' => 'Status tidak valid.']);
        }

        $from = $alert->status;
        $allowed = [
            'open' => ['acknowledged', 'investigating', 'resolved', 'closed'],
            'acknowledged' => ['investigating', 'resolved', 'closed'],
            'investigating' => ['resolved', 'closed', 'acknowledged'],
            'resolved' => ['closed'],
            'closed' => [],
        ];
        if ($from !== $status && ! in_array($status, $allowed[$from] ?? [], true)) {
            throw ValidationException::withMessages(['status' => "Transisi {$from} → {$status} tidak diizinkan."]);
        }

        $updates = ['status' => $status, 'assigned_to' => $alert->assigned_to ?: $actor->id];
        if ($status === 'acknowledged') {
            $updates['acknowledged_at'] = now();
        }
        if ($status === 'resolved') {
            $updates['resolved_at'] = now();
        }
        if ($status === 'closed') {
            $updates['closed_at'] = now();
            $updates['resolved_at'] = $alert->resolved_at ?: now();
        }
        $alert->update($updates);

        $this->realtime->publish('division.operations', 'OpsAlertUpdated', $this->payload($alert->fresh()));

        return $alert->fresh(['assignee']);
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(OpsAlert $a): array
    {
        return [
            'id' => $a->id,
            'alertCode' => $a->alert_code,
            'type' => $a->type,
            'severity' => $a->severity,
            'title' => $a->title,
            'body' => $a->body,
            'payload' => $a->payload,
            'status' => $a->status,
            'source' => $a->source,
            'relatedType' => $a->related_type,
            'relatedId' => $a->related_id,
            'assignedTo' => $a->assigned_to,
            'assignedToName' => $a->assignee?->name,
            'acknowledgedAt' => optional($a->acknowledged_at)?->toIso8601String(),
            'resolvedAt' => optional($a->resolved_at)?->toIso8601String(),
            'closedAt' => optional($a->closed_at)?->toIso8601String(),
            'createdAt' => optional($a->created_at)?->toIso8601String(),
        ];
    }
}
