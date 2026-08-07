<?php

namespace App\Services\Workflow;

use App\Models\Workflow;
use App\Models\WorkflowEvent;
use Illuminate\Support\Facades\DB;

class WorkflowStatsService
{
    /**
     * @return array<string, mixed>
     */
    public function forDivision(string $division): array
    {
        return match ($division) {
            'customer_support', 'cs' => $this->customerSupport(),
            'operations' => $this->operations(),
            'finance' => $this->finance(),
            'marketing' => $this->marketing(),
            'admin', 'owner' => $this->admin(),
            default => [],
        };
    }

    /**
     * @return array<string, mixed>
     */
    public function customerSupport(): array
    {
        $open = fn (string $status) => Workflow::query()->where('status', $status)->count();

        $escalatedToday = Workflow::query()
            ->whereDate('created_at', today())
            ->whereIn('current_division', ['operations', 'finance', 'marketing', 'admin'])
            ->count();

        $resolvedToday = Workflow::query()
            ->where('status', 'resolved')
            ->whereDate('resolved_at', today())
            ->count();

        $avgMinutes = null;
        $resolved = Workflow::query()
            ->whereNotNull('resolved_at')
            ->where('resolved_at', '>=', now()->subDays(30))
            ->get(['created_at', 'resolved_at']);
        if ($resolved->isNotEmpty()) {
            $avgMinutes = (int) round($resolved->avg(function ($w) {
                return $w->created_at->diffInMinutes($w->resolved_at);
            }));
        }

        return [
            'waitingOperations' => $open('waiting_operations'),
            'waitingFinance' => $open('waiting_finance'),
            'waitingMarketing' => $open('waiting_marketing'),
            'escalatedToday' => $escalatedToday,
            'resolvedToday' => $resolvedToday,
            'averageResolutionMinutes' => $avgMinutes,
            'criticalCases' => Workflow::query()
                ->where('priority', 'critical')
                ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                ->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function operations(): array
    {
        $base = Workflow::query()->where('current_division', 'operations')
            ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed']);

        return [
            'issueQueue' => (clone $base)->count(),
            'criticalIssue' => (clone $base)->where('priority', 'critical')->count(),
            'providerDown' => (clone $base)->whereIn('category', ['provider_failure', 'provider_maintenance'])->count(),
            'retryNeeded' => Workflow::query()
                ->where('current_division', 'operations')
                ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                ->where('meta->retry_intent->open', true)
                ->count(),
            'maintenance' => (clone $base)->where('category', 'provider_maintenance')->count()
                + Workflow::query()
                    ->where('current_division', 'operations')
                    ->whereNotNull('meta->maintenance')
                    ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                    ->count(),
            'slaAging' => (clone $base)->where('created_at', '<', now()->subHours(24))->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function finance(): array
    {
        $base = Workflow::query()->where('current_division', 'finance')
            ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed']);

        return [
            'refundQueue' => (clone $base)->count(),
            'pendingApproval' => (clone $base)->where('status', 'waiting_finance')->where(function ($q) {
                $q->whereNull('meta->needs_review')->orWhere('meta->needs_review', false);
            })->count(),
            'needReview' => (clone $base)->where(function ($q) {
                $q->where('meta->needs_review', true)->orWhere('meta->needs_partial', true);
            })->count(),
            'walletException' => (clone $base)->where('category', 'wallet_exception')->count(),
            'settlement' => Workflow::query()
                ->where('category', 'refund_request')
                ->where('status', 'resolved')
                ->whereDate('resolved_at', today())
                ->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function marketing(): array
    {
        $base = Workflow::query()->where('current_division', 'marketing')
            ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed']);

        return [
            'feedbackQueue' => (clone $base)->count(),
            'websiteImprovement' => (clone $base)->whereIn('category', ['feedback_ui', 'feedback_website'])->count(),
            'announcementNeeded' => (clone $base)->whereIn('category', ['feedback_promo', 'feedback_banner'])->count(),
            'knowledgeNeeded' => (clone $base)->whereIn('category', ['suggestion', 'feature_request'])->count(),
            'campaignSuggestion' => (clone $base)->whereIn('category', ['feedback_voucher', 'feedback_promo'])->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function admin(): array
    {
        return [
            'totalOpen' => Workflow::query()->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])->count(),
            'byDivision' => Workflow::query()
                ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                ->select('current_division', DB::raw('count(*) as total'))
                ->groupBy('current_division')
                ->pluck('total', 'current_division'),
            'critical' => Workflow::query()
                ->where('priority', 'critical')
                ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                ->count(),
            'adminQueue' => Workflow::query()->where('current_division', 'admin')
                ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])
                ->count(),
            'actionsToday' => WorkflowEvent::query()->whereDate('created_at', today())->count(),
        ];
    }
}
