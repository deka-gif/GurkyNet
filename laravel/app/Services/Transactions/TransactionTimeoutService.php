<?php

namespace App\Services\Transactions;

use App\Enums\TransactionStatus;
use App\Jobs\WatchPendingTransactionJob;
use App\Models\DigiflazzTransaction;
use App\Models\PaymentHistory;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\Transaction;
use App\Services\NotificationService;
use App\Services\ProductProviders\DigiflazzResponseCodeClassifier;
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Services\WalletRefundService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Ensures every pending/processing PPOB transaction becomes SUCCESS or FAILED.
 * Always checks provider status before refunding; refunds are idempotent.
 *
 * Digiflazz Cek Status: do not re-query the same transaction with an interval under 60s.
 * Polling offsets and early polls are clamped to that minimum. HTTP transport retries
 * inside DigiflazzService remain separate from status/topup retries.
 */
class TransactionTimeoutService
{
    public function __construct(
        protected ProductProviderRegistry $registry,
        protected WalletRefundService $refundService,
        protected NotificationService $notificationService,
    ) {}

    public function maxSeconds(): int
    {
        return max(1, (int) config('ppob.timeout.max_seconds', 180));
    }

    /**
     * Minimum seconds between status checks for the same transaction (Digiflazz: ≥ 60).
     */
    public function minCheckIntervalSeconds(): int
    {
        return max(60, (int) config('ppob.timeout.min_check_interval_seconds', 60));
    }

    /**
     * @return list<int>
     */
    public function checkOffsets(): array
    {
        $min = $this->minCheckIntervalSeconds();
        $offsets = config('ppob.timeout.check_at_seconds', [60, 120, 180]);
        if (!is_array($offsets) || $offsets === []) {
            $offsets = [$min, $min * 2, $min * 3];
        }

        $offsets = array_values(array_unique(array_map('intval', $offsets)));
        sort($offsets);

        $normalized = [];
        foreach ($offsets as $offset) {
            if ($offset < 1) {
                continue;
            }
            if ($normalized === []) {
                $normalized[] = max($offset, $min);
                continue;
            }
            $previous = $normalized[array_key_last($normalized)];
            $normalized[] = max($offset, $previous + $min);
        }

        return $normalized !== [] ? $normalized : [$min];
    }

    /**
     * Stamp timeout deadline and schedule the first async status check.
     */
    public function arm(Transaction $transaction): Transaction
    {
        $max = $this->maxSeconds();
        $timeoutAt = ($transaction->created_at ?? now())->copy()->addSeconds($max);

        $transaction->forceFill([
            'timeout_at' => $timeoutAt,
        ])->save();

        $this->scheduleNextCheck($transaction->fresh() ?? $transaction, 0);

        Log::info('TX TIMEOUT — armed', [
            'transaction_id' => $transaction->id,
            'invoice' => $transaction->invoice_number,
            'timeout_at' => optional($timeoutAt)->toIso8601String(),
            'max_seconds' => $max,
            'checks' => $this->checkOffsets(),
        ]);

        return $transaction->fresh() ?? $transaction;
    }

    public function scheduleNextCheck(Transaction $transaction, int $checkIndex): void
    {
        $offsets = $this->checkOffsets();
        if ($checkIndex < 0 || $checkIndex >= count($offsets)) {
            return;
        }

        $anchor = $transaction->created_at ?? now();
        $targetAt = $anchor->copy()->addSeconds($offsets[$checkIndex]);
        $delay = max(0, $targetAt->getTimestamp() - now()->getTimestamp());

        WatchPendingTransactionJob::dispatch($transaction->id, $checkIndex)
            ->delay(now()->addSeconds($delay));

        Log::info('TX TIMEOUT — scheduled check', [
            'transaction_id' => $transaction->id,
            'check_index' => $checkIndex,
            'offset_seconds' => $offsets[$checkIndex],
            'delay_seconds' => $delay,
            'provider_ref' => $transaction->provider_ref,
        ]);
    }

    /**
     * After provider accepts an order (status waiting/processing), schedule the first status poll.
     * Digiflazz Cek Status forbids re-calling the same tx under 60s — delay is clamped to min interval.
     * Uses the first ladder index so settlement still follows the same handler.
     */
    public function scheduleEarlyStatusPoll(Transaction $transaction, ?int $delaySeconds = null): void
    {
        $min = $this->minCheckIntervalSeconds();
        $delaySeconds = max($min, $delaySeconds ?? $min);

        WatchPendingTransactionJob::dispatch($transaction->id, 0)
            ->delay(now()->addSeconds($delaySeconds));

        Log::info('TX TIMEOUT — early CHECK STATUS scheduled', [
            'transaction_id' => $transaction->id,
            'delay_seconds' => $delaySeconds,
            'min_interval_seconds' => $min,
            'provider_ref' => $transaction->provider_ref,
            'fulfillment_provider_code' => $transaction->fulfillment_provider_code,
        ]);
    }

