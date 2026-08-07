<?php

namespace App\Services\Finance;

use App\Enums\TransactionStatus;
use App\Models\FinanceAlert;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceSettlement;
use App\Models\PaymentHistory;
use App\Models\ProductProvider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\Workflow;
use App\Services\Payment\PaymentGatewayControlService;
use App\Services\Workflow\WorkflowStatsService;
use Illuminate\Support\Facades\DB;

class FinanceCommandCenterService
{
    public function __construct(
        protected FinanceTreasuryService $treasury,
        protected FinanceAlertService $alerts,
        protected PaymentGatewayControlService $gateways,
        protected WorkflowStatsService $workflowStats
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function overview(): array
    {
        $this->alerts->evaluate();

        $revenueToday = (float) Transaction::query()
            ->whereDate('created_at', today())
            ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success'])
            ->sum('total_payment');

        $items = TransactionItem::query()
            ->whereHas('transaction', fn ($q) => $q->whereDate('created_at', today())
                ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success']))
            ->get();
        $profitToday = (float) $items->sum(function (TransactionItem $item) {
            $meta = $this->itemMeta($item);
            $base = (float) ($meta['base_price'] ?? $meta['provider_price'] ?? 0);
            $sell = (float) ($item->price ?? $item->subtotal ?? 0);

            return ($sell > 0 && $base > 0) ? ($sell - $base) : 0;
        });

        $wfFinance = $this->workflowStats->finance();
        $treasury = $this->treasury->snapshot();

        $pendingChargeback = (int) FinanceAlert::query()->where('type', 'chargeback')->where('status', 'open')->count();
        $pendingWalletAdj = (int) FinanceLedgerEntry::query()
            ->whereIn('event_type', ['manual_adjustment', 'admin_override'])
            ->whereDate('created_at', today())
            ->count();
        $pendingAudit = (int) FinanceSettlement::query()->where('status', 'pending')->count()
            + (int) Workflow::query()->where('current_division', 'finance')->where('status', 'waiting_finance')->count();

        $lowProviders = collect($treasury['providerDeposits'] ?? [])
            ->filter(fn ($p) => $p['balance'] !== null && $p['balance'] < (float) env('FINANCE_PROVIDER_DEPOSIT_MIN', 5_000_000))
            ->values()
            ->all();

        $openAlerts = FinanceAlert::query()->where('status', 'open')->orderByDesc('id')->limit(10)->get()
            ->map(fn (FinanceAlert $a) => $this->alerts->payload($a))->all();

        $recentLedger = FinanceLedgerEntry::query()->orderByDesc('id')->limit(15)->get()
            ->map(fn (FinanceLedgerEntry $e) => app(FinanceLedgerService::class)->payload($e))->all();

        $pgHealth = collect($this->gateways->listControlCenter())->map(function (array $gw) {
            $code = strtolower((string) ($gw['code'] ?? ''));
            $failedToday = (int) PaymentHistory::query()
                ->whereDate('created_at', today())
                ->where(function ($q) use ($code) {
                    $q->where('gateway', $code)->orWhere('payment_code', 'like', '%'.$code.'%');
                })
                ->whereIn('status', ['failed', 'deny', 'expire', 'cancel'])
                ->count();
            $volumeToday = (float) Transaction::query()
                ->whereDate('created_at', today())
                ->where(function ($q) use ($code) {
                    $q->where('payment_method', 'like', '%'.$code.'%');
                })
                ->sum('total_payment');

            return [
                'code' => $gw['code'] ?? null,
                'name' => $gw['name'] ?? null,
                'status' => $gw['status'] ?? null,
                'balance' => $gw['balance'] ?? null,
                'latencyMs' => $gw['avg_response_ms'] ?? $gw['latency_ms'] ?? null,
                'volumeToday' => $volumeToday,
                'failedToday' => $failedToday,
            ];
        })->values()->all();

        return [
            'todaysRevenue' => $revenueToday,
            'todaysProfit' => $profitToday,
            'pendingRefund' => (int) ($wfFinance['pendingApproval'] ?? 0) + (int) ($wfFinance['refundQueue'] ?? 0),
            'pendingSettlement' => (int) FinanceSettlement::query()->whereIn('status', ['pending', 'processing'])->count(),
            'pendingAudit' => $pendingAudit,
            'pendingChargeback' => $pendingChargeback,
            'pendingWalletAdjustment' => $pendingWalletAdj,
            'lowProviderBalance' => $lowProviders,
            'financialAlerts' => $openAlerts,
            'recentFinancialActivity' => $recentLedger,
            'paymentGatewayHealth' => $pgHealth,
            'providerHealth' => $treasury['providerDeposits'] ?? [],
            'workflowFinance' => $wfFinance,
            'treasury' => [
                'walletLiability' => $treasury['walletLiability'] ?? 0,
                'providerDepositTotal' => $treasury['providerDepositTotal'] ?? 0,
                'pendingSettlementAmount' => $treasury['pendingSettlementAmount'] ?? 0,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function walletMonitor(): array
    {
        return [
            'totalWalletBalance' => (float) Wallet::query()->sum('balance'),
            'walletLiability' => (float) Wallet::query()->sum('balance'),
            'walletCount' => (int) Wallet::query()->count(),
            'frozenCount' => (int) Wallet::query()->whereIn('status', ['frozen', 'locked', 'inactive'])->count(),
            'recentAdjustments' => FinanceLedgerEntry::query()
                ->whereIn('event_type', ['manual_adjustment', 'admin_override'])
                ->orderByDesc('id')->limit(20)->get()
                ->map(fn ($e) => app(FinanceLedgerService::class)->payload($e))->all(),
            'recentRefunds' => FinanceLedgerEntry::query()
                ->whereIn('event_type', ['wallet_refund', 'refund_approve'])
                ->orderByDesc('id')->limit(20)->get()
                ->map(fn ($e) => app(FinanceLedgerService::class)->payload($e))->all(),
            'recentTransfers' => WalletHistory::query()
                ->where('description', 'like', '%Transfer%')
                ->orderByDesc('id')->limit(20)->get()
                ->map(fn (WalletHistory $h) => [
                    'id' => $h->id,
                    'amount' => (float) $h->amount,
                    'type' => $h->type,
                    'description' => $h->description,
                    'createdAt' => optional($h->created_at)?->toIso8601String(),
                ])->all(),
        ];
    }

    /**
     * Read-only widgets for other divisions.
     *
     * @return array<string, mixed>
     */
    public function widgetsFor(string $audience): array
    {
        return match ($audience) {
            'customer_support', 'cs' => [
                'pendingFinanceRefunds' => Workflow::query()->where('current_division', 'finance')
                    ->whereIn('category', ['refund_request', 'partial_refund'])
                    ->whereNotIn('status', ['resolved', 'rejected', 'cancelled', 'closed'])->count(),
                'refundsResolvedToday' => Workflow::query()->where('category', 'refund_request')
                    ->where('status', 'resolved')->whereDate('resolved_at', today())->count(),
                'recentFinanceDecisions' => FinanceLedgerEntry::query()
                    ->whereIn('event_type', ['refund_approve', 'refund_reject', 'wallet_refund'])
                    ->orderByDesc('id')->limit(10)->get()
                    ->map(fn ($e) => app(FinanceLedgerService::class)->payload($e))->all(),
            ],
            'operations' => [
                'lowProviderDeposits' => collect($this->treasury->snapshot()['providerDeposits'] ?? [])
                    ->filter(fn ($p) => $p['balance'] !== null && $p['balance'] < (float) env('FINANCE_PROVIDER_DEPOSIT_MIN', 5_000_000))
                    ->values()->all(),
                'providerAlerts' => FinanceAlert::query()->whereIn('type', ['low_provider_deposit', 'gateway_offline', 'settlement_delay'])
                    ->where('status', 'open')->orderByDesc('id')->limit(10)->get()
                    ->map(fn ($a) => $this->alerts->payload($a))->all(),
                'settlementsOpen' => FinanceSettlement::query()->whereIn('status', ['pending', 'processing'])->count(),
            ],
            'marketing' => [
                'todaysRevenue' => (float) Transaction::query()->whereDate('created_at', today())
                    ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success'])->sum('total_payment'),
                'todaysMargin' => $this->overview()['todaysProfit'],
                'refundCostToday' => (float) FinanceLedgerEntry::query()
                    ->whereIn('event_type', ['wallet_refund', 'refund_approve'])
                    ->whereDate('created_at', today())->sum('credit'),
            ],
            default => [],
        };
    }

    /**
     * @return array<string, mixed>
     */
    protected function itemMeta(TransactionItem $item): array
    {
        $meta = $item->custom_metadata ?? $item->meta ?? null;
        if (is_string($meta)) {
            return json_decode($meta, true) ?: [];
        }

        return is_array($meta) ? $meta : [];
    }
}
