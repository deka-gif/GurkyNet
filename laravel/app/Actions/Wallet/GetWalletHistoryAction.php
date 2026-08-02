<?php

namespace App\Actions\Wallet;

use App\Models\Wallet;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;

class GetWalletHistoryAction
{
    protected WalletHistoryRepositoryInterface $historyRepository;

    public function __construct(WalletHistoryRepositoryInterface $historyRepository)
    {
        $this->historyRepository = $historyRepository;
    }

    public function execute(Wallet $wallet, array $filters = []): LengthAwarePaginator
    {
        return $this->historyRepository->getPaginatedHistory($wallet->id, $filters);
    }
}
