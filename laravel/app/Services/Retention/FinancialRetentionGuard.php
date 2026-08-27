<?php

namespace App\Services\Retention;

use App\Models\KycVerification;
use App\Models\PaymentHistory;
use App\Models\Transaction;
use App\Models\User;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use RuntimeException;

/**
 * Sprint 18 — financial retention ≥10 years (SRS 22 / 27.7).
 * Blocks privacy cleanup from deleting financial / KYC records still in retention.
 */
class FinancialRetentionGuard
{
    public function financialRetentionYears(): int
    {
        return (int) config('retention.financial_years', 10);
    }

    public function financialRetainUntil(CarbonInterface $createdAt): Carbon
    {
        return Carbon::parse($createdAt)->copy()->addYears($this->financialRetentionYears());
    }

    public function isFinancialStillProtected(CarbonInterface $createdAt, ?CarbonInterface $now = null): bool
    {
        $now = $now ?? now();

        return $now->lt($this->financialRetainUntil($createdAt));
    }

    /**
     * @throws RuntimeException
     */
    public function assertMayDeleteFinancialRecord(string $type, CarbonInterface $createdAt, ?int $id = null): void
    {
        if ($this->isFinancialStillProtected($createdAt)) {
            throw new RuntimeException(sprintf(
                'Financial retention guard: cannot delete %s%s until %s (SRS 22 / 27.7 — %d years).',
                $type,
                $id ? " #{$id}" : '',
                $this->financialRetainUntil($createdAt)->toDateString(),
                $this->financialRetentionYears()
            ));
        }
    }

    public function assertMayDeleteTransaction(Transaction $tx): void
    {
        $this->assertMayDeleteFinancialRecord('transaction', $tx->created_at ?? now(), $tx->id);
    }

    public function assertMayDeleteWalletMutation(WalletMutation $m): void
    {
        $this->assertMayDeleteFinancialRecord('wallet_mutation', $m->created_at ?? now(), $m->id);
    }

    public function assertMayDeleteWalletHistory(WalletHistory $h): void
    {
        $this->assertMayDeleteFinancialRecord('wallet_history', $h->created_at ?? now(), $h->id);
    }

    public function assertMayDeletePaymentHistory(PaymentHistory $p): void
    {
        $this->assertMayDeleteFinancialRecord('payment_history', $p->created_at ?? now(), $p->id);
    }

    /**
     * KYC: retain while account active + 5 years after closed (SRS 27.7).
     * Without account_closed_at, treat user as active → always protected.
     */
    public function assertMayDeleteKyc(KycVerification $kyc, ?User $user = null): void
    {
        $user = $user ?? $kyc->user;
        $closedAt = data_get($user?->getAttributes() ?? [], 'account_closed_at');
        if (! $closedAt) {
            throw new RuntimeException(
                'KYC retention guard: account still active — KYC cannot be deleted (SRS 27.7).'
            );
        }

        $until = Carbon::parse($closedAt)->addYears((int) config('retention.kyc_years_after_account_closed', 5));
        if (now()->lt($until)) {
            throw new RuntimeException(sprintf(
                'KYC retention guard: cannot delete KYC #%d until %s.',
                $kyc->id,
                $until->toDateString()
            ));
        }
    }
}
