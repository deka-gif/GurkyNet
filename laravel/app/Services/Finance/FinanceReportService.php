<?php

namespace App\Services\Finance;

use App\Enums\TransactionStatus;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceSettlement;
use App\Models\Transaction;
use App\Models\TransactionItem;

class FinanceReportService
{
    /**
     * Structured financial report from real DB aggregates (no dummy series).
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function generate(array $filters = []): array
    {
        $start = $filters['start_date'] ?? now()->startOfMonth()->toDateString();
        $end = $filters['end_date'] ?? now()->toDateString();

        $txQ = Transaction::query()->whereDate('created_at', '>=', $start)->whereDate('created_at', '<=', $end);
        $success = (clone $txQ)->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success']);

        $revenue = (float) (clone $success)->sum('total_payment');
        $refundCost = (float) FinanceLedgerEntry::query()
            ->whereIn('event_type', ['wallet_refund', 'refund_approve'])
            ->whereDate('created_at', '>=', $start)
            ->whereDate('created_at', '<=', $end)
            ->sum('credit');
        // Fallback if ledger empty for period
        if ($refundCost <= 0) {
            $refundCost = (float) Transaction::query()
                ->whereNotNull('refunded_at')
                ->whereDate('refunded_at', '>=', $start)
                ->whereDate('refunded_at', '<=', $end)
                ->sum('total_payment');
        }

        $settlementTotal = (float) FinanceSettlement::query()
            ->where('status', 'completed')
            ->whereDate('completed_at', '>=', $start)
            ->whereDate('completed_at', '<=', $end)
            ->sum('amount');

        $adjustments = (float) FinanceLedgerEntry::query()
            ->whereIn('event_type', ['manual_adjustment', 'admin_override'])
            ->whereDate('created_at', '>=', $start)
            ->whereDate('created_at', '<=', $end)
            ->selectRaw('SUM(credit - debit) as net')
            ->value('net');

        $items = TransactionItem::query()
            ->whereHas('transaction', function ($q) use ($start, $end) {
                $q->whereDate('created_at', '>=', $start)
                    ->whereDate('created_at', '<=', $end)
                    ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success']);
            })
            ->get();

        $providerCost = 0.0;
        $margin = 0.0;
        foreach ($items as $item) {
            $meta = is_array($item->custom_metadata ?? null)
                ? $item->custom_metadata
                : (is_string($item->custom_metadata ?? null) ? (json_decode($item->custom_metadata, true) ?: []) : []);
            $base = (float) ($meta['base_price'] ?? $meta['provider_price'] ?? 0);
            $sell = (float) ($item->price ?? $item->subtotal ?? 0);
            if ($base > 0) {
                $providerCost += $base;
            }
            if ($sell > 0 && $base > 0) {
                $margin += ($sell - $base);
            }
        }

        $gatewayFee = (float) (clone $success)->sum('admin_fee');
        $expense = $providerCost + $refundCost + $gatewayFee;
        $netProfit = $revenue - $expense;

        $topups = (float) FinanceLedgerEntry::query()
            ->where('event_type', 'wallet_topup')
            ->whereDate('created_at', '>=', $start)
            ->whereDate('created_at', '<=', $end)
            ->sum('credit');

        return [
            'period' => ['start' => $start, 'end' => $end],
            'incomeStatement' => [
                'revenue' => $revenue,
                'providerCost' => $providerCost,
                'gatewayFee' => $gatewayFee,
                'refundCost' => $refundCost,
                'grossProfit' => $revenue - $providerCost,
                'netProfit' => $netProfit,
            ],
            'profitLoss' => [
                'revenue' => $revenue,
                'expenses' => $expense,
                'net' => $netProfit,
                'margin' => $margin,
            ],
            'cashFlow' => [
                'inflowTopup' => $topups,
                'inflowSettlement' => $settlementTotal,
                'outflowRefunds' => $refundCost,
                'netAdjustments' => (float) $adjustments,
            ],
            'margin' => [
                'estimated' => $margin,
                'revenue' => $revenue,
                'providerCost' => $providerCost,
            ],
            'gatewayFee' => $gatewayFee,
            'providerCost' => $providerCost,
            'refundCost' => $refundCost,
            'settlement' => $settlementTotal,
            'tax' => null, // no tax engine this sprint
            'growth' => $this->growth($start, $end, $revenue),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function growth(string $start, string $end, float $revenue): array
    {
        $startDt = \Carbon\Carbon::parse($start);
        $endDt = \Carbon\Carbon::parse($end);
        $days = max(1, $startDt->diffInDays($endDt) + 1);
        $prevEnd = $startDt->copy()->subDay();
        $prevStart = $prevEnd->copy()->subDays($days - 1);

        $prevRevenue = (float) Transaction::query()
            ->whereDate('created_at', '>=', $prevStart->toDateString())
            ->whereDate('created_at', '<=', $prevEnd->toDateString())
            ->whereIn('status', [TransactionStatus::SUCCESS->value, 'sukses', 'success'])
            ->sum('total_payment');

        $pct = $prevRevenue > 0 ? (($revenue - $prevRevenue) / $prevRevenue) * 100 : null;

        return [
            'currentRevenue' => $revenue,
            'previousRevenue' => $prevRevenue,
            'percentChange' => $pct !== null ? round($pct, 2) : null,
        ];
    }
}
