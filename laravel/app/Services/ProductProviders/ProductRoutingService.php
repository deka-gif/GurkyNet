<?php

namespace App\Services\ProductProviders;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\ProductProviderSku;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Checkout router — Control Center is the single source of truth.
 * Transaction services must not hardcode provider order.
 */
class ProductRoutingService
{
    public function __construct(
        protected ProductProviderRegistry $registry,
        protected ProviderFailoverPolicy $failoverPolicy,
    ) {}

    public function failoverPolicy(): ProviderFailoverPolicy
    {
        return $this->failoverPolicy;
    }

    /**
     * Ordered candidate offers for an internal product (priority ascending).
     * Ignores disabled providers and offers without SKU mapping.
     *
     * @return Collection<int, ProductProviderSku>
     */
    public function orderedOffersForProduct(Product $product, ?int $transactionId = null): Collection
    {
        $offers = ProductProviderSku::query()
            ->with('productProvider')
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->get();

        Log::info('PRODUCT ROUTING — candidates loaded', [
            'transaction_id' => $transactionId,
            'product_id' => $product->id,
            'internal_sku' => $product->sku_code,
            'raw_offer_count' => $offers->count(),
        ]);

        // Backward-compatible Digiflazz synthetic offer when no mapping rows yet
        if ($offers->isEmpty()) {
            $digi = ProductProvider::digiflazz();
            if ($digi && $digi->is_active && $this->registry->has($digi->code)) {
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

                Log::info('PRODUCT ROUTING — synthetic Digiflazz offer', [
                    'transaction_id' => $transactionId,
                    'product_id' => $product->id,
                    'provider_sku' => $product->sku_code,
                ]);
            }
        }

        $accepted = collect();

        foreach ($offers as $offer) {
            /** @var ProductProviderSku $offer */
            $pp = $offer->productProvider;

            if (!$pp) {
                $this->logSkipped($transactionId, $product, null, 'missing_product_provider_relation', $offer);
                continue;
            }

            if (!$pp->is_active) {
                $this->logSkipped($transactionId, $product, $pp, 'provider_disabled', $offer);
                continue;
            }

            if (!$offer->is_active) {
                $this->logSkipped($transactionId, $product, $pp, 'sku_mapping_inactive', $offer);
                continue;
            }

            if (trim((string) $offer->provider_sku) === '') {
                $this->logSkipped($transactionId, $product, $pp, 'missing_provider_sku', $offer);
                continue;
            }

            if (!$this->registry->has($pp->code)) {
                $this->logSkipped($transactionId, $product, $pp, 'adapter_not_registered', $offer);
                continue;
            }

            if (($pp->api_status ?? null) === 'offline') {
                $this->logSkipped($transactionId, $product, $pp, 'provider_offline', $offer);
                continue;
            }

            if (($pp->api_status ?? null) === 'not_configured') {
                $this->logSkipped($transactionId, $product, $pp, 'provider_not_configured', $offer);
                continue;
            }

            $accepted->push($offer);
            Log::info('PRODUCT ROUTING — provider selected candidate', [
                'transaction_id' => $transactionId,
                'product_id' => $product->id,
                'provider_code' => $pp->code,
                'priority' => (int) $pp->priority,
                'provider_sku' => $offer->provider_sku,
                'is_preferred' => (bool) $offer->is_preferred,
            ]);
        }

        $preferred = $accepted->firstWhere('is_preferred', true);
        $sorted = $accepted
            ->sortBy(fn (ProductProviderSku $o) => (int) ($o->productProvider->priority ?? 100))
            ->values();

        if ($preferred && $preferred->productProvider?->is_active) {
            $sorted = $sorted
                ->reject(fn (ProductProviderSku $o) => $o->id && $preferred->id && (int) $o->id === (int) $preferred->id)
                ->values();
            $sorted = collect([$preferred])->concat($sorted)->values();
        }

        Log::info('PRODUCT ROUTING — ordered candidates', [
            'transaction_id' => $transactionId,
            'product_id' => $product->id,
            'order' => $sorted->map(fn (ProductProviderSku $o) => [
                'provider' => $o->productProvider?->code,
                'priority' => (int) ($o->productProvider?->priority ?? 0),
                'provider_sku' => $o->provider_sku,
            ])->all(),
        ]);

        return $sorted;
    }

    /**
     * Whether a product is sellable in the user catalog right now.
     */
    public function productHasActiveOffer(Product $product): bool
    {
        return ProductProviderSku::query()
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->whereHas('productProvider', fn ($q) => $q->where('is_active', true))
            ->exists()
            || (
                ProductProviderSku::query()->where('product_id', $product->id)->doesntExist()
                && (bool) ProductProvider::digiflazz()?->is_active
                && (int) $product->product_provider_id === (int) ProductProvider::digiflazz()?->id
            );
    }

    protected function logSkipped(
        ?int $transactionId,
        Product $product,
        ?ProductProvider $provider,
        string $reason,
        ProductProviderSku $offer
    ): void {
        Log::info('PRODUCT ROUTING — provider skipped', [
            'transaction_id' => $transactionId,
            'product_id' => $product->id,
            'provider_code' => $provider?->code,
            'reason_skipped' => $reason,
            'provider_sku' => $offer->provider_sku,
        ]);

        if ($transactionId && $provider) {
            try {
                ProductProviderLog::create([
                    'product_provider_id' => $provider->id,
                    'transaction_id' => $transactionId,
                    'event_type' => 'provider_skipped',
                    'selected_provider_code' => $provider->code,
                    'reason' => $reason,
                    'success' => false,
                    'meta' => [
                        'provider_sku' => $offer->provider_sku,
                        'internal_sku' => $product->sku_code,
                    ],
                ]);
            } catch (\Throwable $e) {
                Log::warning('Failed to write provider_skipped log', ['error' => $e->getMessage()]);
            }
        }
    }
}
