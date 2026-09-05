<?php

namespace App\Services\Wallet;

use App\Models\WalletMutation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Shared balance-affecting mutation rules for reconciliation + customer statements.
 *
 * Source of truth: wallet_mutations (SRS 7.6 / 14.2 / 18.1).
 * Excludes Finance-approve TYPE_WITHDRAW markers that share a HOLD reference
 * (balance already moved on hold — ApproveWithdrawAction does not debit again).
 */
class WalletMutationBalanceQuery
{
    /**
     * Restrict a wallet_mutations query to rows that affect wallet.balance.
     *
     * @param  Builder<WalletMutation>  $query
     * @return Builder<WalletMutation>
     */
    public function applyBalanceAffectingFilter(Builder $query): Builder
    {
        return $query->where(function ($q) {
            $q->where('type', '!=', WalletMutation::TYPE_WITHDRAW)
                ->orWhereNotExists(function ($sub) {
                    $sub->selectRaw('1')
                        ->from('wallet_mutations as holds')
                        ->whereColumn('holds.wallet_id', 'wallet_mutations.wallet_id')
                        ->whereColumn('holds.reference_id', 'wallet_mutations.reference_id')
                        ->where('holds.type', WalletMutation::TYPE_HOLD)
                        ->whereNotNull('holds.reference_id');
                });
        });
    }

    /**
     * @param  Builder<WalletMutation>  $query
     * @return Builder<WalletMutation>
     */
    public function forWallet(Builder $query, int $walletId): Builder
    {
        return $query->where('wallet_id', $walletId);
    }

    /**
     * Half-open / exclusive upper bound helpers for statement periods.
     *
     * @param  Builder<WalletMutation>  $query
     * @return Builder<WalletMutation>
     */
    public function createdBefore(Builder $query, Carbon $exclusiveEnd): Builder
    {
        return $query->where('created_at', '<', $exclusiveEnd);
    }

    /**
     * @param  Builder<WalletMutation>  $query
     * @return Builder<WalletMutation>
     */
    public function createdInHalfOpen(Builder $query, Carbon $startInclusive, Carbon $endExclusive): Builder
    {
        return $query
            ->where('created_at', '>=', $startInclusive)
            ->where('created_at', '<', $endExclusive);
    }

    /**
     * Σ signed amounts for balance-affecting mutations (optional time bounds).
     */
    public function sumSigned(
        int $walletId,
        ?Carbon $createdBeforeExclusive = null,
        ?Carbon $createdFromInclusive = null
    ): float {
        $query = WalletMutation::query();
        $this->forWallet($query, $walletId);
        $this->applyBalanceAffectingFilter($query);

        if ($createdFromInclusive !== null) {
            $query->where('created_at', '>=', $createdFromInclusive);
        }
        if ($createdBeforeExclusive !== null) {
            $this->createdBefore($query, $createdBeforeExclusive);
        }

        return round((float) $query->sum('amount'), 2);
    }

    /**
     * Expected current balance from full ledger (same semantics as recon).
     */
    public function expectedBalance(int $walletId): float
    {
        return $this->sumSigned($walletId);
    }

    /**
     * Income (positive signed) / expense (absolute of negative signed) in a half-open period.
     *
     * @return array{income: float, expense: float}
     */
    public function periodIncomeExpense(int $walletId, Carbon $startInclusive, Carbon $endExclusive): array
    {
        $query = WalletMutation::query();
        $this->forWallet($query, $walletId);
        $this->applyBalanceAffectingFilter($query);
        $this->createdInHalfOpen($query, $startInclusive, $endExclusive);

        $row = $query
            ->selectRaw('COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income')
            ->selectRaw('COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) as expense')
            ->first();

        return [
            'income' => round((float) ($row->income ?? 0), 2),
            'expense' => round((float) ($row->expense ?? 0), 2),
        ];
    }

    /**
     * Whether a loaded mutation row affects balance (in-PHP check for markers).
     */
    public function mutationAffectsBalance(WalletMutation $mutation): bool
    {
        if ($mutation->type !== WalletMutation::TYPE_WITHDRAW) {
            return true;
        }

        if ($mutation->reference_id === null || $mutation->reference_id === '') {
            return true;
        }

        return ! WalletMutation::query()
            ->where('wallet_id', $mutation->wallet_id)
            ->where('type', WalletMutation::TYPE_HOLD)
            ->where('reference_id', $mutation->reference_id)
            ->exists();
    }
}
