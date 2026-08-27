<?php

namespace App\Services;

use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use App\Models\ActivityLog;
use App\Models\PaymentHistory;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use App\Services\Wallet\WalletLedgerService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Single idempotent wallet refund path for Digiflazz fail, Finance, CS, timeout, and cancel unhold.
 * Credits the wallet at most once per transaction.
 *
 * FR-DIFF-09 / SRS 14.5 — auto-refund on confirmed supplier/system failure without CS/Finance click.
 * SRS 14.3 — SUCCESS must never become FAILED; only SUCCESS → REFUNDED is allowed
 * (via refundSuccessToRefunded / finalStatus=REFUNDED / allowSuccessRefund).
 */
class WalletRefundService
{
    public function __construct(
        protected WalletLedgerService $ledgerService
    ) {}

    /**
     * Explicit SUCCESS → REFUNDED path (SRS 14.3). Never writes FAILED.
     *
     * @return array{credited: bool, already_refunded: bool, transaction: Transaction}
     */
    public function refundSuccessToRefunded(
        Transaction $transaction,
        string $description,
        string $source,
        ?string $notesSuffix = null
    ): array {
        return $this->refundOnce(
            $transaction,
            $description,
            $source,
            $notesSuffix,
            TransactionStatus::REFUNDED->value,
            true
        );
    }

