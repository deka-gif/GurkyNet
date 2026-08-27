<?php

namespace App\Services\Wallet;

use App\Enums\WalletHistoryType;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;

/**
 * SRS 14.2 — every balance change must INSERT wallet_mutations.
 * Dual-write wallet_histories for UI/report compatibility (locked Sprint 3 decision).
 */
class WalletLedgerService
{
    public function __construct(
        protected WalletHistoryRepositoryInterface $historyRepository
    ) {}

    /**
     * Record mutation + compatibility history. Does NOT change wallet.balance
     * (caller must already have updated balance under lockForUpdate).
     *
     * @param  'hold'|'topup'|'purchase'|'withdraw'|'refund'|'adjustment'|'loyalty_redeem'|'referral_commission'  $mutationType
     * @param  'credit'|'debit'  $historyDirection
     */
    public function record(
        Wallet $wallet,
        string $mutationType,
        float $amount,
        string $historyDirection,
        string $historyDescription,
        string|int|null $referenceId = null,
        ?int $approvedBy = null
    ): WalletMutation {
        $signedAmount = $historyDirection === 'debit'
            ? -1 * abs($amount)
            : abs($amount);

        // hold/purchase debits are stored as positive magnitude with type conveying meaning;
        // amount column accepts signed values per SRS 7.6 ("positif/negatif").
        $mutation = WalletMutation::create([
            'wallet_id' => $wallet->id,
            'type' => $mutationType,
            'amount' => $signedAmount,
            'reference_id' => $referenceId !== null ? (string) $referenceId : null,
            'approved_by' => $approvedBy,
        ]);

        $this->historyRepository->create([
            'wallet_id' => $wallet->id,
            'amount' => abs($amount),
            'type' => $historyDirection === 'debit'
                ? WalletHistoryType::DEBIT->value
                : WalletHistoryType::CREDIT->value,
            'description' => $historyDescription,
            'reference_id' => $referenceId,
        ]);

        return $mutation;
    }
}
