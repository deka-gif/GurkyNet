<?php

namespace App\Repositories\Contracts;

use App\Models\WalletHistory;
use Illuminate\Pagination\LengthAwarePaginator;

interface WalletHistoryRepositoryInterface
{
    public function create(array $data): WalletHistory;
    public function getPaginatedHistory(int $walletId, array $filters = []): LengthAwarePaginator;
}
