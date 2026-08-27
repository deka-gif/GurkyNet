<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\FinanceRepositoryInterface;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\PaymentHistory;
use App\Models\MidtransTransaction;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class FinanceRepository implements FinanceRepositoryInterface
{
    /**
     * Get aggregate dashboard financial metrics from real transactions / wallet ledger.
     */
    public function getDashboardMetrics(): array
    {
        $today = Carbon::today();
        $yesterday = Carbon::yesterday();
        $startOfMonth = Carbon::now()->startOfMonth();
        $endOfMonth = Carbon::now()->endOfMonth();

        $successStatuses = [TransactionStatus::SUCCESS->value, TransactionStatus::SUKSES->value];

        $todayRevenue = (float) Transaction::whereIn('status', $successStatuses)
            ->whereDate('created_at', $today)
            ->sum('total_payment');

        $yesterdayRevenue = (float) Transaction::whereIn('status', $successStatuses)
            ->whereDate('created_at', $yesterday)
            ->sum('total_payment');

        $monthlyRevenue = (float) Transaction::whereIn('status', $successStatuses)
            ->whereBetween('created_at', [$startOfMonth, $endOfMonth])
            ->sum('total_payment');

        $todayTrxCount = (int) Transaction::whereDate('created_at', $today)->count();
        $todaySuccessCount = (int) Transaction::whereIn('status', $successStatuses)
            ->whereDate('created_at', $today)
            ->count();

        $totalTransactions = Transaction::count();

        $pendingSettlementCount = Transaction::whereIn('status', [
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ])->count();

        $pendingSettlementAmount = (float) Transaction::whereIn('status', [
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ])->sum('total_payment');

        $refundPendingCount = Transaction::whereIn('status', [
            TransactionStatus::FAILED->value,
            TransactionStatus::GAGAL->value,
            TransactionStatus::CANCELED->value,
        ])->where('notes', 'like', '%refund%')->count();

        $refundPendingAmount = (float) Transaction::whereIn('status', [
            TransactionStatus::FAILED->value,
            TransactionStatus::GAGAL->value,
            TransactionStatus::CANCELED->value,
        ])->where('notes', 'like', '%refund%')->sum('total_payment');

        $settlementSuccessCount = PaymentHistory::whereIn('status', ['success', 'settlement', 'capture'])->count();
        if ($settlementSuccessCount === 0) {
            $settlementSuccessCount = MidtransTransaction::whereIn('transaction_status', ['settlement', 'capture', 'success'])->count();
        }

        $profitMetrics = $this->calculateProfitMetrics($successStatuses);
        $walletLedger = $this->getWalletLedgerSummary();

        $revenueGrowth = $yesterdayRevenue > 0
            ? round((($todayRevenue - $yesterdayRevenue) / $yesterdayRevenue) * 100, 1) . '%'
            : ($todayRevenue > 0 ? '+100%' : '0%');

        $recentTransactions = Transaction::with('user:id,name,email,phone_number')
            ->latest()
            ->take(10)
            ->get();

        $latestPayments = $recentTransactions->map(function (Transaction $tx) {
            return [
                'id' => $tx->id,
                'invoice' => $tx->invoice_number,
                'invoice_number' => $tx->invoice_number,
                'customer' => $tx->user?->name,
                'customer_name' => $tx->user?->name,
                'service' => $tx->service_name,
                'amount' => (float) $tx->total_payment,
                'status' => $tx->status,
                'payment_method' => $tx->payment_method,
                'created_at' => optional($tx->created_at)?->toIso8601String(),
                'date' => optional($tx->created_at)?->format('d M Y H:i'),
            ];
        })->values()->all();

        $statusSummaries = collect([
            TransactionStatus::SUCCESS->value,
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
            TransactionStatus::FAILED->value,
        ])->map(function (string $status) {
            $count = Transaction::where('status', $status)->count();
            $amount = (float) Transaction::where('status', $status)->sum('total_payment');
            $label = match ($status) {
                'success', 'sukses' => 'Paid',
                'pending' => 'Pending',
                'processing' => 'Processing',
                default => 'Failed',
            };

            return [
                'status' => $label,
                'label' => $label,
                'raw_status' => $status,
                'count' => $count,
                'amount' => $amount,
                'amountFormatted' => 'Rp ' . number_format($amount, 0, ',', '.'),
            ];
        })->values()->all();

        $revenueChart = $this->buildRevenueChart(14);

        $summary = [
            'todaysRevenueFormatted' => 'Rp ' . number_format($todayRevenue, 0, ',', '.'),
            'monthlyRevenueFormatted' => 'Rp ' . number_format($monthlyRevenue, 0, ',', '.'),
            'totalRevenue' => $todayRevenue,
            'today_revenue' => $todayRevenue,
            'monthlyRevenue' => $monthlyRevenue,
            'monthly_revenue' => $monthlyRevenue,
            'revenueGrowth' => $revenueGrowth,
            'todaysTransactions' => $todayTrxCount,
            'todaysSuccessTransactions' => $todaySuccessCount,
            'totalTransactions' => $totalTransactions,
            'pendingSettlement' => $pendingSettlementAmount,
            'pendingSettlementFormatted' => 'Rp ' . number_format($pendingSettlementAmount, 0, ',', '.'),
            'pendingSettlementNotes' => $pendingSettlementCount . ' transaksi menunggu',
            'pending_settlement_count' => $pendingSettlementCount,
            'pending_settlement_amount' => $pendingSettlementAmount,
            'pendingRefundsCount' => $refundPendingCount,
            'pendingRefundsValueFormatted' => 'Rp ' . number_format($refundPendingAmount, 0, ',', '.'),
            'refund_pending_count' => $refundPendingCount,
            'settlement_success_count' => $settlementSuccessCount,
            'autoSettlementRate' => $totalTransactions > 0
                ? round(($settlementSuccessCount / max($totalTransactions, 1)) * 100, 1) . '%'
                : '0%',
            'profit' => $profitMetrics['profit'],
            'profitFormatted' => 'Rp ' . number_format($profitMetrics['profit'], 0, ',', '.'),
            'margin' => $profitMetrics['margin_total'],
            'marginFormatted' => 'Rp ' . number_format($profitMetrics['margin_total'], 0, ',', '.'),
            'expenses' => $profitMetrics['expenses'],
            'expensesFormatted' => 'Rp ' . number_format($profitMetrics['expenses'], 0, ',', '.'),
            'provider_cost' => $profitMetrics['provider_cost'],
            'wallet_ledger_balance' => $walletLedger['total_balance'],
            'walletLedgerBalanceFormatted' => 'Rp ' . number_format($walletLedger['total_balance'], 0, ',', '.'),
        ];

        return [
            'summary' => $summary,
            'revenue_summary' => $summary,
            'revenueChart' => $revenueChart,
            'chart' => $revenueChart,
            'statusSummaries' => $statusSummaries,
            'statuses' => $statusSummaries,
            'latestPayments' => $latestPayments,
            'payments' => $latestPayments,
            'recent_transactions' => $recentTransactions,
            'profit_summary' => $profitMetrics,
            'wallet_ledger' => $walletLedger,
        ];
    }

    /**
     * Profit / margin / expenses derived from master product costs stored on transaction items.
     */
    protected function calculateProfitMetrics(array $successStatuses): array
    {
        $successTxIds = Transaction::whereIn('status', $successStatuses)->pluck('id');

        $items = TransactionItem::whereIn('transaction_id', $successTxIds)->get();

        $providerCost = 0.0;
        $marginTotal = 0.0;
        $sellTotal = 0.0;

        foreach ($items as $item) {
            $meta = is_array($item->custom_metadata) ? $item->custom_metadata : [];
            $base = (float) ($meta['base_price'] ?? 0);
            $margin = (float) ($meta['margin'] ?? 0);
            $lineSell = (float) $item->price * (int) $item->quantity;

            if ($base <= 0 && $margin <= 0) {
                // Fallback: treat sell price as revenue with unknown cost
                $sellTotal += $lineSell;
                continue;
            }

            $providerCost += $base * (int) $item->quantity;
            $marginTotal += $margin * (int) $item->quantity;
            $sellTotal += $lineSell;
        }

        $grossRevenue = (float) Transaction::whereIn('status', $successStatuses)->sum('total_payment');
        $adminFees = (float) Transaction::whereIn('status', $successStatuses)->sum('admin_fee');

        $refundExpense = (float) WalletHistory::where('type', WalletHistoryType::CREDIT->value)
            ->where(function ($q) {
                $q->where('description', 'like', '%Refund%')
                    ->orWhere('description', 'like', '%Pengembalian%');
            })
            ->sum('amount');

        $profit = $marginTotal + $adminFees - $refundExpense;
        if ($items->isEmpty()) {
            // No item metadata yet — approximate profit as admin fees only
            $profit = $adminFees - $refundExpense;
        }

        return [
            'gross_revenue' => $grossRevenue,
            'provider_cost' => round($providerCost, 2),
            'margin_total' => round($marginTotal, 2),
            'admin_fees' => round($adminFees, 2),
            'refund_expense' => round($refundExpense, 2),
            'expenses' => round($providerCost + $refundExpense, 2),
            'profit' => round($profit, 2),
            'sell_total' => round($sellTotal, 2),
        ];
    }

    /**
     * Platform-wide wallet ledger snapshot.
     */
    protected function getWalletLedgerSummary(): array
    {
        $totalBalance = (float) Wallet::sum('balance');
        $creditTotal = (float) WalletHistory::where('type', WalletHistoryType::CREDIT->value)->sum('amount');
        $debitTotal = (float) WalletHistory::where('type', WalletHistoryType::DEBIT->value)->sum('amount');

        $recent = WalletHistory::with('wallet.user:id,name,email')
            ->latest()
            ->take(15)
            ->get()
            ->map(function (WalletHistory $row) {
                return [
                    'id' => $row->id,
                    'type' => $row->type,
                    'amount' => (float) $row->amount,
                    'description' => $row->description,
                    'reference_id' => $row->reference_id,
                    'user' => $row->wallet?->user?->name,
                    'created_at' => optional($row->created_at)?->toIso8601String(),
                ];
            })
            ->values()
            ->all();

        return [
            'total_balance' => $totalBalance,
            'total_credits' => $creditTotal,
            'total_debits' => $debitTotal,
            'recent_entries' => $recent,
        ];
    }

    protected function buildRevenueChart(int $days = 14): array
    {
        $chart = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = Carbon::today()->subDays($i);
            $revenue = (float) Transaction::whereIn('status', [
                TransactionStatus::SUCCESS->value,
                TransactionStatus::SUKSES->value,
            ])->whereDate('created_at', $date)->sum('total_payment');

            $trx = (int) Transaction::whereIn('status', [
                TransactionStatus::SUCCESS->value,
                TransactionStatus::SUKSES->value,
            ])->whereDate('created_at', $date)->count();

            $chart[] = [
                'date' => $date->format('d M'),
                'day' => $date->toDateString(),
                'label' => $date->format('d M'),
                'revenue' => $revenue,
                'amount' => $revenue,
                'transactions' => $trx,
            ];
        }

        return $chart;
    }

    /**
     * Get detailed financial report stream with real profit / margin / expenses.
     */
    public function getFinancialReports(array $filters): array
    {
        $query = Transaction::with(['user:id,name,email', 'paymentHistory', 'items']);

        if (!empty($filters['start_date'])) {
            $query->whereDate('created_at', '>=', Carbon::parse($filters['start_date']));
        }

        if (!empty($filters['end_date'])) {
            $query->whereDate('created_at', '<=', Carbon::parse($filters['end_date']));
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['payment_method'])) {
            $query->where('payment_method', $filters['payment_method']);
        }

        $transactions = $query->latest()->get();
        $success = $transactions->whereIn('status', [
            TransactionStatus::SUCCESS->value,
            TransactionStatus::SUKSES->value,
        ]);

        $grossRevenue = (float) $success->sum('total_payment');
        $adminFees = (float) $success->sum('admin_fee');

        $providerCost = 0.0;
        $marginTotal = 0.0;
        foreach ($success as $tx) {
            foreach ($tx->items as $item) {
                $meta = is_array($item->custom_metadata) ? $item->custom_metadata : [];
                $providerCost += (float) ($meta['base_price'] ?? 0) * (int) $item->quantity;
                $marginTotal += (float) ($meta['margin'] ?? 0) * (int) $item->quantity;
            }
        }

        $refundExpense = (float) $transactions->filter(function (Transaction $tx) {
            return str_contains(strtolower((string) $tx->notes), 'refund');
        })->sum('total_payment');

        $records = $transactions->map(function (Transaction $tx) {
            $itemMargin = 0.0;
            $itemCost = 0.0;
            foreach ($tx->items as $item) {
                $meta = is_array($item->custom_metadata) ? $item->custom_metadata : [];
                $itemMargin += (float) ($meta['margin'] ?? 0) * (int) $item->quantity;
                $itemCost += (float) ($meta['base_price'] ?? 0) * (int) $item->quantity;
            }

            return [
                'id' => $tx->id,
                'invoice_number' => $tx->invoice_number,
                'customer' => $tx->user?->name,
                'service_name' => $tx->service_name,
                'payment_method' => $tx->payment_method,
                'status' => $tx->status,
                'amount' => (float) $tx->amount,
                'admin_fee' => (float) $tx->admin_fee,
                'total_payment' => (float) $tx->total_payment,
                'provider_cost' => $itemCost,
                'margin' => $itemMargin,
                'profit' => $itemMargin + (float) $tx->admin_fee,
                'created_at' => optional($tx->created_at)?->toIso8601String(),
                'settlement_status' => $tx->paymentHistory?->status,
                'gateway' => $tx->paymentHistory?->gateway,
            ];
        })->values()->all();

        return [
            'summary' => [
                'total_records' => $transactions->count(),
                'gross_revenue' => $grossRevenue,
                'total_admin_fees' => $adminFees,
                'net_revenue' => $grossRevenue - $adminFees,
                'provider_cost' => round($providerCost, 2),
                'margin' => round($marginTotal, 2),
                'expenses' => round($providerCost + $refundExpense, 2),
                'refund_expense' => round($refundExpense, 2),
                'profit' => round($marginTotal + $adminFees - $refundExpense, 2),
                'customers' => $transactions->pluck('user_id')->filter()->unique()->count(),
                'providers' => $transactions->pluck('service_name')->filter()->unique()->count(),
            ],
            'records' => $records,
        ];
    }

    public function getRefundClaims(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;

        $query = Transaction::with('user:id,name,email,phone_number');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        } else {
            $query->where(function ($q) {
                $q->whereIn('status', [
                    TransactionStatus::FAILED->value,
                    TransactionStatus::GAGAL->value,
                    TransactionStatus::CANCELED->value,
                ])->orWhere('notes', 'like', '%refund%');
            });
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        return $query->latest()->paginate($perPage);
    }

    public function findTransaction(string|int $id): ?Transaction
    {
        return Transaction::with('user', 'paymentHistory')
            ->where('id', $id)
            ->orWhere('invoice_number', $id)
            ->first();
    }

    public function approveRefund(Transaction $transaction, ?string $notes = null): Transaction
    {
        $refundService = app(\App\Services\WalletRefundService::class);
        $note = 'Refund Disetujui: ' . ($notes ?? 'Diproses oleh Finance');

        // FR-DIFF-09 / SRS 14.3 — SUCCESS complaint refunds must become REFUNDED (never FAILED).
        if (TransactionStatusMapper::isSuccess($transaction->status)) {
            $result = $refundService->refundSuccessToRefunded(
                $transaction,
                'Refund Finance: ' . $transaction->invoice_number,
                'finance',
                $note
            );
        } else {
            $result = $refundService->refundOnce(
                $transaction,
                'Refund Finance: ' . $transaction->invoice_number,
                'finance',
                $note,
                // Keep canceled for Finance queue compatibility (pre-Sprint 3); SUCCESS path uses REFUNDED.
                TransactionStatus::CANCELED->value
            );
        }

        $refundService->writeAudit(
            auth()->id(),
            $result['already_refunded'] ? 'FINANCE_REFUND_ALREADY_PROCESSED' : 'FINANCE_APPROVE_REFUND',
            [
                'transaction_id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'notes' => $notes,
                'credited' => $result['credited'],
                'final_status' => $result['transaction']->status ?? null,
            ]
        );

        return $result['transaction'];
    }

    public function rejectRefund(Transaction $transaction, ?string $reason = null): Transaction
    {
        $transaction->notes = trim(($transaction->notes ? $transaction->notes . ' | ' : '') . 'Refund Ditolak: ' . ($reason ?? 'Tidak memenuhi syarat'));
        $transaction->save();

        try {
            app(\App\Services\Finance\FinanceLedgerService::class)->record([
                'user_id' => $transaction->user_id,
                'transaction_id' => $transaction->id,
                'invoice' => $transaction->invoice_number,
                'source_module' => 'finance',
                'event_type' => 'refund_reject',
                'debit' => 0,
                'credit' => 0,
                'reference' => $reason ?? 'Refund rejected',
                'meta' => ['notes' => $transaction->notes],
            ]);
        } catch (\Throwable $e) {
            // ledger hook must not block reject
        }

        return $transaction->fresh(['user', 'paymentHistory']);
    }

    public function getSettlements(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;

        $query = PaymentHistory::with('transaction.user:id,name,email');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['gateway'])) {
            $query->where('gateway', $filters['gateway']);
        }

        if (!empty($filters['start_date'])) {
            $query->whereDate('created_at', '>=', Carbon::parse($filters['start_date']));
        }

        if (!empty($filters['end_date'])) {
            $query->whereDate('created_at', '<=', Carbon::parse($filters['end_date']));
        }

        // If payment_histories is empty (legacy data), expose Midtrans settlements as PaymentHistory-shaped rows
        if ($query->count() === 0 && empty($filters['gateway'])) {
            $midQuery = MidtransTransaction::with('transaction.user:id,name,email');

            if (!empty($filters['status'])) {
                $midQuery->where('transaction_status', $filters['status']);
            }
            if (!empty($filters['start_date'])) {
                $midQuery->whereDate('created_at', '>=', Carbon::parse($filters['start_date']));
            }
            if (!empty($filters['end_date'])) {
                $midQuery->whereDate('created_at', '<=', Carbon::parse($filters['end_date']));
            }

            return $midQuery->latest()->paginate($perPage)->through(function (MidtransTransaction $row) {
                return [
                    'id' => $row->id,
                    'transaction_id' => $row->transaction_id,
                    'gateway' => 'midtrans',
                    'payment_code' => $row->order_id,
                    'status' => $row->transaction_status,
                    'payload' => null,
                    'response' => $row->raw_notification,
                    'created_at' => $row->created_at,
                    'transaction' => $row->transaction,
                    'gross_amount' => (float) $row->gross_amount,
                ];
            });
        }

        return $query->latest()->paginate($perPage);
    }
}
