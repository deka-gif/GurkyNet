<?php

namespace App\Repositories\Contracts;

use App\Models\Transaction;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface FinanceRepositoryInterface
{
    /**
     * Get aggregate dashboard financial metrics.
     */
    public function getDashboardMetrics(): array;

    /**
     * Get detailed financial report stream.
     */
    public function getFinancialReports(array $filters): array;

    /**
     * Get paginated refund list with filters.
     */
    public function getRefundClaims(array $filters): LengthAwarePaginator;

    /**
     * Find transaction for refund processing.
     */
    public function findTransaction(string|int $id): ?Transaction;

    /**
     * Approve a refund for a transaction.
     */
    public function approveRefund(Transaction $transaction, ?string $notes = null): Transaction;

    /**
     * Reject a refund claim.
     */
    public function rejectRefund(Transaction $transaction, ?string $reason = null): Transaction;

    /**
     * Get paginated settlements history/status.
     */
    public function getSettlements(array $filters): LengthAwarePaginator;
}
