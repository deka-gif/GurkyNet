<?php

namespace App\Services\PartnerApi;

use App\Models\ApiPartner;
use App\Models\PartnerDepositRequest;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletMutation;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-API partner wallet — separate from user/agent wallets (SRS 30.3 / 30.5).
 * Finance manual deposit approval; row-level lock; no double-credit.
 */
class PartnerWalletService
{
    public function creditDeposit(PartnerDepositRequest $request, int $reviewedBy): PartnerDepositRequest
    {
        return DB::transaction(function () use ($request, $reviewedBy) {
            /** @var PartnerDepositRequest $locked */
            $locked = PartnerDepositRequest::where('id', $request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === PartnerDepositRequest::STATUS_APPROVED) {
                return $locked;
            }
            if ($locked->status !== PartnerDepositRequest::STATUS_PENDING) {
                throw ValidationException::withMessages([
                    'status' => ['Deposit request tidak dapat disetujui.'],
                ]);
            }

            $wallet = PartnerWallet::where('partner_id', $locked->partner_id)->lockForUpdate()->first();
            if (! $wallet) {
                $wallet = PartnerWallet::create([
                    'partner_id' => $locked->partner_id,
                    'balance' => 0,
                    'status' => 'active',
                ]);
                $wallet = PartnerWallet::where('id', $wallet->id)->lockForUpdate()->firstOrFail();
            }

            $ref = 'partner_deposit:'.$locked->id;
            $already = PartnerWalletMutation::where('partner_wallet_id', $wallet->id)
                ->where('reference_id', $ref)
                ->where('type', PartnerWalletMutation::TYPE_DEPOSIT)
                ->exists();

            if (! $already) {
                $amount = (float) $locked->amount;
                $wallet->balance = (float) $wallet->balance + $amount;
                $wallet->save();

                PartnerWalletMutation::create([
                    'partner_wallet_id' => $wallet->id,
                    'type' => PartnerWalletMutation::TYPE_DEPOSIT,
                    'amount' => $amount,
                    'reference_id' => $ref,
                    'approved_by' => $reviewedBy,
                ]);
            }

            $locked->status = PartnerDepositRequest::STATUS_APPROVED;
            $locked->reviewed_by = $reviewedBy;
            $locked->reviewed_at = now();
            $locked->save();

            return $locked->fresh();
        });
    }

    public function rejectDeposit(PartnerDepositRequest $request, int $reviewedBy, ?string $note = null): PartnerDepositRequest
    {
        return DB::transaction(function () use ($request, $reviewedBy, $note) {
            /** @var PartnerDepositRequest $locked */
            $locked = PartnerDepositRequest::where('id', $request->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== PartnerDepositRequest::STATUS_PENDING) {
                return $locked;
            }
            $locked->status = PartnerDepositRequest::STATUS_REJECTED;
            $locked->reviewed_by = $reviewedBy;
            $locked->reviewed_at = now();
            if ($note) {
                $locked->note = $note;
            }
            $locked->save();

            return $locked->fresh();
        });
    }

    /**
     * Debit partner wallet under lock (caller must be inside DB transaction that locked wallet).
     */
    public function debitLocked(PartnerWallet $wallet, float $amount, string $referenceId, string $type = PartnerWalletMutation::TYPE_PURCHASE): void
    {
        if ((float) $wallet->balance < $amount) {
            throw ValidationException::withMessages([
                'balance' => ['Saldo partner tidak mencukupi.'],
            ]);
        }
        $wallet->balance = (float) $wallet->balance - $amount;
        $wallet->save();

        PartnerWalletMutation::create([
            'partner_wallet_id' => $wallet->id,
            'type' => $type,
            'amount' => $amount,
            'reference_id' => $referenceId,
        ]);
    }

    public function creditRefund(ApiPartner $partner, float $amount, string $referenceId): void
    {
        DB::transaction(function () use ($partner, $amount, $referenceId) {
            $wallet = PartnerWallet::where('partner_id', $partner->id)->lockForUpdate()->first();
            if (! $wallet || $amount <= 0) {
                return;
            }

            $exists = PartnerWalletMutation::where('partner_wallet_id', $wallet->id)
                ->where('reference_id', $referenceId)
                ->where('type', PartnerWalletMutation::TYPE_REFUND)
                ->exists();
            if ($exists) {
                return;
            }

            $wallet->balance = (float) $wallet->balance + $amount;
            $wallet->save();

            PartnerWalletMutation::create([
                'partner_wallet_id' => $wallet->id,
                'type' => PartnerWalletMutation::TYPE_REFUND,
                'amount' => $amount,
                'reference_id' => $referenceId,
            ]);
        });
    }
}
