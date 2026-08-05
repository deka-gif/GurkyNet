<?php

namespace App\Actions\Admin\Finance;

use App\Repositories\Contracts\FinanceRepositoryInterface;
use App\Models\Transaction;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class FinanceRefundAction
{
    public function __construct(
        protected FinanceRepositoryInterface $financeRepository
    ) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->financeRepository->getRefundClaims($filters);
    }

    public function find(string|int $id): ?Transaction
    {
        return $this->financeRepository->findTransaction($id);
    }

    public function approve(string|int $id, ?string $notes = null): Transaction
    {
        $transaction = $this->financeRepository->findTransaction($id);
        if (!$transaction) {
            throw new \Exception("Transaksi tidak ditemukan.", 404);
        }

        return $this->financeRepository->approveRefund($transaction, $notes);
    }

    public function reject(string|int $id, ?string $reason = null): Transaction
    {
        $transaction = $this->financeRepository->findTransaction($id);
        if (!$transaction) {
            throw new \Exception("Transaksi tidak ditemukan.", 404);
        }

        return $this->financeRepository->rejectRefund($transaction, $reason);
    }
}
