<?php

namespace App\Jobs;

use App\Enums\TransactionStatus;
use App\Models\VoucherPhysicalBatch;
use App\Models\VoucherPhysicalBatchItem;
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProductProviderSelectionService;
use App\Services\ProductProviders\ProviderCircuitBreaker;
use App\Services\WalletRefundService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Fan-out only: resolves ONE provider offer for the whole batch's SKU (deterministic —
 * a bulk batch does not failover mid-flight across 200 serials) and dispatches one
 * ProcessVoucherPhysicalBatchItem per queued serial. All retry/backoff/refund-on-failure
 * logic for an individual serial lives on the item job.
 */
class ProcessVoucherPhysicalBatch implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $batchId;

    public int $tries = 1;

    public int $timeout = 60;

    public function __construct(int $batchId)
    {
        $this->batchId = $batchId;
    }

    public function uniqueId(): string
    {
        return (string) $this->batchId;
    }

    public function handle(
        ProductProviderSelectionService $selection,
        ProductProviderRegistry $registry,
        ProviderCircuitBreaker $breaker,
        WalletRefundService $refundService
    ): void {
        $batch = VoucherPhysicalBatch::with(['product', 'transaction', 'items'])->find($this->batchId);
        if (! $batch) {
            Log::error('ProcessVoucherPhysicalBatch: batch not found', ['id' => $this->batchId]);

            return;
        }

        if ($batch->status !== VoucherPhysicalBatch::STATUS_PENDING) {
            return;
        }

        $candidates = $selection->candidatesForProduct($batch->product, $batch->transaction_id);

        $isViable = function ($o) use ($registry, $breaker) {
            $provider = $o->productProvider;

            return $provider
                && $provider->is_active
                && $registry->has($provider->code)
                && $registry->get($provider->code)->isConfigured()
                && $breaker->allowsFulfillment($provider->code);
        };

        $viableCandidates = $candidates->filter($isViable)->values();
        $offer = $viableCandidates->first();

        if (! $offer) {
            $this->failWholeBatch($batch, $refundService, 'no_active_provider');

            return;
        }

        // Second distinct-provider viable candidate, resolved ONCE for the whole batch — every
        // item job gets it up front so it can fail over to it without a fresh lookup per item.
        $fallbackOffer = $viableCandidates->first(
            fn ($o) => $o->productProvider->code !== $offer->productProvider->code
        );

        $providerCode = $offer->productProvider->code;
        $providerSku = $offer->provider_sku;
        $fallbackProviderCode = $fallbackOffer?->productProvider->code;
        $fallbackProviderSku = $fallbackOffer?->provider_sku;
        $rateLimit = (int) config('ppob.physical_batch.rate_limit_per_minute.' . $providerCode, 60);

        $batch->update(['status' => VoucherPhysicalBatch::STATUS_PROCESSING]);

        foreach ($batch->items as $item) {
            if ($item->status !== VoucherPhysicalBatchItem::STATUS_QUEUED) {
                continue;
            }
            $item->update(['provider_code' => $providerCode, 'provider_sku' => $providerSku]);
            ProcessVoucherPhysicalBatchItem::dispatch(
                $item->id,
                $providerCode,
                $providerSku,
                $rateLimit,
                $fallbackProviderCode,
                $fallbackProviderSku
            );
        }
    }

    protected function failWholeBatch(VoucherPhysicalBatch $batch, WalletRefundService $refundService, string $reason): void
    {
        VoucherPhysicalBatchItem::where('batch_id', $batch->id)->update([
            'status' => VoucherPhysicalBatchItem::STATUS_FAILED,
            'failure_reason' => $reason,
        ]);

        $result = $refundService->refundOnce(
            $batch->transaction,
            'Refund Batch Voucher Fisik: ' . $batch->transaction->invoice_number,
            'voucher_physical_batch_dispatch',
            'Tidak ada provider aktif untuk memproses batch ini. Saldo dikembalikan.',
            TransactionStatus::FAILED->value
        );

        if ($result['credited']) {
            VoucherPhysicalBatchItem::where('batch_id', $batch->id)->update(['refunded_at' => now()]);
        }

        $batch->update([
            'status' => VoucherPhysicalBatch::STATUS_COMPLETED_WITH_FAILURES,
            'failed_count' => $batch->total_serials,
            'refunded_count' => $result['credited'] ? $batch->total_serials : $batch->refunded_count,
        ]);

        Log::warning('ProcessVoucherPhysicalBatch: no active provider, batch refunded in full', [
            'batch_id' => $batch->id,
        ]);
    }
}
