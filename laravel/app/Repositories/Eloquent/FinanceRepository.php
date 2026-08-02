<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\FinanceRepositoryInterface;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\PaymentHistory;
use App\Models\MidtransTransaction;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class FinanceRepository implements FinanceRepositoryInterface
{
    /**
     * Get aggregate dashboard financial metrics.
     */
    public function getDashboardMetrics(): array
    {
        $today = Carbon::today();
        $startOfMonth = Carbon::now()->startOfMonth();
        $endOfMonth = Carbon::now()->endOfMonth();

        $todayRevenue = (float) Transaction::whereIn('status', [TransactionStatus::SUCCESS->value, TransactionStatus::SUKSES->value])
            ->whereDate('created_at', $today)
            ->sum('total_payment');

        $monthlyRevenue = (float) Transaction::whereIn('status', [TransactionStatus::SUCCESS->value, TransactionStatus::SUKSES->value])
            ->whereBetween('created_at', [$startOfMonth, $endOfMonth])
            ->sum('total_payment');

        $totalTransactions = Transaction::count();

        $pendingSettlementCount = Transaction::whereIn('status', [TransactionStatus::PENDING->value, TransactionStatus::PROCESSING->value])
            ->count();

        $pendingSettlementAmount = (float) Transaction::whereIn('status', [TransactionStatus::PENDING->value, TransactionStatus::PROCESSING->value])
            ->sum('total_payment');

        $refundPendingCount = Transaction::whereIn('status', [TransactionStatus::FAILED->value, TransactionStatus::GAGAL->value, TransactionStatus::CANCELED->value])
            ->where('notes', 'like', '%refund%')
            ->count();

        $settlementSuccessCount = PaymentHistory::whereIn('status', ['success', 'settlement', 'capture'])->count();

        $recentTransactions = Transaction::with('user:id,name,email,phone_number')
            ->latest()
            ->take(10)
            ->get();

        return [
            'revenue_summary' => [
                'today_revenue' => $todayRevenue,
                'monthly_revenue' => $monthlyRevenue,
                'total_transactions' => $totalTransactions,
                'pending_settlement_count' => $pendingSettlementCount,
                'pending_settlement_amount' => $pendingSettlementAmount,
                'refund_pending_count' => $refundPendingCount,
                'settlement_success_count' => $settlementSuccessCount,
            ],
            'recent_transactions' => $recentTransactions,
        ];
    }

    /**
     * Get detailed financial report stream.
     */
    public function getFinancialReports(array $filters): array
    {
        $query = Transaction::with('user:id,name,email', 'paymentHistory');

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

        $grossRevenue = $transactions->whereIn('status', [TransactionStatus::SUCCESS->value, TransactionStatus::SUKSES->value])->sum('total_payment');
        $adminFees = $transactions->whereIn('status', [TransactionStatus::SUCCESS->value, TransactionStatus::SUKSES->value])->sum('admin_fee');
        $netRevenue = $grossRevenue - $adminFees;

        return [
            'summary' => [
                'total_records' => $transactions->count(),
                'gross_revenue' => (float) $grossRevenue,
                'total_admin_fees' => (float) $adminFees,
                'net_revenue' => (float) $netRevenue,
            ],
            'records' => $transactions,
        ];
    }

    /**
     * Get paginated refund list with filters.
     */
    public function getRefundClaims(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;

        $query = Transaction::with('user:id,name,email,phone_number');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        } else {
            // Default to failed, canceled, or transactions marked for refund
            $query->where(function ($q) {
                $q->whereIn('status', [TransactionStatus::FAILED->value, TransactionStatus::GAGAL->value, TransactionStatus::CANCELED->value])
                  ->orWhere('notes', 'like', '%refund%');
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

    /**
     * Find transaction by ID or Invoice number.
     */
    public function findTransaction(string|int $id): ?Transaction
    {
        return Transaction::with('user', 'paymentHistory')
            ->where('id', $id)
            ->orWhere('invoice_number', $id)
            ->first();
    }

    /**
     * Approve a refund for a transaction.
     */
    public function approveRefund(Transaction $transaction, ?string $notes = null): Transaction
    {
        return DB::transaction(function () use ($transaction, $notes) {
            // Find user wallet
            $wallet = Wallet::where('user_id', $transaction->user_id)->first();
            if ($wallet) {
                $refundAmount = $transaction->total_payment;
                $wallet->balance += $refundAmount;
                $wallet->save();

                WalletHistory::create([
                    'wallet_id' => $wallet->id,
                    'amount' => $refundAmount,
                    'type' => WalletHistoryType::CREDIT->value,
                    'description' => "Pengembalian dana (Refund) Invoice #" . $transaction->invoice_number,
                    'reference_id' => $transaction->invoice_number,
                ]);
            }

            $transaction->status = TransactionStatus::CANCELED->value;
            $transaction->notes = trim(($transaction->notes ? $transaction->notes . " | " : "") . "Refund Disetujui: " . ($notes ?? 'Diproses oleh Finance'));
            $transaction->save();

            return $transaction->fresh(['user', 'paymentHistory']);
        });
    }

    /**
     * Reject a refund claim.
     */
    public function rejectRefund(Transaction $transaction, ?string $reason = null): Transaction
    {
        $transaction->notes = trim(($transaction->notes ? $transaction->notes . " | " : "") . "Refund Ditolak: " . ($reason ?? 'Tidak memenuhi syarat'));
        $transaction->save();

        return $transaction->fresh(['user', 'paymentHistory']);
    }

    /**
     * Get paginated settlements history/status.
     */
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

        return $query->latest()->paginate($perPage);
    }
}
