<?php

namespace App\Services\Transactions;

use App\Enums\TransactionStatus;
use App\Models\Transaction;
use App\Services\WalletRefundService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * P1-F — locked writer for PENDING_SUPPLIER (webhook / legacy job ambiguous status).
 *
 * Complements TransactionSuccessTransitionService: SUCCESS stays centralized there;
 * pending must not TOCTOU-overwrite SUCCESS/refunded via unlocked updates.
 */
class TransactionPendingTransitionService
{
    public const OUTCOME_APPLIED = 'applied';

    public const OUTCOME_ALREADY_PENDING = 'already_pending';

    public const OUTCOME_REJECTED_TERMINAL = 'rejected_terminal';

    public function __construct(
        protected WalletRefundService $refundService
    ) {}

    /**
     * @param  array{source?: string, notes?: string|null, provider_last_status?: string|null}  $context
     * @return array{outcome: string, transaction: Transaction}
     */
    public function apply(int $transactionId, array $context = []): array
    {
        $source = (string) ($context['source'] ?? 'unknown');
        $notes = isset($context['notes']) && is_string($context['notes']) && $context['notes'] !== ''
            ? $context['notes']
            : 'Sedang diproses oleh operator.';
        $providerLastStatus = isset($context['provider_last_status']) && is_string($context['provider_last_status'])
            ? $context['provider_last_status']
            : 'pending';

        return DB::transaction(function () use ($transactionId, $source, $notes, $providerLastStatus) {
            /** @var Transaction $locked */
            $locked = Transaction::query()->where('id', $transactionId)->lockForUpdate()->firstOrFail();

            if ($locked->status === TransactionStatus::PENDING_SUPPLIER->value) {
                return [
                    'outcome' => self::OUTCOME_ALREADY_PENDING,
                    'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']) ?? $locked,
                ];
            }

            $inFlight = TransactionStatusMapper::isFulfillOpen($locked->status)
                || $locked->status === TransactionStatus::DRAFT->value;

            if (! $inFlight
                || $locked->refunded_at
                || $this->refundService->hasExistingRefund($locked)
                || TransactionStatusMapper::isSuccess($locked->status)
            ) {
                Log::info('TX PENDING TRANSITION — rejected; terminal or not in-flight', [
                    'transaction_id' => $locked->id,
                    'source' => $source,
                    'current_status' => $locked->status,
                    'refunded_at' => $locked->refunded_at?->toIso8601String(),
                ]);

                return [
                    'outcome' => self::OUTCOME_REJECTED_TERMINAL,
                    'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']) ?? $locked,
                ];
            }

            $locked->update([
                'status' => TransactionStatus::PENDING_SUPPLIER->value,
                'notes' => $notes,
                'provider_last_status' => $providerLastStatus,
                'provider_checked_at' => now(),
            ]);

            Log::info('TX PENDING TRANSITION — applied', [
                'transaction_id' => $locked->id,
                'source' => $source,
            ]);

            return [
                'outcome' => self::OUTCOME_APPLIED,
                'transaction' => $locked->fresh(['user', 'paymentHistory', 'items']) ?? $locked,
            ];
        });
    }
}
