<?php

namespace App\Repositories\Eloquent;

use App\Models\WalletHistory;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class WalletHistoryRepository implements WalletHistoryRepositoryInterface
{
    public function create(array $data): WalletHistory
    {
        return WalletHistory::create([
            'wallet_id' => $data['wallet_id'],
            'amount' => $data['amount'],
            'type' => $data['type'],
            'description' => $data['description'],
            'reference_id' => $data['reference_id'] ?? null,
        ]);
    }

    public function getPaginatedHistory(int $walletId, array $filters = []): LengthAwarePaginator
    {
        $query = WalletHistory::where('wallet_id', $walletId);

        // Filter by Date (e.g. start_date, end_date)
        if (!empty($filters['start_date'])) {
            $query->whereDate('created_at', '>=', $filters['start_date']);
        }
        if (!empty($filters['end_date'])) {
            $query->whereDate('created_at', '<=', $filters['end_date']);
        }

        // Filter by Type (credit/debit)
        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        // Filter by Amount
        if (!empty($filters['min_amount'])) {
            $query->where('amount', '>=', $filters['min_amount']);
        }
        if (!empty($filters['max_amount'])) {
            $query->where('amount', '<=', $filters['max_amount']);
        }

        $perPage = $filters['per_page'] ?? 10;

        return $query->latest()->paginate($perPage);
    }
}