    /**
     * Run one timeout ladder step (status check → settle / reschedule / refund).
     */
    public function handleCheck(int $transactionId, int $checkIndex): void
    {
        $transaction = Transaction::with(['items', 'user', 'digiflazzTransaction'])->find($transactionId);
        if (!$transaction) {
            Log::warning('TX TIMEOUT — transaction missing', ['transaction_id' => $transactionId]);

            return;
        }

        if (!$this->isInFlight($transaction)) {
            Log::info('TX TIMEOUT — already terminal', [
                'transaction_id' => $transactionId,
                'status' => $transaction->status,
            ]);

            return;
        }

        $offsets = $this->checkOffsets();
        $elapsed = max(0, now()->getTimestamp() - ($transaction->created_at?->getTimestamp() ?? now()->getTimestamp()));
        $isFinal = $checkIndex >= count($offsets) - 1 || $elapsed >= $this->maxSeconds();

        Log::info('TX TIMEOUT — status check starting', [
            'transaction_id' => $transaction->id,
            'check_index' => $checkIndex,
            'elapsed_seconds' => $elapsed,
            'is_final' => $isFinal,
            'provider_code' => $transaction->fulfillment_provider_code,
            'provider_last_status' => $transaction->provider_last_status,
        ]);

        $probe = $this->probeProvider($transaction);

        // Skipped Digiflazz probe (min 60s interval) must not advance timeout settlement.
        if ($probe && $probe->reason === 'min_interval_skip') {
            $transaction->forceFill([
                'provider_last_status' => 'pending',
            ])->save();

            $delay = $this->minCheckIntervalSeconds();
            if ($transaction->provider_checked_at) {
                $elapsedSinceCheck = max(0, now()->getTimestamp() - $transaction->provider_checked_at->getTimestamp());
                $delay = max(1, $delay - $elapsedSinceCheck);
            }

            WatchPendingTransactionJob::dispatch($transaction->id, $checkIndex)
                ->delay(now()->addSeconds($delay));

            Log::info('TX TIMEOUT — rescheduled after min-interval skip', [
                'transaction_id' => $transaction->id,
                'check_index' => $checkIndex,
                'delay_seconds' => $delay,
            ]);

            return;
        }

        $transaction->forceFill([
            'provider_checked_at' => now(),
            'provider_last_status' => $probe?->status ?? 'no_provider_order',
        ])->save();

        if ($probe && $probe->ok && $probe->status === 'success') {
            $this->applySuccess($transaction, $probe);

            return;
        }

        if ($probe && !$probe->ok && in_array($probe->status, ['failed', 'error'], true)) {
            $this->applyFailure(
                $transaction,
                'Transaksi gagal. Saldo telah dikembalikan.',
                'provider_status_failed',
                'transaction_failed'
            );

            return;
        }

        if (!$isFinal) {
            $this->scheduleNextCheck($transaction, $checkIndex + 1);

            return;
        }

        // Final attempt: one more probe is already done above. Still unresolved → timeout refund.
        Log::warning('TX TIMEOUT — deadline reached, auto refund', [
            'transaction_id' => $transaction->id,
            'elapsed_seconds' => $elapsed,
            'provider_last_status' => $transaction->provider_last_status,
        ]);

        $this->applyFailure(
            $transaction,
            'Provider tidak memberikan respon dalam batas waktu. Saldo Anda telah dikembalikan.',
            'provider_timeout',
            'transaction_timeout'
        );
    }

    /**
     * Catch-all for queue restarts / missed delayed jobs.
     */
    public function reconcileOverdue(int $limit = 100): int
    {
        $ids = Transaction::query()
            ->whereIn('status', TransactionStatusMapper::reconcileOpenStatuses())
            ->where(function ($q) {
                $q->whereNotNull('timeout_at')->where('timeout_at', '<=', now())
                    ->orWhere(function ($q2) {
                        $q2->whereNull('timeout_at')
                            ->where('created_at', '<=', now()->subSeconds($this->maxSeconds()));
                    });
            })
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id');

        foreach ($ids as $id) {
            WatchPendingTransactionJob::dispatch((int) $id, max(0, count($this->checkOffsets()) - 1));
        }

        return $ids->count();
    }

