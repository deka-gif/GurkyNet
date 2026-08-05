<?php

namespace App\Services\ProductProviders;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\ProductProviderSku;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Resolves which Product Providers may fulfill an internal product SKU.
 * Disabled providers are silently ignored (never surface to end users).
 */
class ProductProviderSelectionService
{
    public function __construct(protected ProductProviderRegistry $registry) {}

    /**
     * Ordered candidate offers for an internal product (lowest priority first).
     * Preferred offer is placed first when its provider is enabled.
     *
     * @return Collection<int, ProductProviderSku>
     */
    public function candidatesForProduct(Product $product): Collection
    {
        $offers = ProductProviderSku::query()
            ->with('productProvider')
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->whereHas('productProvider', fn ($q) => $q->where('is_active', true))
            ->get();

        // Fallback: Digiflazz mapping from master product.sku_code when no offer rows yet
        if ($offers->isEmpty()) {
            $digi = ProductProvider::digiflazz();
            if ($digi && $digi->is_active) {
                $synthetic = new ProductProviderSku([
                    'product_id' => $product->id,
                    'product_provider_id' => $digi->id,
                    'provider_sku' => $product->sku_code,
                    'base_price' => $product->base_price,
                    'is_preferred' => true,
                    'is_active' => true,
                ]);
                $synthetic->setRelation('productProvider', $digi);
                $offers = collect([$synthetic]);
            }
        }

        $offers = $offers->filter(function (ProductProviderSku $offer) {
            $pp = $offer->productProvider;
            if (!$pp || !$pp->is_active) {
                return false;
            }
            if (!$this->registry->has($pp->code)) {
                return false;
            }
            // Skip providers that look offline in control center (still allow unknown)
            if (($pp->api_status ?? null) === 'offline') {
                return false;
            }

            return true;
        })->values();

        $preferred = $offers->firstWhere('is_preferred', true);
        $rest = $offers
            ->sortBy(fn (ProductProviderSku $o) => (int) ($o->productProvider->priority ?? 100))
            ->values();

        if ($preferred && $preferred->productProvider?->is_active) {
            $rest = $rest->reject(fn (ProductProviderSku $o) => $o->id && $preferred->id && $o->id === $preferred->id)->values();
            return collect([$preferred])->concat($rest)->values();
        }

        return $rest;
    }

    /**
     * Resolve Product by internal SKU (user-facing code).
     */
    public function findProductByInternalSku(string $internalSku): ?Product
    {
        return Product::query()->where('sku_code', $internalSku)->first();
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
