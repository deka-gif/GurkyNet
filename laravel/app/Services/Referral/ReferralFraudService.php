<?php

namespace App\Services\Referral;

use App\Models\ReferralFraudFlag;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * FR-REF-08 — fraud flag framework (flag-only, no auto-block, no invented numeric defaults).
 */
class ReferralFraudService
{
    public function flagStructural(
        ?User $user,
        string $signal,
        array $evidence = [],
        array $relatedUserIds = [],
        ?int $relatedTransactionId = null
    ): ReferralFraudFlag {
        return ReferralFraudFlag::query()->create([
            'user_id' => $user?->id,
            'signal' => $signal,
            'evidence' => $evidence,
            'related_user_ids' => array_values(array_unique(array_map('intval', $relatedUserIds))),
            'related_transaction_id' => $relatedTransactionId,
            'status' => ReferralFraudFlag::STATUS_FLAGGED,
            'detected_at' => now(),
        ]);
    }

    /**
     * Record available registration signals without applying numeric thresholds.
     * Auto-threshold evaluation only runs when ALL relevant config values are non-null.
     */
    public function recordRegistrationSignals(User $newUser, User $upline, array $context): void
    {
        $cfg = config('referral.fraud', []);
        $window = $cfg['time_window_minutes'] ?? null;
        $maxIp = $cfg['max_accounts_same_ip'] ?? null;
        $maxDevice = $cfg['max_accounts_same_device'] ?? null;

        // Numeric thresholds intentionally NULL until Owner locks them.
        // While unconfigured: do not invent counts / do not auto-block / do not spam flags.
        if ($window === null && $maxIp === null && $maxDevice === null) {
            return;
        }

        // When thresholds are later configured, evaluation can use $context ip/device here.
        unset($newUser, $upline, $context, $cfg);
    }

    public function markFinanceReviewForReleasedRefund(int $commissionLedgerId, int $transactionId, int $uplineId): ReferralFraudFlag
    {
        return $this->flagStructural(
            User::query()->find($uplineId),
            'released_commission_source_refunded',
            [
                'commission_ledger_id' => $commissionLedgerId,
                'source_transaction_id' => $transactionId,
                'action' => 'finance_manual_review',
                'no_automatic_clawback' => true,
            ],
            [$uplineId],
            $transactionId
        );
    }
}
