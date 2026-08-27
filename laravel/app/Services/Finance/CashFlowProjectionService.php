<?php

namespace App\Services\Finance;

use App\Enums\TransactionStatus;
use App\Models\ProductProvider;
use App\Models\Transaction;
use Illuminate\Support\Carbon;

/**
 * FR-DIFF-10 — Owner 30-day cash-flow projection (moving average of real sales).
 * Digiflazz + VIPayment balances from product_providers. No fake numbers / no alert thresholds.
 */
class CashFlowProjectionService
{
    public const HORIZON_DAYS = 30;

    public const MIN_HISTORY_DAYS = 7;

    /**
     * @return array<string, mixed>
     */
    public function project(?Carbon $asOf = null): array
    {
        $asOf = $asOf ? $asOf->copy()->startOfDay() : now()->startOfDay();
        $historyStart = $asOf->copy()->subDays(self::HORIZON_DAYS);

        $daily = [];
        for ($i = 0; $i < self::HORIZON_DAYS; $i++) {
            $day = $historyStart->copy()->addDays($i);
            $key = $day->toDateString();
            $daily[$key] = [
                'date' => $key,
                'sales_amount' => 0.0,
                'sales_count' => 0,
            ];
        }

        // Aggregate in PHP (portable across SQLite/MySQL) — real SUCCESS wallet product sales only.
        $sales = Transaction::query()
            ->where('status', TransactionStatus::SUCCESS->value)
            ->where('payment_method', 'wallet')
            ->where('created_at', '>=', $historyStart)
            ->where('created_at', '<', $asOf->copy()->addDay())
            ->where(function ($q) {
                $q->whereRaw('LOWER(service_name) NOT LIKE ?', ['%top up%'])
                    ->whereRaw('LOWER(service_name) NOT LIKE ?', ['%topup%'])
                    ->whereRaw('LOWER(service_name) NOT LIKE ?', ['%transfer%'])
                    ->whereRaw('LOWER(service_name) NOT LIKE ?', ['%penyesuaian%'])
                    ->whereRaw('LOWER(service_name) NOT LIKE ?', ['%redeem poin%']);
            })
            ->get(['created_at', 'amount', 'service_name']);

        foreach ($sales as $tx) {
            $d = Carbon::parse($tx->created_at)->toDateString();
            if (! isset($daily[$d])) {
                continue;
            }
            $daily[$d]['sales_amount'] += (float) $tx->amount;
            $daily[$d]['sales_count']++;
        }

        $historyDays = array_values($daily);
        $daysWithSales = collect($historyDays)->filter(fn ($r) => $r['sales_count'] > 0)->count();
        $sufficient = $daysWithSales >= self::MIN_HISTORY_DAYS;

        $amounts = collect($historyDays)->pluck('sales_amount')->map(fn ($v) => (float) $v);
        $movingAverageDaily = $sufficient ? round($amounts->avg(), 2) : null;

        $projected = [];
        if ($sufficient && $movingAverageDaily !== null) {
            for ($i = 1; $i <= self::HORIZON_DAYS; $i++) {
                $day = $asOf->copy()->addDays($i);
                $projected[] = [
                    'date' => $day->toDateString(),
                    'projected_sales_amount' => $movingAverageDaily,
                ];
            }
        }

        $providers = ProductProvider::query()
            ->whereIn('code', ['digiflazz', 'vipayment', 'vip', 'vip_pulsa'])
            ->orWhere(function ($q) {
                $q->whereRaw('LOWER(code) LIKE ?', ['%digi%'])
                    ->orWhereRaw('LOWER(code) LIKE ?', ['%vip%']);
            })
            ->get()
            ->unique('id')
            ->values();

        // Prefer exact Digiflazz / VIPayment when present
        $digi = ProductProvider::findByCode('digiflazz');
        $vip = ProductProvider::findByCode('vipayment')
            ?? ProductProvider::findByCode('vip')
            ?? ProductProvider::findByCode('vip_pulsa');

        $providerBalances = [
            [
                'code' => 'digiflazz',
                'name' => $digi?->name ?? 'Digiflazz',
                'balance' => $digi?->balance !== null ? (float) $digi->balance : null,
                'available' => $digi !== null,
            ],
            [
                'code' => 'vipayment',
                'name' => $vip?->name ?? 'VIPayment',
                'balance' => $vip?->balance !== null ? (float) $vip->balance : null,
                'available' => $vip !== null,
            ],
        ];

        return [
            'horizon_days' => self::HORIZON_DAYS,
            'method' => 'moving_average',
            'as_of' => $asOf->toIso8601String(),
            'generated_at' => now()->toIso8601String(),
            'sufficient_history' => $sufficient,
            'history_days_with_sales' => $daysWithSales,
            'min_history_days_required' => self::MIN_HISTORY_DAYS,
            'moving_average_daily_sales' => $movingAverageDaily,
            'projected_30_day_total' => $sufficient && $movingAverageDaily !== null
                ? round($movingAverageDaily * self::HORIZON_DAYS, 2)
                : null,
            'historical_cashflow' => $historyDays,
            'projected_cashflow' => $projected,
            'provider_balances' => $providerBalances,
            'source' => [
                'sales' => 'transactions SUCCESS wallet product purchases (amount), last 30 days',
                'providers' => 'product_providers.balance for Digiflazz + VIPayment',
            ],
            'disclaimer' => 'Projection is an estimate from historical moving average — not actual cash and not a guarantee.',
            'alert_thresholds' => null,
        ];
    }
}
