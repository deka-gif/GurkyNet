<?php

namespace App\Services\ProductProviders;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Resolves which Product Providers may fulfill an internal product SKU.
 * Delegates ordering to ProductRoutingService (Control Center source of truth).
 */
class ProductProviderSelectionService
{
    public function __construct(
        protected ProductProviderRegistry $registry,
        protected ProductRoutingService $routing,
    ) {}

    /**
     * Ordered candidate offers for an internal product (lowest priority first).
     *
     * @return Collection<int, \App\Models\ProductProviderSku>
     */
    public function candidatesForProduct(Product $product, ?int $transactionId = null): Collection
    {
        return $this->routing->orderedOffersForProduct($product, $transactionId);
    }

    /**
     * Resolve Product by internal SKU (user-facing code).
     */
    public function findProductByInternalSku(string $internalSku): ?Product
    {
        $product = Product::query()->where('sku_code', $internalSku)->first();
        if ($product) {
            return $product;
        }

        return app(DigiflazzDevTestSkuSupport::class)->resolveVirtualProduct($internalSku);
    }

    public function logSelection(
        ?int $transactionId,
        ProductProvider $selected,
        ?ProductProvider $fallback,
        string $reason,
        array $meta = []
    ): void {
        try {
            ProductProviderLog::create([
                'product_provider_id' => $selected->id,
                'transaction_id' => $transactionId,
                'event_type' => 'fulfill_attempt',
                'selected_provider_code' => $selected->code,
                'fallback_provider_code' => $fallback?->code,
                'reason' => $reason,
                'attempt' => (int) ($meta['attempt'] ?? 1),
                'success' => $meta['success'] ?? null,
                'response_time_ms' => $meta['response_time_ms'] ?? null,
                'error_message' => $meta['error_message'] ?? null,
                'meta' => $meta,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to write product_provider_logs', ['error' => $e->getMessage()]);
        }
    }
}
