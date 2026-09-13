<?php

namespace App\Jobs;

use App\Enums\TransactionStatus;
use App\Models\VoucherPhysicalBatch;
use App\Models\VoucherPhysicalBatchItem;
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProviderCircuitBreaker;
use App\Services\WalletRefundService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Activates ONE physical voucher serial. Rate-limited (per provider, configurable —
 * see config('ppob.physical_batch.rate_limit_per_minute')) so a 200-serial batch never
 * bursts past the provider's own limit; retried independently of every other item in
 * the batch, so a Retry never re-touches an already-succeeded serial.
 *
 * Reuses the same adapter-level fulfill() call the single-item pipeline uses
 * (ProductProviderFulfillmentService's adapters) but skips that service's whole-Transaction
 * status machine — a batch item is not a Transaction of its own.
 */
class ProcessVoucherPhysicalBatchItem implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Outcomes that must never trigger an automatic refund — the order may still land. */
    protected const AMBIGUOUS_REASONS = ['pending', 'timeout', 'ambiguous', 'provider_exception'];

    /**
     * Pre-fulfill gate failures: Digiflazz was never called, so refund is safe.
     * (Do NOT lump these with post-fulfill ambiguous outcomes.)
     */
    protected const PRE_FULFILL_FAILURE_REASONS = ['provider_unavailable', 'provider_not_configured'];

    public int $itemId;

    public string $providerCode;

    public string $providerSku;

    public int $rateLimitPerMinute;

    public ?string $fallbackProviderCode;

    public ?string $fallbackProviderSku;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [15, 30, 60];

    public int $timeout = 30;

    public function __construct(
        int $itemId,
        string $providerCode,
        string $providerSku,
        int $rateLimitPerMinute,
        ?string $fallbackProviderCode = null,
        ?string $fallbackProviderSku = null
    ) {
        $this->itemId = $itemId;
        $this->providerCode = $providerCode;
        $this->providerSku = $providerSku;
        $this->rateLimitPerMinute = max(1, $rateLimitPerMinute);
        $this->fallbackProviderCode = $fallbackProviderCode;
        $this->fallbackProviderSku = $fallbackProviderSku;
    }

    public function uniqueId(): string
    {
        return (string) $this->itemId;
    }

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [new RateLimited('voucher_physical_activation')];
    }

    public function handle(ProductProviderRegistry $registry, ProviderCircuitBreaker $breaker): void
    {
        $item = VoucherPhysicalBatchItem::with('batch.transaction')->find($this->itemId);
        if (! $item || ! in_array($item->status, [VoucherPhysicalBatchItem::STATUS_QUEUED, VoucherPhysicalBatchItem::STATUS_PROCESSING], true)) {
            // Already terminal (success/failed) — never reprocess, keeps Retry idempotent per item.
            return;
        }

        $item->update([
            'status' => VoucherPhysicalBatchItem::STATUS_PROCESSING,
            'submitted_at' => $item->submitted_at ?? now(),
        ]);

        $transaction = $item->batch->transaction;

        if (! $registry->has($this->providerCode) || ! $breaker->allowsFulfillment($this->providerCode)) {
            // Gate blocked before fulfill() — no provider order exists; fail+refund immediately.
            $this->markItemFailedAndRefund($item->id, 'provider_unavailable');

            return;
        }

        $adapter = $registry->get($this->providerCode);
        if (! $adapter->isConfigured()) {
            $this->markItemFailedAndRefund($item->id, 'provider_not_configured');

            return;
        }

        $refId = $transaction->invoice_number . '-' . $item->id . '-' . $item->retry_count;
        $result = $adapter->fulfill($transaction, $this->providerSku, $item->serial_number, $refId);

        if ($result->ok && $result->status === 'success') {
            $breaker->recordSuccess($this->providerCode);
            $item->update([
                'status' => VoucherPhysicalBatchItem::STATUS_SUCCESS,
                'provider_ref' => $result->sn ?: $refId,
                'activated_at' => now(),
                'failure_reason' => null,
            ]);
            $this->closeBatchIfDone($item->batch_id);

            return;
        }

        if (! $result->ok && $result->status === 'failed') {
            $breaker->recordFailure($this->providerCode, $result->reason ?? 'provider_rejected');

            // Automatic cross-vendor failover — mirrors ProductProviderFulfillmentService's
            // single-hop failover already used for the normal (non-batch) purchase pipeline.
            // Only a CONFIRMED failure with shouldFailover=true tries the fallback; ambiguous
            // outcomes never do (see the pending/error/timeout branch below).
            if ($result->shouldFailover && $this->fallbackProviderCode && $this->fallbackProviderSku
                && $registry->has($this->fallbackProviderCode)
                && $registry->get($this->fallbackProviderCode)->isConfigured()
                && $breaker->allowsFulfillment($this->fallbackProviderCode)
            ) {
                Log::info('ProcessVoucherPhysicalBatchItem: primary provider failed, attempting fallback', [
                    'item_id' => $this->itemId,
                    'primary_provider' => $this->providerCode,
                    'fallback_provider' => $this->fallbackProviderCode,
                    'primary_reason' => $result->reason,
                ]);

                $this->attemptFallback($item, $transaction, $registry, $breaker);

                return;
            }

            $this->markItemFailedAndRefund($item->id, $result->reason ?? 'provider_rejected');

            return;
        }

        // pending / error / timeout — ambiguous, never guess-refund and never failover (the order
        // may still land at the primary provider). Record last-known reason and let job retries
        // (backoff) resolve it.
        $item->update(['failure_reason' => $result->reason ?? $result->status]);
        $breaker->recordFailure($this->providerCode, $result->reason ?? 'ambiguous');
        throw new \RuntimeException('Ambiguous provider result for item ' . $this->itemId . ': ' . ($result->reason ?? $result->status));
    }

    /**
     * One-hop fallback attempt against the pre-resolved secondary provider (chosen once for the
     * whole batch in ProcessVoucherPhysicalBatch, same viability rules as the primary). Reuses the
     * exact same success / confirmed-failed / ambiguous handling as the primary attempt — the only
     * difference is which provider_code/provider_sku ends up persisted on success or refund.
     */
    protected function attemptFallback(
        VoucherPhysicalBatchItem $item,
        \App\Models\Transaction $transaction,
        ProductProviderRegistry $registry,
        ProviderCircuitBreaker $breaker
    ): void {
        $adapter = $registry->get($this->fallbackProviderCode);
        $refId = $transaction->invoice_number . '-' . $item->id . '-' . $item->retry_count . '-fo';
        $result = $adapter->fulfill($transaction, $this->fallbackProviderSku, $item->serial_number, $refId);

        if ($result->ok && $result->status === 'success') {
            $breaker->recordSuccess($this->fallbackProviderCode);
            $item->update([
                'status' => VoucherPhysicalBatchItem::STATUS_SUCCESS,
                'provider_code' => $this->fallbackProviderCode,
                'provider_sku' => $this->fallbackProviderSku,
                'provider_ref' => $result->sn ?: $refId,
                'activated_at' => now(),
                'failure_reason' => null,
            ]);
            $this->closeBatchIfDone($item->batch_id);

            return;
        }

        if (! $result->ok && $result->status === 'failed') {
            $breaker->recordFailure($this->fallbackProviderCode, $result->reason ?? 'provider_rejected');
            $this->markItemFailedAndRefund($item->id, $result->reason ?? 'provider_rejected');

            return;
        }

        // Fallback outcome ambiguous too — same no-guess-refund rule; record reason and let job
        // retries resolve it (a retry re-tries the primary first, then fails over again if needed).
        $item->update(['failure_reason' => $result->reason ?? $result->status]);
        $breaker->recordFailure($this->fallbackProviderCode, $result->reason ?? 'ambiguous');
        throw new \RuntimeException('Ambiguous fallback provider result for item ' . $this->itemId . ': ' . ($result->reason ?? $result->status));
    }

    /**
     * Retries exhausted. If the last known outcome was ambiguous (pending/timeout/provider
     * unavailable), leave the item PROCESSING for manual reconciliation rather than guessing
     * a refund on an order that may have actually landed at the provider. Only a confirmed
     * failure reason gets refunded here.
     */
    public function failed(?\Throwable $exception): void
    {
        $item = VoucherPhysicalBatchItem::find($this->itemId);
        if (! $item || in_array($item->status, [VoucherPhysicalBatchItem::STATUS_SUCCESS, VoucherPhysicalBatchItem::STATUS_FAILED], true)) {
            return;
        }

        // Retries exhausted. Ambiguous / unknown outcomes stay PROCESSING for manual review.
        // Pre-fulfill gate failures (never called Digi) must refund — see PRE_FULFILL_FAILURE_REASONS.
        if (in_array($item->failure_reason, self::PRE_FULFILL_FAILURE_REASONS, true)) {
            $this->markItemFailedAndRefund($this->itemId, $item->failure_reason);

            return;
        }

        if (in_array($item->failure_reason, self::AMBIGUOUS_REASONS, true)) {
            Log::warning('ProcessVoucherPhysicalBatchItem: exhausted retries on ambiguous outcome, leaving PROCESSING for reconciliation', [
                'item_id' => $this->itemId,
                'reason' => $item->failure_reason,
            ]);

            return;
        }

        // Worker kill / unset reason — never guess-refund as job_exhausted.
        $reason = is_string($item->failure_reason) ? trim($item->failure_reason) : '';
        if ($reason === '' || $reason === 'job_exhausted') {
            $batch = $item->batch()->with('transaction')->first();
            $tx = $batch?->transaction;
            app(\App\Services\Transactions\PpobManualReviewEscalationService::class)->escalateBatchItem(
                (int) $item->id,
                (int) ($tx?->id ?? 0),
                (string) ($tx?->invoice_number ?? ''),
                (string) $item->serial_number,
                $reason === '' ? 'batch_item_failure_reason_empty' : 'batch_item_job_exhausted'
            );
            Log::warning('ProcessVoucherPhysicalBatchItem: exhausted without confirmed failure reason, leaving PROCESSING', [
                'item_id' => $this->itemId,
                'reason' => $reason === '' ? null : $reason,
            ]);

            return;
        }

        $this->markItemFailedAndRefund($this->itemId, $reason);
    }

    protected function markItemFailedAndRefund(int $itemId, string $reason): void
    {
        DB::transaction(function () use ($itemId, $reason) {
            $locked = VoucherPhysicalBatchItem::where('id', $itemId)->lockForUpdate()->first();
            if (! $locked || in_array($locked->status, [VoucherPhysicalBatchItem::STATUS_SUCCESS, VoucherPhysicalBatchItem::STATUS_FAILED], true)) {
                return;
            }

            $batch = $locked->batch()->with('transaction')->first();
            $unitPrice = (float) $batch->unit_price;

            $refund = app(WalletRefundService::class)->refundPartialAmount(
                $batch->transaction,
                $unitPrice,
                'Refund voucher fisik gagal aktivasi: ' . $locked->serial_number,
                'voucher_physical_batch_item'
            );

            $locked->update([
                'status' => VoucherPhysicalBatchItem::STATUS_FAILED,
                'failure_reason' => $reason,
                'refund_amount' => $refund['credited'] ? $unitPrice : null,
                'refunded_at' => $refund['credited'] ? now() : null,
            ]);
        });

        $item = VoucherPhysicalBatchItem::find($itemId);
        if ($item) {
            $this->closeBatchIfDone($item->batch_id);
        }
    }

    protected function closeBatchIfDone(int $batchId): void
    {
        DB::transaction(function () use ($batchId) {
            $locked = VoucherPhysicalBatch::where('id', $batchId)->lockForUpdate()->first();
            if (! $locked || in_array($locked->status, [
                VoucherPhysicalBatch::STATUS_COMPLETED,
                VoucherPhysicalBatch::STATUS_COMPLETED_WITH_FAILURES,
            ], true)) {
                return;
            }

            $successCount = VoucherPhysicalBatchItem::where('batch_id', $locked->id)->where('status', VoucherPhysicalBatchItem::STATUS_SUCCESS)->count();
            $failedCount = VoucherPhysicalBatchItem::where('batch_id', $locked->id)->where('status', VoucherPhysicalBatchItem::STATUS_FAILED)->count();
            $refundedCount = VoucherPhysicalBatchItem::where('batch_id', $locked->id)->whereNotNull('refunded_at')->count();
            $terminal = $successCount + $failedCount;

            if ($terminal < $locked->total_serials) {
                $locked->update([
                    'success_count' => $successCount,
                    'failed_count' => $failedCount,
                    'refunded_count' => $refundedCount,
                ]);

                return;
            }

            $locked->update([
                'success_count' => $successCount,
                'failed_count' => $failedCount,
                'refunded_count' => $refundedCount,
                'status' => $failedCount === 0
                    ? VoucherPhysicalBatch::STATUS_COMPLETED
                    : VoucherPhysicalBatch::STATUS_COMPLETED_WITH_FAILURES,
            ]);

            $transaction = $locked->transaction;
            if ($transaction) {
                $transaction->update([
                    'status' => $successCount > 0 ? TransactionStatus::SUCCESS->value : TransactionStatus::FAILED->value,
                    'completed_at' => now(),
                    'notes' => "Batch voucher fisik selesai: {$successCount} sukses, {$failedCount} gagal.",
                ]);
            }
        });
    }
}