    protected function isInFlight(Transaction $transaction): bool
    {
        // SRS 14.3 / 14.4 — LOCKED / SENT_TO_SUPPLIER / PENDING_SUPPLIER + legacy pending
        return TransactionStatusMapper::isFulfillOpen($transaction->status)
            || $transaction->status === TransactionStatus::DRAFT->value;
    }

    protected function probeProvider(Transaction $transaction): ?ProviderFulfillmentResult
    {
        $code = $transaction->fulfillment_provider_code;
        if (!$code || !$this->registry->has($code)) {
            Log::info('TX TIMEOUT — no provider to probe yet', [
                'transaction_id' => $transaction->id,
            ]);

            return null;
        }

        $sku = $transaction->provider_sku_used
            ?: $transaction->digiflazzTransaction?->buyer_sku_code
            ?: $transaction->items->first()?->product_code;

        if (!$sku) {
            return null;
        }

        $adapter = $this->registry->get($code);
        // Digiflazz: same ref_id as original order (prepaid re-Topup / pasca status-pasca).
        // Postpaid Digiflazz must probe with inquiry ref_id (provider_ref), not a new invoice.
        $refId = (string) (
            $transaction->provider_ref
            ?: $transaction->digiflazzTransaction?->ref_id
            ?: $transaction->invoice_number
            ?: ''
        );

        // Enforce Digiflazz ≥60s gap between status probes for the same transaction.
        $minInterval = $this->minCheckIntervalSeconds();
        if (
            $code === ProductProvider::CODE_DIGIFLAZZ
            && $transaction->provider_checked_at
            && $transaction->provider_checked_at->gt(now()->subSeconds($minInterval))
        ) {
            Log::info('CHECK STATUS — skipped (min interval)', [
                'transaction_id' => $transaction->id,
                'provider_code' => $code,
                'min_interval_seconds' => $minInterval,
                'provider_checked_at' => optional($transaction->provider_checked_at)->toIso8601String(),
            ]);

            return ProviderFulfillmentResult::pending(
                0,
                [],
                'Status check skipped: Digiflazz minimum interval '.$minInterval.'s',
                'min_interval_skip'
            );
        }

        Log::info('CHECK STATUS — provider request', [
            'transaction_id' => $transaction->id,
            'provider_code' => $code,
            'provider_sku' => $sku,
            'ref_id' => $refId,
            'provider_ref' => $transaction->provider_ref,
        ]);

        $result = $adapter->checkStatus(
            $transaction,
            (string) $sku,
            (string) $transaction->target_number,
            $refId
        );

        $digiflazzRc = $this->digiflazzStatusRcContext($code, $result);

        Log::info('STATUS RESPONSE — provider result', array_merge(
            [
                'transaction_id' => $transaction->id,
                'provider_code' => $code,
                'status' => $result->status,
                'ok' => $result->ok,
                'message' => $result->message,
                'reason' => $result->reason,
                'sn' => $result->sn,
            ],
            $digiflazzRc
        ));

        ProductProviderLog::create([
            'product_provider_id' => ProductProvider::query()->where('code', $code)->value('id'),
            'transaction_id' => $transaction->id,
            'event_type' => 'status_check',
            'selected_provider_code' => $code,
            'reason' => $result->reason ?? $result->status,
            'response_time_ms' => $result->responseTimeMs,
            'success' => $result->ok && $result->status === 'success',
            'error_message' => $result->ok ? null : ($result->message ?? $result->reason),
            'meta' => array_filter([
                'status' => $result->status,
                'raw' => $result->raw,
                'digiflazz_rc' => $digiflazzRc !== [] ? $digiflazzRc : null,
            ], static fn ($v) => $v !== null),
        ]);

        return $result;
    }

