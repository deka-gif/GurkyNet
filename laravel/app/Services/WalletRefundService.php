<?php

namespace App\Services;

use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use App\Models\ActivityLog;
use App\Models\PaymentHistory;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\WalletHistory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Single idempotent wallet refund path for Digiflazz fail, Finance, CS, and timeout engine.
 * Credits the wallet at most once per transaction.
 */
class WalletRefundService
{
    /**
     * @return array{credited: bool, already_refunded: bool, transaction: Transaction}
     */
    public function refundOnce(
        Transaction $transaction,
        string $description,
        string $source,
        ?string $notesSuffix = null,
        ?string $finalStatus = null
    ): array {
        return DB::transaction(function () use ($transaction, $description, $source, $notesSuffix, $finalStatus) {
            /** @var Transaction $locked */
            $locked = Transaction::where('id', $transaction->id)->lockForUpdate()->firstOrFail();

            // Never reverse a successful settlement.
            if (in_array($locked->status, [
                TransactionStatus::SUCCESS->value,
                'sukses',
            ], true)) {
                Log::warning('WalletRefundService — refused refund on SUCCESS', [
                    'transaction_id' => $locked->id,
                    'source' => $source,
                ]);

                return [
                    'credited' => false,
                    'already_refunded' => true,
                    'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']),
                ];
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

            $wallet = Wallet::where('user_id', $locked->user_id)->lockForUpdate()->first();
            $amount = (float) $locked->total_payment;
            $refundRef = 'RFD-' . $locked->invoice_number . '-' . Str::upper(Str::random(6));

            if ($wallet && $amount > 0) {
                $wallet->balance += $amount;
                $wallet->save();

                WalletHistory::create([
                    'wallet_id' => $wallet->id,
                    'amount' => $amount,
                    'type' => WalletHistoryType::CREDIT->value,
                    'description' => $description,
                    'reference_id' => $locked->id,
                ]);

                event(new \App\Events\WalletCredited(
                    $wallet,
                    $amount,
                    $description,
                    $locked->id
                ));
            }

            $status = $finalStatus ?? TransactionStatus::FAILED->value;
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

            Log::info('WalletRefundService — refund executed', [
                'transaction_id' => $locked->id,
                'source' => $source,
                'amount' => $amount,
                'refund_reference' => $refundRef,
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
}
