<?php

namespace App\Services\Operations;

use App\Enums\TransactionStatus;
use App\Models\ActivityLog;
use App\Models\OpsAlert;
use App\Models\ProductProvider;
use App\Models\Transaction;
use App\Models\Workflow;
use App\Services\Workflow\WorkflowStatsService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class OpsCommandCenterService
{
    public function __construct(
        protected OpsMonitoringService $monitoring,
        protected OpsAlertService $alerts,
        protected WorkflowStatsService $workflowStats
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function overview(): array
    {
        $infra = $this->monitoring->probe();
        $this->alerts->evaluate();

        $txToday = Transaction::query()->whereDate('created_at', today());
        $totalToday = (clone $txToday)->count();
        $successToday = (clone $txToday)->whereIn('status', [
            TransactionStatus::SUCCESS->value, 'sukses', 'success',
        ])->count();
        $failedToday = (clone $txToday)->whereIn('status', [
            TransactionStatus::FAILED->value, 'gagal', 'failed',
        ])->count();
        $pendingToday = (clone $txToday)->whereIn('status', [
            TransactionStatus::PENDING->value, 'pending', 'processing',
        ])->count();

        $successRate = $totalToday > 0 ? round(($successToday / $totalToday) * 100, 2) : 0.0;

        $avgLatency = ProductProvider::query()
            ->whereNotNull('avg_response_ms')
            ->avg('avg_response_ms');

        $providers = ProductProvider::query()
            ->get(['id', 'code', 'name', 'partner_status', 'health_color', 'avg_response_ms', 'is_active'])
            ->map(fn ($p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'partnerStatus' => $p->partner_status,
                'healthColor' => $p->health_color,
                'avgResponseMs' => $p->avg_response_ms,
                'isActive' => (bool) $p->is_active,
            ])
            ->values()
            ->all();

        $openIssues = (int) Workflow::query()
            ->where('current_division', 'operations')
            ->whereNotIn('status', ['resolved', 'closed', 'rejected'])
            ->count();

        $incidentsToday = (int) OpsAlert::query()
            ->whereDate('created_at', today())
            ->whereIn('severity', ['warning', 'critical'])
            ->count();

        $openAlerts = OpsAlert::query()
            ->whereIn('status', ['open', 'acknowledged', 'investigating'])
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (OpsAlert $a) => $this->alerts->payload($a))
            ->all();

        $recentActivity = ActivityLog::query()
            ->where(function ($q) {
                $q->where('activity', 'like', 'WORKFLOW_%')
                    ->orWhere('activity', 'like', 'OPS_%')
                    ->orWhere('activity', 'like', '%PROVIDER%');
            })
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'activity' => $log->activity,
                'userId' => $log->user_id,
                'payload' => $log->payload,
                'createdAt' => optional($log->created_at)?->toIso8601String(),
            ])
            ->all();

        $wfOps = $this->workflowStats->operations();

        return [
            'kpis' => [
                'transactionsToday' => $totalToday,
                'successToday' => $successToday,
                'failedToday' => $failedToday,
                'pendingToday' => $pendingToday,
                'successRate' => $successRate,
                'avgLatencyMs' => $avgLatency !== null ? (int) round((float) $avgLatency) : null,
                'openIssues' => $openIssues,
                'incidentsToday' => $incidentsToday,
                'openAlerts' => (int) OpsAlert::query()->whereIn('status', ['open', 'acknowledged', 'investigating'])->count(),
            ],
            'providerHealth' => $providers,
            'infra' => $infra,
            'alerts' => $openAlerts,
            'workflow' => $wfOps,
            'recentActivity' => $recentActivity,
            'maintenanceQuickActions' => [
                'productProviderControl' => '/dashboard/operations/product-providers',
                'paymentGatewayControl' => '/dashboard/operations/payment-gateways',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function liveTransactions(array $filters = []): LengthAwarePaginator
    {
        $q = Transaction::query()
            ->with(['user:id,name,email'])
            ->orderByDesc('id');

        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['provider'])) {
            $q->where('fulfillment_provider_code', $filters['provider']);
        }
        if (! empty($filters['q'])) {
            $term = '%'.$filters['q'].'%';
            $q->where(function ($w) use ($term) {
                $w->where('invoice_number', 'like', $term)
                    ->orWhere('target_number', 'like', $term)
                    ->orWhere('service_name', 'like', $term);
            });
        }

        return $q->paginate(max(1, min(100, (int) ($filters['per_page'] ?? 30))));
    }

    /**
     * @return array<string, mixed>
     */
    public function transactionPayload(Transaction $tx): array
    {
        $resp = is_array($tx->provider_response) ? $tx->provider_response : [];

        return [
            'id' => $tx->id,
            'invoice' => $tx->invoice_number,
            'serviceName' => $tx->service_name,
            'targetNumber' => $tx->target_number,
            'status' => $tx->status,
            'amount' => (float) $tx->amount,
            'totalPayment' => (float) $tx->total_payment,
            'providerCode' => $tx->fulfillment_provider_code,
            'sku' => $tx->provider_sku_used,
            'providerRef' => $tx->provider_ref,
            'rc' => $resp['rc'] ?? $resp['response_code'] ?? $resp['status'] ?? null,
            'customerName' => $tx->user?->name,
            'createdAt' => optional($tx->created_at)?->toIso8601String(),
            'completedAt' => optional($tx->completed_at)?->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<array<string, mixed>>
     */
    public function activityTimeline(array $filters = []): array
    {
        $q = ActivityLog::query()
            ->where(function ($w) {
                $w->where('activity', 'like', 'WORKFLOW_%')
                    ->orWhere('activity', 'like', 'OPS_%')
                    ->orWhere('activity', 'like', '%PROVIDER%')
                    ->orWhere('activity', 'like', '%SYNC%');
            })
            ->orderByDesc('id')
            ->limit(max(1, min(100, (int) ($filters['limit'] ?? 50))));

        return $q->get()->map(fn (ActivityLog $log) => [
            'id' => $log->id,
            'activity' => $log->activity,
            'userId' => $log->user_id,
            'payload' => $log->payload,
            'createdAt' => optional($log->created_at)?->toIso8601String(),
        ])->all();
    }
}