    protected function applySuccess(Transaction $transaction, ProviderFulfillmentResult $result): void
    {
        DB::transaction(function () use ($transaction, $result) {
            /** @var Transaction $locked */
            $locked = Transaction::where('id', $transaction->id)->lockForUpdate()->firstOrFail();

            if (!$this->isInFlight($locked)) {
                return;
            }

            if ($this->refundService->hasExistingRefund($locked) || $locked->refunded_at) {
                Log::warning('TX TIMEOUT — skip success; already refunded', [
                    'transaction_id' => $locked->id,
                ]);

                return;
            }

            $locked->update([
                'status' => TransactionStatus::SUCCESS->value,
                'notes' => 'Transaksi berhasil. SN: ' . ($result->sn ?? '-'),
                'provider_last_status' => 'success',
                'provider_checked_at' => now(),
                'completed_at' => now(),
                'provider_response' => is_array($result->raw) ? $result->raw : $locked->provider_response,
            ]);

            if (($locked->fulfillment_provider_code ?? '') === ProductProvider::CODE_DIGIFLAZZ) {
                DigiflazzTransaction::where('transaction_id', $locked->id)->update(
                    \App\Services\DigiflazzService::digiflazzTransactionAttributesFromResponse(
                        'success',
                        is_array($result->raw) ? $result->raw : [],
                        $result->sn
                    )
                );
            }

            PaymentHistory::recordFor(
                $locked,
                $locked->fulfillment_provider_code ?: 'provider',
                'success',
                $result->raw,
                $result->raw,
                $locked->invoice_number
            );

            Log::info('UPDATE TRANSACTION', [
                'transaction_id' => $locked->id,
                'action' => 'SET SUCCESS',
                'provider_ref' => $locked->provider_ref,
                'sn' => $result->sn,
            ]);
            Log::info('SET SUCCESS', [
                'transaction_id' => $locked->id,
                'provider_ref' => $locked->provider_ref,
            ]);
            Log::info('WRITE WALLET HISTORY — debit already finalized (no refund)', [
                'transaction_id' => $locked->id,
            ]);

            // Listeners: SendNotification ("Pembayaran Berhasil"), BroadcastEvent, WriteAuditLog, AnalyticsCollector
            Log::info('BROADCAST EVENT — dispatch TransactionSuccess + PaymentSettled', [
                'transaction_id' => $locked->id,
            ]);

            event(new \App\Events\TransactionSuccess($locked->fresh(['user']) ?? $locked));
            event(new \App\Events\PaymentSettled($locked->fresh(['user']) ?? $locked, $result->raw));
        });

        Log::info('TX TIMEOUT — settled SUCCESS', ['transaction_id' => $transaction->id]);
    }

    protected function applyFailure(
        Transaction $transaction,
        string $userMessage,
        string $reason,
        string $notifyType
    ): void {
        Log::info('SET FAILED', [
            'transaction_id' => $transaction->id,
            'reason' => $reason,
        ]);
        Log::info('REFUND — starting refundOnce', [
            'transaction_id' => $transaction->id,
            'reason' => $reason,
        ]);

        // FR-DIFF-09 / SRS 14.5 — timeout settle-as-fail → auto refund via WalletRefundService.
        $result = $this->refundService->refundOnce(
            $transaction,
            'Refund Timeout/Gagal Transaksi: ' . $transaction->invoice_number,
            'transaction_timeout_engine',
            $userMessage,
            TransactionStatus::FAILED->value
        );

        DigiflazzTransaction::where('transaction_id', $transaction->id)->update([
            'digiflazz_status' => 'failed',
        ]);

        $this->refundService->writeAudit(null, 'TRANSACTION_TIMEOUT_ENGINE', [
            'transaction_id' => $transaction->id,
            'reason' => $reason,
            'credited' => $result['credited'],
            'already_refunded' => $result['already_refunded'],
        ]);

        Log::info('WRITE WALLET HISTORY — refund credit', [
            'transaction_id' => $transaction->id,
            'credited' => $result['credited'],
            'already_refunded' => $result['already_refunded'],
        ]);

        Log::info('BROADCAST EVENT — TransactionFailed', [
            'transaction_id' => $transaction->id,
        ]);
        event(new \App\Events\TransactionFailed($result['transaction']));

        Log::info('UPDATE TRANSACTION', [
            'transaction_id' => $transaction->id,
            'action' => 'SET FAILED',
            'reason' => $reason,
            'notify_type' => $notifyType,
            'credited' => $result['credited'],
            'already_refunded' => $result['already_refunded'],
        ]);
    }

    /**
     * Digiflazz RC log fields (no credentials). Empty when not Digiflazz / no RC.
     *
     * @return array<string, mixed>
     */
    protected function digiflazzStatusRcContext(string $providerCode, ProviderFulfillmentResult $result): array
    {
        if ($providerCode !== ProductProvider::CODE_DIGIFLAZZ) {
            return [];
        }

        $data = $result->raw['data'] ?? null;
        if (! is_array($data) || ! array_key_exists('rc', $data)) {
            return [];
        }

        return DigiflazzResponseCodeClassifier::fromResponseData($data)->toLogContext();
    }
}