    /**
     * @return array{credited: bool, already_refunded: bool, transaction: Transaction}
     */
    public function refundOnce(
        Transaction $transaction,
        string $description,
        string $source,
        ?string $notesSuffix = null,
        ?string $finalStatus = null,
        bool $allowSuccessRefund = false
    ): array {
        return DB::transaction(function () use ($transaction, $description, $source, $notesSuffix, $finalStatus, $allowSuccessRefund) {
            /** @var Transaction $locked */
            $locked = Transaction::where('id', $transaction->id)->lockForUpdate()->firstOrFail();

            $isSuccess = TransactionStatusMapper::isSuccess($locked->status);
            $wantsRefunded = $this->isRefundedFinalStatus($finalStatus);

            // SRS 14.3 — never SUCCESS → FAILED (or any non-REFUNDED terminal).
            if ($isSuccess) {
                if (!$allowSuccessRefund && !$wantsRefunded) {
                    Log::warning('WalletRefundService — refused refund on SUCCESS (use refundSuccessToRefunded / finalStatus=REFUNDED)', [
                        'transaction_id' => $locked->id,
                        'source' => $source,
                        'final_status' => $finalStatus,
                    ]);

                    return [
                        'credited' => false,
                        'already_refunded' => true,
                        'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']),
                    ];
                }

                // Force REFUNDED even if caller passed something else while allowing success refund.
                $finalStatus = TransactionStatus::REFUNDED->value;
            }

            if ($locked->refunded_at || $this->hasExistingRefund($locked)) {
                if ($notesSuffix) {
                    $locked->notes = trim(($locked->notes ? $locked->notes . ' | ' : '') . $notesSuffix);
                    $locked->save();
                }

                return [
                    'credited' => false,
                    'already_refunded' => true,
                    'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']),
                ];
            }

            $amount = (float) $locked->total_payment;
            $refundRef = 'RFD-' . $locked->invoice_number . '-' . Str::upper(Str::random(6));

            // Sprint 17 / SRS 30 — partner_api debits partner_wallets, never user wallets.
            if (($locked->channel ?? null) === 'partner_api' && $locked->partner_id) {
                if ($amount > 0) {
                    app(\App\Services\PartnerApi\PartnerWalletService::class)->creditRefund(
                        \App\Models\ApiPartner::findOrFail((int) $locked->partner_id),
                        $amount,
                        'refund:'.$locked->id
                    );
                }
            } else {
                $wallet = Wallet::where('user_id', $locked->user_id)->lockForUpdate()->first();

                if ($wallet && $amount > 0) {
                    $wallet->balance += $amount;
                    $wallet->save();

                    // SRS 14.2 — dual-write via ledger (type=refund)
                    $this->ledgerService->record(
                        $wallet,
                        WalletMutation::TYPE_REFUND,
                        $amount,
                        'credit',
                        $description,
                        $locked->id
                    );

                    event(new \App\Events\WalletCredited(
                        $wallet,
                        $amount,
                        $description,
                        $locked->id
                    ));
                }
            }

            $status = $finalStatus ?? TransactionStatus::FAILED->value;

            // Hard guard: never write FAILED when current status maps to SUCCESS.
            if ($isSuccess && strtoupper((string) $status) !== TransactionStatus::REFUNDED->value) {
                $status = TransactionStatus::REFUNDED->value;
            }

            $locked->status = $status;
            $locked->refunded_at = now();
            $locked->refund_reference = $refundRef;
            if ($notesSuffix) {
                $locked->notes = trim(($locked->notes ? $locked->notes . ' | ' : '') . $notesSuffix);
            }
            $locked->save();

            PaymentHistory::recordFor($locked, 'wallet_refund', 'refund', [
                'source' => $source,
                'description' => $description,
                'amount' => $amount,
                'refund_reference' => $refundRef,
            ]);

            // FR-DIFF-01 — SUCCESS → REFUNDED reverses earned points (hold clawback if already redeemed).
            // Does not become a second refund engine; loyalty only.
            if ($isSuccess && strtoupper((string) $status) === TransactionStatus::REFUNDED->value) {
                try {
                    app(\App\Services\Loyalty\LoyaltyPointService::class)->reverseEarnedPoints($locked);
                } catch (\Throwable $e) {
                    Log::error('WalletRefundService — loyalty reverse failed', [
                        'transaction_id' => $locked->id,
                        'error' => $e->getMessage(),
                    ]);
                }

                // SRS 31.4 — reverse pending referral commission; post-release → Finance review (no clawback).
                try {
                    app(\App\Services\Referral\ReferralCommissionService::class)->handleSourceRefunded($locked);
                } catch (\Throwable $e) {
                    Log::error('WalletRefundService — referral reverse failed', [
                        'transaction_id' => $locked->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            Log::info('WalletRefundService — refund executed', [
                'transaction_id' => $locked->id,
                'source' => $source,
                'amount' => $amount,
                'refund_reference' => $refundRef,
                'final_status' => $status,
            ]);

            return [
                'credited' => true,
                'already_refunded' => false,
                'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']),
            ];
        });
    }

    public function hasExistingRefund(Transaction $transaction): bool
    {
        if ($transaction->refunded_at) {
            return true;
        }

        if (($transaction->channel ?? null) === 'partner_api') {
            $partnerRefund = \App\Models\PartnerWalletMutation::where('reference_id', 'refund:'.$transaction->id)
                ->where('type', \App\Models\PartnerWalletMutation::TYPE_REFUND)
                ->exists();
            if ($partnerRefund) {
                return true;
            }
        }

        $mutationRefund = WalletMutation::where('reference_id', (string) $transaction->id)
            ->where('type', WalletMutation::TYPE_REFUND)
            ->exists();

        if ($mutationRefund) {
            return true;
        }

        $historyRefund = WalletHistory::where('reference_id', $transaction->id)
            ->where('type', WalletHistoryType::CREDIT->value)
            ->where(function ($q) {
                $q->where('description', 'like', 'Refund%')
                    ->orWhere('description', 'like', '%Refund%');
            })
            ->exists();

        if ($historyRefund) {
            return true;
        }

        return PaymentHistory::where('transaction_id', $transaction->id)
            ->where('status', 'refund')
            ->exists();
    }

    public function writeAudit(?int $actorUserId, string $activity, array $payload): void
    {
        ActivityLog::create([
            'user_id' => $actorUserId,
            'activity' => $activity,
            'payload' => $payload,
        ]);
    }

    protected function isRefundedFinalStatus(?string $finalStatus): bool
    {
        if ($finalStatus === null || $finalStatus === '') {
            return false;
        }

        return strtoupper(trim($finalStatus)) === TransactionStatus::REFUNDED->value
            || strtolower(trim($finalStatus)) === TransactionStatus::REFUNDED_LEGACY->value;
    }
}
