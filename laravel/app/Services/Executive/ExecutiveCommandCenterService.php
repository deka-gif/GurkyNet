<?php

namespace App\Services\Executive;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\Conversation;
use App\Models\FinanceAlert;
use App\Models\HomepageSection;
use App\Models\OpsAlert;
use App\Models\ProductProvider;
use App\Models\Setting;
use App\Models\SupportTicket;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Workflow;
use App\Models\WorkflowEvent;
use App\Repositories\Contracts\MarketingRepositoryInterface;
use App\Repositories\Contracts\OwnerRepositoryInterface;
use App\Services\Finance\FinanceAlertService;
use App\Services\Finance\FinanceReportService;
use App\Services\Finance\FinanceTreasuryService;
use App\Services\Operations\OpsAlertService;
use App\Services\Operations\OpsCommandCenterService;
use App\Services\Operations\OpsMonitoringService;
use App\Services\Workflow\WorkflowEngineService;
use App\Services\Workflow\WorkflowStatsService;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 8.5 — Owner Executive Command Center (read-mostly aggregates).
 * Composes Finance/Ops/CS/Marketing/Workflow SSOT — no dummy KPIs.
 */
class ExecutiveCommandCenterService
{
    public function __construct(
        protected OwnerRepositoryInterface $ownerRepo,
        protected FinanceTreasuryService $treasury,
        protected FinanceReportService $reports,
        protected FinanceAlertService $financeAlerts,
        protected OpsCommandCenterService $opsCc,
        protected OpsMonitoringService $opsMonitoring,
        protected OpsAlertService $opsAlerts,
        protected WorkflowStatsService $workflowStats,
        protected WorkflowEngineService $workflows,
        protected MarketingRepositoryInterface $marketing
    ) {}

