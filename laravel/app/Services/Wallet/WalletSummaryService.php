<?php

namespace App\Services\Wallet;

use App\Enums\WalletHistoryType;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\WalletHistory;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class WalletSummaryService
{
    /**
     * Build the production wallet overview payload (single source of truth).
     *
     * Ledger rows in wallet_histories are only written when balance actually changes
     * (successful top-up settlement, purchase debit, refund credit, transfer, etc.).
     * Pending/failed/cancelled/expired transactions never appear here.
     */
    public function buildOverview(Wallet $wallet, int $recentLimit = 20): array
    {
        $monthStart = Carbon::now()->startOfMonth();
        $monthEnd = Carbon::now()->endOfMonth();

        $monthAggregates = WalletHistory::query()
            ->where('wallet_id', $wallet->id)
            ->whereBetween('created_at', [$monthStart, $monthEnd])
            ->selectRaw("
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as income_this_month,
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as expense_this_month,
                COUNT(*) as transaction_count
            ")
            ->first();

        $recentRows = WalletHistory::query()
            ->where('wallet_id', $wallet->id)
            ->latest('created_at')
            ->limit($recentLimit)
            ->get();

        $transactionsById = $this->loadReferencedTransactions($recentRows);

        return [
            'wallet' => [
                'id' => $wallet->id,
                'balance' => (float) $wallet->balance,
                'wallet_id' => (string) $wallet->wallet_number,
                'walletNo' => (string) $wallet->wallet_number,
                'reward_points' => (int) ($wallet->points ?? 0),
                'points' => (int) ($wallet->points ?? 0),
                'currency' => $wallet->currency ?? 'IDR',
                'status' => $wallet->status,
                'lastUpdated' => $wallet->updated_at?->toIso8601String(),
                'createdAt' => $wallet->created_at?->toIso8601String(),
            ],
            'summary' => [
                'income_this_month' => (float) ($monthAggregates->income_this_month ?? 0),
                'expense_this_month' => (float) ($monthAggregates->expense_this_month ?? 0),
                'transaction_count' => (int) ($monthAggregates->transaction_count ?? 0),
            ],
            'recent_transactions' => $recentRows
                ->map(fn (WalletHistory $row) => $this->mapHistoryRow($row, $transactionsById))
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  Collection<int, WalletHistory>  $rows
     * @return Collection<int|string, Transaction>
     */
    protected function loadReferencedTransactions(Collection $rows): Collection
    {
        $ids = $rows
            ->pluck('reference_id')
            ->filter(fn ($id) => filled($id) && is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            return collect();
        }

        return Transaction::query()
            ->whereIn('id', $ids)
            ->get(['id', 'invoice_number', 'service_name', 'status', 'completed_at'])
            ->keyBy('id');
    }

    /**
     * @param  Collection<int|string, Transaction>  $transactionsById
     */
    protected function mapHistoryRow(WalletHistory $row, Collection $transactionsById): array
    {
        $type = strtolower((string) $row->type);
        $isCredit = $type === WalletHistoryType::CREDIT->value
            || str_contains($type, 'credit');

        $transaction = null;
        if (filled($row->reference_id) && is_numeric($row->reference_id)) {
            $transaction = $transactionsById->get((int) $row->reference_id);
        }

        return [
            'id' => $row->id,
            'wallet_id' => $row->wallet_id,
            'amount' => (float) $row->amount,
            'type' => $isCredit ? WalletHistoryType::CREDIT->value : WalletHistoryType::DEBIT->value,
            'direction' => $isCredit ? 'credit' : 'debit',
            'description' => $row->description,
            'reference_id' => $row->reference_id,
            'invoice_number' => $transaction?->invoice_number,
            'service_name' => $transaction?->service_name,
            'status' => $transaction?->status?->value ?? $transaction?->status ?? 'success',
            'created_at' => $row->created_at?->toIso8601String(),
            'updated_at' => $row->updated_at?->toIso8601String(),
        ];
    }
}
