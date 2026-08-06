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
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Services\WalletRefundService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Ensures every pending/processing PPOB transaction becomes SUCCESS or FAILED.
 * Always checks provider status before refunding; refunds are idempotent.
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
        return max(1, (int) config('ppob.timeout.max_seconds', 60));
    }

    /**
     * @return list<int>
     */
    public function checkOffsets(): array
    {
        $offsets = config('ppob.timeout.check_at_seconds', [15, 30, 45, 60]);
        if (!is_array($offsets) || $offsets === []) {
            $offsets = [15, 30, 45, 60];
        }

        $offsets = array_values(array_unique(array_map('intval', $offsets)));
        sort($offsets);

        return $offsets;
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
            ->whereIn('status', [
                TransactionStatus::PENDING->value,
                TransactionStatus::PROCESSING->value,
            ])
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
        return in_array($transaction->status, [
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ], true);
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
        $refId = (string) ($transaction->invoice_number ?? '');

        Log::info('TX TIMEOUT — provider request (status)', [
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

        Log::info('TX TIMEOUT — provider response (status)', [
            'transaction_id' => $transaction->id,
            'provider_code' => $code,
            'status' => $result->status,
            'ok' => $result->ok,
            'message' => $result->message,
            'reason' => $result->reason,
        ]);

        ProductProviderLog::create([
            'product_provider_id' => ProductProvider::query()->where('code', $code)->value('id'),
            'transaction_id' => $transaction->id,
            'event_type' => 'status_check',
            'selected_provider_code' => $code,
            'reason' => $result->reason ?? $result->status,
            'response_time_ms' => $result->responseTimeMs,
            'success' => $result->ok && $result->status === 'success',
            'error_message' => $result->ok ? null : ($result->message ?? $result->reason),
            'meta' => [
                'status' => $result->status,
                'raw' => $result->raw,
            ],
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
            ]);

            if (($locked->fulfillment_provider_code ?? '') === ProductProvider::CODE_DIGIFLAZZ) {
                DigiflazzTransaction::where('transaction_id', $locked->id)->update([
                    'digiflazz_status' => 'success',
                    'sn' => $result->sn,
                    'raw_response' => $result->raw,
                ]);
            }

            PaymentHistory::recordFor(
                $locked,
                $locked->fulfillment_provider_code ?: 'provider',
                'success',
                $result->raw,
                $result->raw,
                $locked->invoice_number
            );

            event(new \App\Events\TransactionSuccess($locked->fresh()));
            event(new \App\Events\PaymentSettled($locked->fresh(), $result->raw));
        });

        $fresh = $transaction->fresh(['user']);
        if ($fresh?->user) {
            $this->notificationService->send(
                $fresh->user,
                'Transaksi Berhasil',
                'Transaksi berhasil.',
                'transaction_success',
                ['database']
            );
        }

        Log::info('TX TIMEOUT — settled SUCCESS', ['transaction_id' => $transaction->id]);
    }

    protected function applyFailure(
        Transaction $transaction,
        string $userMessage,
        string $reason,
        string $notifyType
    ): void {
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

        event(new \App\Events\TransactionFailed($result['transaction']));

        if ($result['transaction']->user && $result['credited']) {
            $title = $notifyType === 'transaction_timeout' ? 'Transaksi Timeout' : 'Transaksi Gagal';
            $this->notificationService->send(
                $result['transaction']->user,
                $title,
                $userMessage,
                $notifyType,
                ['database']
            );
        }

        Log::info('TX TIMEOUT — settled FAILED', [
            'transaction_id' => $transaction->id,
            'reason' => $reason,
            'credited' => $result['credited'],
            'already_refunded' => $result['already_refunded'],
        ]);
    }
}