    /**
     * Full executive payload for Command Center dashboard.
     *
     * @return array<string, mixed>
     */
    public function overview(): array
    {
        $legacy = $this->ownerRepo->getDashboardMetrics();
        $treasury = $this->treasury->snapshot();
        $profit = $this->profitMonitor();
        $ops = $this->opsCc->overview();
        $infra = $ops['infra'] ?? $this->opsMonitoring->probe();
        $wfAdmin = $this->workflowStats->admin();
        $wfOps = $this->workflowStats->operations();
        $wfFin = $this->workflowStats->finance();
        $wfMkt = $this->workflowStats->marketing();
        $wfCs = $this->workflowStats->customerSupport();
        $marketing = $this->marketing->getDashboardMetrics();
        $divisions = $this->crossDivisionOverview($wfOps, $wfFin, $wfMkt, $wfCs, $treasury, $ops, $marketing);
        $alerts = $this->executiveAlerts(20);
        $risks = $this->risks($treasury, $ops, $infra, $wfOps, $wfFin);
        $health = $this->businessHealth($legacy, $ops, $infra, $wfAdmin, $treasury, $profit, $wfCs);
        $insights = $this->insights($legacy, $profit, $ops, $treasury);
        $goals = $this->goals($legacy, $profit);
        $workflowMonitor = $this->workflowMonitor();
        $timeline = $this->workflowTimeline(25);
        $approvals = $this->pendingApprovals();

        return [
            // Keep legacy keys for OwnerTest / older clients
            ...$this->legacyDashboardKeys($legacy),
            'businessHealth' => $health,
            'headline' => $this->headlineAnswers($legacy, $health, $alerts, $risks, $treasury, $profit, $ops, $wfAdmin),
            'crossDivision' => $divisions,
            'alerts' => $alerts,
            'risks' => $risks,
            'insights' => $insights,
            'goals' => $goals,
            'treasury' => $this->treasurySummary($treasury),
            'profit' => $profit,
            'workflowMonitor' => $workflowMonitor,
            'timeline' => $timeline,
            'approvals' => $approvals,
            'analytics' => $this->ownerRepo->getFinancialOverview(),
            'quickAccess' => [
                ['label' => 'Finance', 'path' => '/dashboard/finance'],
                ['label' => 'Operations', 'path' => '/dashboard/operations'],
                ['label' => 'Marketing', 'path' => '/dashboard/marketing'],
                ['label' => 'Customer Support', 'path' => '/dashboard/customer-support'],
                ['label' => 'Global Workflows', 'path' => '/dashboard/owner/workflows'],
                ['label' => 'Treasury', 'path' => '/dashboard/finance/treasury'],
                ['label' => 'Audit', 'path' => '/dashboard/owner/audit'],
                ['label' => 'Notifications', 'path' => '/dashboard/notifikasi'],
            ],
            'generatedAt' => now()->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $legacy
     * @return array<string, mixed>
     */
    protected function legacyDashboardKeys(array $legacy): array
    {
        return [
            'today_revenue' => $legacy['today_revenue'] ?? 0,
            'monthly_revenue' => $legacy['monthly_revenue'] ?? 0,
            'total_users' => $legacy['total_users'] ?? 0,
            'active_users' => $legacy['active_users'] ?? 0,
            'total_transactions' => $legacy['total_transactions'] ?? 0,
            'success_rate' => $legacy['success_rate'],
            'failed_rate' => $legacy['failed_rate'],
            'wallet_balance' => $legacy['wallet_balance'] ?? 0,
            'provider_health' => $legacy['provider_health'] ?? null,
            'provider_balance' => $legacy['provider_balance'] ?? null,
            'digiflazz_balance' => $legacy['digiflazz_balance'] ?? null,
            'queue_status' => $legacy['queue_status'] ?? null,
            'system_health' => $legacy['system_health'] ?? null,
            'today_revenue_change' => $legacy['today_revenue_change'] ?? null,
            'monthly_revenue_change' => $legacy['monthly_revenue_change'] ?? null,
            'users_change' => $legacy['users_change'] ?? null,
            'today_transactions' => $legacy['today_transactions'] ?? 0,
            'top_products' => $legacy['top_products'] ?? [],
            'top_customers' => $legacy['top_customers'] ?? [],
            'revenue_chart' => $legacy['revenue_chart'] ?? [],
            'transaction_chart' => $legacy['transaction_chart'] ?? [],
            'ops_overview' => $legacy['ops_overview'] ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function profitMonitor(): array
    {
        $report = $this->reports->generate([
            'start_date' => now()->startOfMonth()->toDateString(),
            'end_date' => now()->toDateString(),
        ]);
        $today = $this->reports->generate([
            'start_date' => now()->toDateString(),
            'end_date' => now()->toDateString(),
        ]);

        $income = $report['incomeStatement'] ?? [];
        $revenue = (float) ($income['revenue'] ?? 0);
        $providerCost = (float) ($income['providerCost'] ?? 0);
        $gatewayFee = (float) ($report['gatewayFee'] ?? 0);
        $refundCost = (float) ($report['refundCost'] ?? 0);
        $grossProfit = (float) ($income['grossProfit'] ?? ($revenue - $providerCost));
        $netProfit = (float) ($income['netProfit'] ?? 0);
        $marginPct = $revenue > 0 ? round(($netProfit / $revenue) * 100, 2) : null;

        return [
            'period' => $report['period'] ?? null,
            'grossRevenue' => $revenue,
            'netRevenue' => $revenue - $refundCost,
            'providerCost' => $providerCost,
            'gatewayFee' => $gatewayFee,
            'refundCost' => $refundCost,
            'operationalCost' => null, // no OpEx ledger yet
            'grossProfit' => $grossProfit,
            'netProfit' => $netProfit,
            'profitMargin' => $marginPct,
            'ebitda' => null, // not available — no OpEx engine
            'today' => [
                'grossRevenue' => (float) ($today['incomeStatement']['revenue'] ?? 0),
                'netProfit' => (float) ($today['incomeStatement']['netProfit'] ?? 0),
                'refundCost' => (float) ($today['refundCost'] ?? 0),
            ],
            'growth' => $report['growth'] ?? null,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function executiveAlerts(int $limit = 30): array
    {
        $this->financeAlerts->evaluate();
        $this->opsAlerts->evaluate();

        $items = [];

        foreach (
            FinanceAlert::query()
                ->whereIn('status', ['open', 'acknowledged'])
                ->orderByDesc('id')
                ->limit($limit)
                ->get() as $a
        ) {
            $items[] = [
                'id' => 'fin-'.$a->id,
                'source' => 'finance',
                'sourceDivision' => 'finance',
                'severity' => $a->severity,
                'title' => $a->title,
                'body' => $a->body,
                'status' => $a->status,
                'type' => $a->type,
                'impact' => $a->severity === 'critical' ? 'high' : ($a->severity === 'warning' ? 'medium' : 'low'),
                'handledBy' => null,
                'estimatedResolution' => null,
                'workflowId' => $a->workflow_id,
                'drillDown' => '/dashboard/finance/alerts',
                'createdAt' => optional($a->created_at)?->toIso8601String(),
            ];
        }

        foreach (
            OpsAlert::query()
                ->whereIn('status', ['open', 'acknowledged', 'investigating'])
                ->orderByDesc('id')
                ->limit($limit)
                ->get() as $a
        ) {
            $items[] = [
                'id' => 'ops-'.$a->id,
                'source' => 'operations',
                'sourceDivision' => 'operations',
                'severity' => $a->severity,
                'title' => $a->title,
                'body' => $a->body,
                'status' => $a->status,
                'type' => $a->type,
                'impact' => $a->severity === 'critical' ? 'high' : ($a->severity === 'warning' ? 'medium' : 'low'),
                'handledBy' => $a->assigned_to,
                'estimatedResolution' => null,
                'workflowId' => $a->workflow_id,
                'drillDown' => '/dashboard/operations/alerts',
                'createdAt' => optional($a->created_at)?->toIso8601String(),
            ];
        }

        foreach (
            Workflow::query()
                ->where('priority', 'critical')
                ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                ->orderByDesc('id')
                ->limit(15)
                ->get() as $w
        ) {
            $items[] = [
                'id' => 'wf-'.$w->id,
                'source' => 'workflow',
                'sourceDivision' => $w->current_division,
                'severity' => 'critical',
                'title' => $w->title,
                'body' => $w->description,
                'status' => $w->status,
                'type' => $w->category,
                'impact' => 'high',
                'handledBy' => $w->assigned_to,
                'estimatedResolution' => null,
                'workflowId' => $w->id,
                'drillDown' => '/dashboard/owner/workflows',
                'createdAt' => optional($w->created_at)?->toIso8601String(),
            ];
        }

        usort($items, function ($a, $b) {
            $rank = ['critical' => 0, 'warning' => 1, 'info' => 2];
            $ra = $rank[$a['severity']] ?? 3;
            $rb = $rank[$b['severity']] ?? 3;
            if ($ra !== $rb) {
                return $ra <=> $rb;
            }

            return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
        });

        return array_slice($items, 0, $limit);
    }

    /**
     * @param  array<string, mixed>  $treasury
     * @param  array<string, mixed>  $ops
     * @param  array<string, mixed>  $infra
     * @param  array<string, mixed>  $wfOps
     * @param  array<string, mixed>  $wfFin
     * @return list<array<string, mixed>>
     */
    public function risks(array $treasury, array $ops, array $infra, array $wfOps, array $wfFin): array
    {
        $risks = [];
        $minDeposit = (float) env('FINANCE_PROVIDER_DEPOSIT_MIN', 5_000_000);

        foreach ($treasury['providerDeposits'] ?? [] as $p) {
            if ($p['balance'] !== null && $p['balance'] < $minDeposit) {
                $risks[] = [
                    'priority' => 'critical',
                    'code' => 'low_provider_deposit',
                    'title' => 'Saldo provider rendah: '.($p['name'] ?? $p['code']),
                    'detail' => 'Balance Rp '.number_format((float) $p['balance'], 0, ',', '.'),
                    'division' => 'finance',
                    'drillDown' => '/dashboard/finance/treasury',
                ];
            }
        }

        if (($treasury['pendingSettlementCount'] ?? 0) > 0) {
            $risks[] = [
                'priority' => 'warning',
                'code' => 'settlement_pending',
                'title' => 'Settlement tertunda',
                'detail' => ($treasury['pendingSettlementCount'] ?? 0).' batch · Rp '.number_format((float) ($treasury['pendingSettlementAmount'] ?? 0), 0, ',', '.'),
                'division' => 'finance',
                'drillDown' => '/dashboard/finance/settlement',
            ];
        }

        if (($wfFin['refundQueue'] ?? 0) >= 5) {
            $risks[] = [
                'priority' => 'warning',
                'code' => 'refund_queue_elevated',
                'title' => 'Antrian refund meningkat',
                'detail' => ($wfFin['refundQueue'] ?? 0).' waiting finance',
                'division' => 'finance',
                'drillDown' => '/dashboard/finance/refund-queue',
            ];
        }

        foreach ($ops['providerHealth'] ?? [] as $p) {
            $st = strtolower((string) ($p['partnerStatus'] ?? ''));
            if (in_array($st, ['offline', 'down', 'error'], true) || ($p['healthColor'] ?? '') === 'red') {
                $risks[] = [
                    'priority' => 'critical',
                    'code' => 'provider_offline',
                    'title' => 'Provider bermasalah: '.($p['name'] ?? $p['code']),
                    'detail' => 'Status '.$st,
                    'division' => 'operations',
                    'drillDown' => '/dashboard/operations/product-providers',
                ];
            }
            if (($p['avgResponseMs'] ?? null) !== null && (int) $p['avgResponseMs'] > 3000) {
                $risks[] = [
                    'priority' => 'warning',
                    'code' => 'provider_latency',
                    'title' => 'Latency tinggi: '.($p['name'] ?? $p['code']),
                    'detail' => $p['avgResponseMs'].' ms',
                    'division' => 'operations',
                    'drillDown' => '/dashboard/operations/monitoring',
                ];
            }
        }

        if (($wfOps['issueQueue'] ?? 0) >= 10) {
            $risks[] = [
                'priority' => 'warning',
                'code' => 'ops_queue_backlog',
                'title' => 'Issue Queue menumpuk',
                'detail' => ($wfOps['issueQueue'] ?? 0).' open issues',
                'division' => 'operations',
                'drillDown' => '/dashboard/operations/issue-queue',
            ];
        }

        if (($infra['redis']['status'] ?? '') === 'down' || ($infra['database']['status'] ?? '') === 'down') {
            $risks[] = [
                'priority' => 'critical',
                'code' => 'infra_down',
                'title' => 'Infrastruktur kritis',
                'detail' => 'Redis/DB probe failed',
                'division' => 'operations',
                'drillDown' => '/dashboard/operations/monitoring',
            ];
        }

        // Honest N/A — do not invent disk/server overload
        if (($infra['os']['disk']['status'] ?? '') === 'na') {
            $risks[] = [
                'priority' => 'info',
                'code' => 'disk_metric_na',
                'title' => 'Disk metric tidak tersedia',
                'detail' => 'Metric Not Available — host agent out of scope',
                'division' => 'operations',
                'drillDown' => '/dashboard/operations/monitoring',
            ];
        }

        if (($treasury['walletLiability'] ?? 0) > 0 && ($treasury['providerDepositTotal'] ?? 0) > 0
            && $treasury['walletLiability'] > $treasury['providerDepositTotal'] * 1.5) {
            $risks[] = [
                'priority' => 'warning',
                'code' => 'wallet_liability_high',
                'title' => 'Wallet liability tinggi vs deposit provider',
                'detail' => 'Liability Rp '.number_format((float) $treasury['walletLiability'], 0, ',', '.'),
                'division' => 'finance',
                'drillDown' => '/dashboard/finance/treasury',
            ];
        }

        usort($risks, fn ($a, $b) => ($a['priority'] === 'critical' ? 0 : ($a['priority'] === 'warning' ? 1 : 2))
            <=> ($b['priority'] === 'critical' ? 0 : ($b['priority'] === 'warning' ? 1 : 2)));

        return $risks;
    }

    /**
     * @param  array<string, mixed>  $legacy
     * @param  array<string, mixed>  $ops
     * @param  array<string, mixed>  $infra
     * @param  array<string, mixed>  $wfAdmin
     * @param  array<string, mixed>  $treasury
     * @param  array<string, mixed>  $profit
     * @param  array<string, mixed>  $wfCs
     * @return array<string, mixed>
     */
    public function businessHealth(
        array $legacy,
        array $ops,
        array $infra,
        array $wfAdmin,
        array $treasury,
        array $profit,
        array $wfCs
    ): array {
        $indicators = [];

        $successRate = $legacy['success_rate'];
        $indicators['revenuePerformance'] = $this->scoreFromRate($successRate !== null ? (float) $successRate : null, 95, 80);

        $openIssues = (int) ($ops['kpis']['openIssues'] ?? 0);
        $indicators['operationsHealth'] = $this->scoreInverseCount($openIssues, 5, 20);

        $pendingRefund = (int) ($wfAdmin['byDivision']['finance'] ?? 0);
        $indicators['financeHealth'] = $this->scoreInverseCount($pendingRefund, 3, 15);

        $mktOpen = (int) ($wfAdmin['byDivision']['marketing'] ?? 0);
        $indicators['marketingHealth'] = $this->scoreInverseCount($mktOpen, 5, 20);

        $criticalCs = (int) ($wfCs['criticalCases'] ?? 0);
        $indicators['customerSupportHealth'] = $this->scoreInverseCount($criticalCs, 2, 10);

        $dbUp = ($infra['database']['status'] ?? '') === 'up';
        $redisOk = in_array($infra['redis']['status'] ?? '', ['up', 'down'], true)
            ? (($infra['redis']['status'] ?? '') === 'up' ? 100 : 40)
            : 70;
        $indicators['infrastructureHealth'] = $dbUp ? (int) round(($redisOk + 100) / 2) : 35;

        $totalOpen = max(1, (int) ($wfAdmin['totalOpen'] ?? 0));
        $resolvedToday = Workflow::query()->where('status', 'resolved')->whereDate('resolved_at', today())->count();
        $createdToday = Workflow::query()->whereDate('created_at', today())->count();
        $completion = $createdToday > 0 ? min(100, round(($resolvedToday / max(1, $createdToday)) * 100)) : ($totalOpen < 5 ? 90 : 70);
        $indicators['workflowCompletion'] = (int) $completion;

        $providers = $ops['providerHealth'] ?? [];
        $online = collect($providers)->filter(function ($p) {
            $st = strtolower((string) ($p['partnerStatus'] ?? 'online'));

            return ! in_array($st, ['offline', 'down', 'error'], true) && ($p['healthColor'] ?? '') !== 'red';
        })->count();
        $indicators['providerAvailability'] = count($providers) > 0
            ? (int) round(($online / count($providers)) * 100)
            : 100;

        $pgList = $treasury['paymentGateways'] ?? [];
        $pgOk = collect($pgList)->filter(function ($g) {
            $s = strtolower((string) ($g['status'] ?? 'online'));

            return ! in_array($s, ['offline', 'error', 'down'], true);
        })->count();
        $indicators['paymentGatewayAvailability'] = count($pgList) > 0
            ? (int) round(($pgOk / count($pgList)) * 100)
            : 100;

        $txToday = max(1, (int) ($legacy['today_transactions'] ?? Transaction::query()->whereDate('created_at', today())->count()));
        $refundToday = (int) Transaction::query()->whereNotNull('refunded_at')->whereDate('refunded_at', today())->count();
        $refundRate = ($refundToday / $txToday) * 100;
        $indicators['refundRateHealth'] = $this->scoreInverseRate($refundRate, 2, 10);

        // No CSAT survey engine — mark N/A but don't invent
        $indicators['customerSatisfaction'] = [
            'score' => null,
            'available' => false,
            'message' => 'Metric Not Available — no CSAT survey yet',
        ];

        $numeric = [];
        foreach ($indicators as $key => $val) {
            if (is_array($val)) {
                continue;
            }
            $numeric[$key] = $val;
        }
        $overall = count($numeric) > 0 ? (int) round(array_sum($numeric) / count($numeric)) : 0;
        $label = $overall >= 90 ? 'Excellent' : ($overall >= 75 ? 'Good' : ($overall >= 60 ? 'Fair' : 'At Risk'));

        return [
            'overall' => $overall,
            'label' => $label,
            'indicators' => $indicators,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function goals(array $legacy, array $profit): array
    {
        $defs = [
            'revenue' => [
                'label' => 'Revenue (MTD)',
                'actual' => (float) ($legacy['monthly_revenue'] ?? 0),
                'settingKey' => 'executive_goal_revenue_monthly',
            ],
            'transactions' => [
                'label' => 'Transactions (MTD)',
                'actual' => (float) Transaction::query()
                    ->whereMonth('created_at', now()->month)
                    ->whereYear('created_at', now()->year)
                    ->count(),
                'settingKey' => 'executive_goal_transactions_monthly',
            ],
            'users' => [
                'label' => 'Registered Users',
                'actual' => (float) ($legacy['total_users'] ?? 0),
                'settingKey' => 'executive_goal_users_total',
            ],
            'profit' => [
                'label' => 'Net Profit (MTD)',
                'actual' => (float) ($profit['netProfit'] ?? 0),
                'settingKey' => 'executive_goal_profit_monthly',
            ],
            'activeUsers' => [
                'label' => 'Active Users',
                'actual' => (float) ($legacy['active_users'] ?? 0),
                'settingKey' => 'executive_goal_active_users',
            ],
            'campaigns' => [
                'label' => 'Active Campaigns',
                'actual' => (float) ($this->activeCampaignCount()),
                'settingKey' => 'executive_goal_campaigns_active',
            ],
        ];

        $out = [];
        foreach ($defs as $key => $def) {
            $target = $this->settingFloat($def['settingKey']);
            $progress = ($target !== null && $target > 0)
                ? min(100, round(($def['actual'] / $target) * 100, 1))
                : null;
            $out[$key] = [
                'label' => $def['label'],
                'actual' => $def['actual'],
                'target' => $target,
                'progress' => $progress,
                'targetAvailable' => $target !== null,
                'message' => $target === null ? 'Target belum di-set di System Settings' : null,
            ];
        }

        return $out;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function pendingApprovals(): array
    {
        $threshold = $this->settingFloat('executive_approval_refund_threshold') ?? 1_000_000;

        $q = Workflow::query()
            ->with(['transaction', 'creator:id,name'])
            ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
            ->where(function ($w) use ($threshold) {
                $w->where('current_division', 'admin')
                    ->orWhere(function ($q2) {
                        $q2->where('meta->requires_owner_approval', true);
                    })
                    ->orWhere(function ($q3) use ($threshold) {
                        $q3->where('current_division', 'finance')
                            ->where('category', 'refund_request')
                            ->whereHas('transaction', fn ($t) => $t->where('total_payment', '>=', $threshold));
                    });
            })
            ->orderByDesc('id')
            ->limit(30)
            ->get();

        return $q->map(function (Workflow $w) {
            return [
                'id' => $w->id,
                'workflowCode' => $w->workflow_code,
                'title' => $w->title,
                'category' => $w->category,
                'division' => $w->current_division,
                'status' => $w->status,
                'priority' => $w->priority,
                'amount' => $w->transaction?->total_payment !== null ? (float) $w->transaction->total_payment : null,
                'createdBy' => $w->creator?->name,
                'createdAt' => optional($w->created_at)?->toIso8601String(),
                'drillDown' => '/dashboard/owner/workflows',
            ];
        })->all();
    }

    /**
     * Owner strategic decision on admin-queue / flagged workflows only — does not run refund.
     *
     * @param  array<string, mixed>  $data
     */
    public function decideApproval(Workflow $workflow, User $actor, array $data): Workflow
    {
        $decision = (string) ($data['decision'] ?? '');
        $note = $data['note'] ?? null;

        if (! in_array($decision, ['approve', 'reject'], true)) {
            abort(422, 'decision harus approve atau reject');
        }

        $role = $actor->role instanceof UserRole ? $actor->role->value : (string) $actor->role;
        if (! in_array($role, [UserRole::OWNER->value, UserRole::SUPER_ADMIN->value], true)) {
            abort(403, 'Hanya Owner yang dapat executive approval.');
        }

        // Read-mostly: never call wallet refund from Owner — only record decision + route back
        $meta = is_array($workflow->meta) ? $workflow->meta : [];
        $meta['owner_approval'] = [
            'decision' => $decision,
            'at' => now()->toIso8601String(),
            'by' => $actor->id,
            'note' => $note,
        ];
        $workflow->update(['meta' => $meta]);

        if ($decision === 'approve') {
            // Send back to originating division for execution (finance/ops) — Owner does not execute
            $target = $meta['owner_approval_return_division']
                ?? ($workflow->category === 'refund_request' ? 'finance' : 'operations');
            if ($workflow->current_division === 'admin' || ($meta['requires_owner_approval'] ?? false)) {
                return $this->workflows->escalate(
                    $workflow->fresh(),
                    $actor,
                    $target,
                    $note ?: 'Owner approved — divisi dapat mengeksekusi'
                );
            }
            $this->workflows->recordAction($workflow->fresh(), $actor, 'owner_approve', $note ?: 'Owner approved', [], ['owner_approval' => $meta['owner_approval']]);

            return $workflow->fresh($this->workflows->defaultRelations());
        }

        return $this->workflows->transitionStatus(
            $workflow->fresh(),
            $actor,
            'rejected',
            $note ?: 'Owner rejected',
            'resolved',
            'owner_reject'
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function workflowMonitor(): array
    {
        $today = Workflow::query()->whereDate('created_at', today());

        return [
            'createdToday' => (clone $today)->count(),
            'inProgress' => Workflow::query()->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed', 'waiting_user'])->count(),
            'waitingFinance' => Workflow::query()->where('status', 'waiting_finance')->count(),
            'waitingOperations' => Workflow::query()->where('status', 'waiting_operations')->count(),
            'waitingMarketing' => Workflow::query()->where('status', 'waiting_marketing')->count(),
            'waitingCs' => Workflow::query()->where('status', 'waiting_cs')->count(),
            'waitingUser' => Workflow::query()->where('status', 'waiting_user')->count(),
            'blocked' => Workflow::query()
                ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                ->where(function ($q) {
                    $q->where('meta->blocked', true)->orWhere('priority', 'critical');
                })
                ->where('created_at', '<', now()->subHours(24))
                ->count(),
            'resolvedToday' => Workflow::query()->where('status', 'resolved')->whereDate('resolved_at', today())->count(),
            'escalatedToday' => WorkflowEvent::query()->where('event_type', 'escalated')->whereDate('created_at', today())->count(),
            'closedToday' => Workflow::query()->whereIn('status', ['closed', 'cancelled'])->whereDate('updated_at', today())->count(),
            'byDivision' => $this->workflowStats->admin()['byDivision'] ?? [],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function workflowTimeline(int $limit = 30): array
    {
        return WorkflowEvent::query()
            ->with(['workflow:id,workflow_code,title,current_division', 'actor:id,name'])
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(function (WorkflowEvent $e) {
                return [
                    'id' => $e->id,
                    'at' => optional($e->created_at)?->toIso8601String(),
                    'eventType' => $e->event_type,
                    'action' => $e->action,
                    'body' => $e->body,
                    'fromDivision' => $e->from_division,
                    'toDivision' => $e->to_division,
                    'actorName' => $e->actor?->name,
                    'workflowId' => $e->workflow_id,
                    'workflowCode' => $e->workflow?->workflow_code,
                    'title' => $e->workflow?->title,
                    'drillDown' => '/dashboard/owner/workflows',
                ];
            })
            ->all();
    }

    /**
     * Rule-based insights from real deltas — never invent causes without data.
     *
     * @return list<array<string, mixed>>
     */
    public function insights(array $legacy, array $profit, array $ops, array $treasury): array
    {
        $out = [];
        $growth = $profit['growth'] ?? null;
        if ($growth && $growth['percentChange'] !== null) {
            $pct = (float) $growth['percentChange'];
            $out[] = [
                'type' => $pct < 0 ? 'warning' : 'positive',
                'text' => 'Revenue MTD '.($pct >= 0 ? 'naik' : 'turun').' '.abs(round($pct, 1)).'% vs periode sebelumnya.',
                'evidence' => [
                    'current' => $growth['currentRevenue'] ?? null,
                    'previous' => $growth['previousRevenue'] ?? null,
                ],
            ];
        }

        $worst = collect($ops['providerHealth'] ?? [])
            ->filter(fn ($p) => ($p['avgResponseMs'] ?? null) !== null)
            ->sortByDesc('avgResponseMs')
            ->first();
        if ($worst) {
            $out[] = [
                'type' => 'info',
                'text' => 'Provider '.($worst['name'] ?? $worst['code']).' memiliki latency tertinggi hari ini ('.$worst['avgResponseMs'].' ms).',
                'evidence' => ['providerId' => $worst['id'], 'latency' => $worst['avgResponseMs']],
            ];
        }

        $offline = collect($ops['providerHealth'] ?? [])->first(function ($p) {
            $st = strtolower((string) ($p['partnerStatus'] ?? ''));

            return in_array($st, ['offline', 'down', 'error'], true) || ($p['healthColor'] ?? '') === 'red';
        });
        if ($offline) {
            $out[] = [
                'type' => 'critical',
                'text' => 'Provider '.($offline['name'] ?? $offline['code']).' bermasalah — dapat menekan volume transaksi.',
                'evidence' => ['providerId' => $offline['id'], 'status' => $offline['partnerStatus']],
            ];
        }

        $refundToday = (float) ($profit['today']['refundCost'] ?? 0);
        $revToday = (float) ($profit['today']['grossRevenue'] ?? 0);
        if ($revToday > 0 && ($refundToday / $revToday) > 0.05) {
            $out[] = [
                'type' => 'warning',
                'text' => 'Refund cost hari ini '.round(($refundToday / $revToday) * 100, 1).'% dari revenue hari ini.',
                'evidence' => ['refundCost' => $refundToday, 'revenue' => $revToday],
            ];
        }

        $campaigns = $this->activeCampaignCount();
        if ($campaigns > 0) {
            $out[] = [
                'type' => 'info',
                'text' => $campaigns.' campaign/banner aktif saat ini (Marketing).',
                'evidence' => ['activeCampaigns' => $campaigns],
            ];
        }

        if ($out === []) {
            $out[] = [
                'type' => 'info',
                'text' => 'Belum ada anomali signifikan dari indikator yang tersedia hari ini.',
                'evidence' => ['transactionsToday' => $legacy['today_transactions'] ?? 0],
            ];
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    protected function treasurySummary(array $treasury): array
    {
        $byCode = collect($treasury['providerDeposits'] ?? [])->keyBy('code');
        $gateways = collect($treasury['paymentGateways'] ?? [])->keyBy(fn ($g) => strtolower((string) ($g['code'] ?? '')));

        return [
            'midtransBalance' => $gateways->get('midtrans')['balance'] ?? null,
            'midtransBalanceAvailable' => array_key_exists('balance', $gateways->get('midtrans') ?? []),
            'vipBalance' => $byCode->get('vip')['balance'] ?? $byCode->get('vipayment')['balance'] ?? null,
            'digiflazzBalance' => $byCode->get('digiflazz')['balance'] ?? null,
            'walletLiability' => $treasury['walletLiability'] ?? 0,
            'outstandingSettlement' => $treasury['pendingSettlementAmount'] ?? 0,
            'pendingRefundAmount' => (float) Workflow::query()
                ->where('current_division', 'finance')
                ->whereNotIn('status', ['resolved', 'closed', 'rejected', 'cancelled'])
                ->whereNotNull('transaction_id')
                ->whereHas('transaction', fn ($t) => $t->whereNull('refunded_at'))
                ->with('transaction')
                ->get()
                ->sum(fn (Workflow $w) => (float) ($w->transaction?->total_payment ?? 0)),
            'cashAvailableProxy' => $treasury['availableCashProxy'] ?? 0,
            'reserveFund' => null, // not modeled — honest null
            'reserveFundAvailable' => false,
            'providerDeposits' => $treasury['providerDeposits'] ?? [],
            'paymentGateways' => $treasury['paymentGateways'] ?? [],
            'cashFlowToday' => $treasury['cashFlowToday'] ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function crossDivisionOverview(
        array $wfOps,
        array $wfFin,
        array $wfMkt,
        array $wfCs,
        array $treasury,
        array $ops,
        array $marketing
    ): array {
        $openChat = Schema::hasTable('conversations')
            ? (int) Conversation::query()->whereIn('status', ['open', 'active', 'waiting'])->count()
            : 0;
        $openTicket = (int) SupportTicket::query()->whereNotIn('status', ['closed', 'resolved', 'cancelled'])->count();
        $criticalTicket = (int) SupportTicket::query()
            ->where('priority', 'critical')
            ->whereNotIn('status', ['closed', 'resolved', 'cancelled'])
            ->count();

        $homepageVersion = HomepageSection::query()->orderByDesc('updated_at')->value('updated_at');

        $campaignSummary = $marketing['campaign_summary'] ?? [];

        return [
            'finance' => [
                'pendingRefund' => $wfFin['refundQueue'] ?? 0,
                'settlementPending' => $treasury['pendingSettlementCount'] ?? 0,
                'cashPosition' => $treasury['availableCashProxy'] ?? 0,
                'profit' => $this->profitMonitor()['today']['netProfit'] ?? 0,
                'path' => '/dashboard/finance',
            ],
            'operations' => [
                'openIncident' => $ops['kpis']['incidentsToday'] ?? 0,
                'providerHealth' => $ops['kpis']['openAlerts'] ?? 0,
                'gatewayHealth' => collect($treasury['paymentGateways'] ?? [])->contains(fn ($g) => in_array(strtolower((string) ($g['status'] ?? '')), ['offline', 'error', 'down'], true)) ? 'degraded' : 'ok',
                'latency' => $ops['kpis']['avgLatencyMs'] ?? null,
                'issueQueue' => $wfOps['issueQueue'] ?? 0,
                'path' => '/dashboard/operations',
            ],
            'marketing' => [
                'campaignActive' => $this->activeCampaignCount(),
                'announcement' => is_array($campaignSummary) ? ($campaignSummary['announcements'] ?? $campaignSummary['active_announcements'] ?? null) : null,
                'feedback' => $wfMkt['feedbackQueue'] ?? 0,
                'homepageVersion' => optional($homepageVersion)?->toIso8601String(),
                'path' => '/dashboard/marketing',
            ],
            'customerSupport' => [
                'openChat' => $openChat,
                'openTicket' => $openTicket,
                'criticalTicket' => $criticalTicket,
                'averageResponseTime' => $wfCs['averageResolutionMinutes'] ?? null,
                'knowledgeUpdate' => $wfMkt['knowledgeNeeded'] ?? 0,
                'path' => '/dashboard/customer-support',
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function headlineAnswers(
        array $legacy,
        array $health,
        array $alerts,
        array $risks,
        array $treasury,
        array $profit,
        array $ops,
        array $wfAdmin
    ): array {
        $criticalAlerts = collect($alerts)->where('severity', 'critical')->count();
        $busiest = collect($wfAdmin['byDivision'] ?? [])->sortDesc()->keys()->first();
        $problemProvider = collect($ops['providerHealth'] ?? [])->first(function ($p) {
            $st = strtolower((string) ($p['partnerStatus'] ?? ''));

            return in_array($st, ['offline', 'down', 'error'], true) || ($p['healthColor'] ?? '') === 'red';
        });

        return [
            'businessCondition' => ($health['label'] ?? 'Unknown').' · score '.$health['overall'].'%',
            'hasProblems' => $criticalAlerts > 0 || collect($risks)->where('priority', 'critical')->isNotEmpty(),
            'busiestDivision' => $busiest,
            'problemProvider' => $problemProvider['name'] ?? $problemProvider['code'] ?? null,
            'companyMoneyProxy' => $treasury['availableCashProxy'] ?? 0,
            'walletLiability' => $treasury['walletLiability'] ?? 0,
            'profitToday' => $profit['today']['netProfit'] ?? 0,
            'refundToday' => $profit['today']['refundCost'] ?? 0,
            'transactionsToday' => $legacy['today_transactions'] ?? 0,
            'largestRisk' => collect($risks)->first()['title'] ?? null,
        ];
    }

    protected function scoreFromRate(?float $rate, float $excellent, float $ok): int
    {
        if ($rate === null) {
            return 70;
        }
        if ($rate >= $excellent) {
            return 100;
        }
        if ($rate >= $ok) {
            return 80;
        }
        if ($rate >= 50) {
            return 55;
        }

        return 30;
    }

    protected function scoreInverseCount(int $count, int $warn, int $crit): int
    {
        if ($count <= $warn) {
            return 100;
        }
        if ($count <= $crit) {
            return 70;
        }

        return max(20, 100 - ($count * 3));
    }

    protected function scoreInverseRate(float $rate, float $warn, float $crit): int
    {
        if ($rate <= $warn) {
            return 100;
        }
        if ($rate <= $crit) {
            return 65;
        }

        return max(20, (int) (100 - $rate * 5));
    }

    protected function settingFloat(string $key): ?float
    {
        if (! Schema::hasTable('settings') && ! Schema::hasTable('system_settings')) {
            return null;
        }
        $val = null;
        if (Schema::hasTable('settings')) {
            $val = Setting::query()->where('key', $key)->value('value');
        }
        if ($val === null && Schema::hasTable('system_settings')) {
            $val = \App\Models\SystemSetting::query()->where('key', $key)->value('value');
        }
        if ($val === null || $val === '') {
            return null;
        }

        return is_numeric($val) ? (float) $val : null;
    }

    protected function activeCampaignCount(): int
    {
        return (int) \App\Models\BannerPromotion::query()->where('is_active', true)->count();
    }
}