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
 *
 * Catalog merge may hide VIP rows while Digi is shown; runtime still discovers
 * sibling products that share the same logical key so failover can reach VIP.
 */
class ProductRoutingService
{
    public function __construct(
        protected ProductProviderRegistry $registry,
        protected ProviderFailoverPolicy $failoverPolicy,
    ) {}

    protected function routingTraceEnabled(): bool
    {
        return (bool) config('app.catalog_trace_enabled', false);
    }

    public function failoverPolicy(): ProviderFailoverPolicy
    {
        return $this->failoverPolicy;
    }

    /**
     * Ordered candidate offers for an internal product (priority ascending).
     * Includes active SKUs from logical sibling products (same category + operator + denomination).
     *
     * @return Collection<int, ProductProviderSku>
     */
    public function orderedOffersForProduct(Product $product, ?int $transactionId = null): Collection
    {
        $productIds = $this->logicalSiblingProductIds($product);

        $offers = ProductProviderSku::query()
            ->with('productProvider')
            ->whereIn('product_id', $productIds)
            ->where('is_active', true)
            ->get();

        if ($this->routingTraceEnabled()) {
            Log::info('PRODUCT ROUTING — candidates loaded', [
                'transaction_id' => $transactionId,
                'product_id' => $product->id,
                'internal_sku' => $product->sku_code,
                'logical_group' => LogicalProductKey::groupKey($product),
                'sibling_product_ids' => $productIds,
                'raw_offer_count' => $offers->count(),
            ]);
        }

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

                if ($this->routingTraceEnabled()) {
                    Log::info('PRODUCT ROUTING — synthetic Digiflazz offer', [
                        'transaction_id' => $transactionId,
                        'product_id' => $product->id,
                        'provider_sku' => $product->sku_code,
                    ]);
                }
            }
        }

        $accepted = collect();
        /** @var array<int, ProductProviderSku> $bestByProvider */
        $bestByProvider = [];

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

            if (method_exists($pp, 'isPartnerMaintenance') && $pp->isPartnerMaintenance()) {
                $this->logSkipped($transactionId, $product, $pp, 'provider_maintenance', $offer);
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

            // Offline / auth / not configured / timeout → skip.
            // Partial / degraded / syncing remain eligible (balance fail alone is Partial).
            if (! ProviderHealthStatus::isTransactionEligible($pp->api_status, $pp->partner_status)) {
                $api = strtolower((string) ($pp->api_status ?? ''));
                $reason = match ($api) {
                    'auth_failed' => 'provider_auth_failed',
                    'not_configured' => 'provider_not_configured',
                    'maintenance' => 'provider_maintenance',
                    'timeout', 'no_response' => 'provider_offline',
                    default => 'provider_offline',
                };
                $this->logSkipped($transactionId, $product, $pp, $reason, $offer);
                continue;
            }

            // Sprint 10 / SRS 15.4 — OPEN (and HALF_OPEN) must not receive fulfillment.
            $circuit = app(ProviderCircuitBreaker::class);
            if (! $circuit->allowsFulfillment((string) $pp->code)) {
                $this->logSkipped(
                    $transactionId,
                    $product,
                    $pp,
                    'circuit_'.strtolower($circuit->state((string) $pp->code)),
                    $offer
                );
                continue;
            }

            $providerId = (int) $pp->id;
            $existing = $bestByProvider[$providerId] ?? null;
            if ($existing === null) {
                $bestByProvider[$providerId] = $offer;
            } else {
                // Prefer preferred flag, then SKU attached to the purchased product, then lower id.
                $preferNew = false;
                if ((bool) $offer->is_preferred && !(bool) $existing->is_preferred) {
                    $preferNew = true;
                } elseif ((int) $offer->product_id === (int) $product->id
                    && (int) $existing->product_id !== (int) $product->id) {
                    $preferNew = true;
                }
                if ($preferNew) {
                    $bestByProvider[$providerId] = $offer;
                }
            }

            if ($this->routingTraceEnabled()) {
                Log::info('PRODUCT ROUTING — provider selected candidate', [
                    'transaction_id' => $transactionId,
                    'product_id' => $product->id,
                    'offer_product_id' => $offer->product_id,
                    'provider_code' => $pp->code,
                    'priority' => (int) $pp->priority,
                    'provider_sku' => $offer->provider_sku,
                    'is_preferred' => (bool) $offer->is_preferred,
                ]);
            }
        }

        $accepted = collect(array_values($bestByProvider));

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

        if ($this->routingTraceEnabled()) {
            Log::info('PRODUCT ROUTING — ordered candidates', [
                'transaction_id' => $transactionId,
                'product_id' => $product->id,
                'order' => $sorted->map(fn (ProductProviderSku $o) => [
                    'provider' => $o->productProvider?->code,
                    'priority' => (int) ($o->productProvider?->priority ?? 0),
                    'provider_sku' => $o->provider_sku,
                    'offer_product_id' => $o->product_id,
                ])->all(),
            ]);
        }

        return $sorted;
    }

    /**
     * Product ids that share the same logical catalog identity (including self).
     *
     * @return list<int>
     */
    public function logicalSiblingProductIdsPublic(Product $product): array
    {
        return $this->logicalSiblingProductIds($product);
    }

    /**
     * Product ids that share the same logical catalog identity (including self).
     *
     * @return list<int>
     */
    protected function logicalSiblingProductIds(Product $product): array
    {
        $product->loadMissing(['category', 'provider']);
        $key = LogicalProductKey::groupKey($product);
        $operatorId = (int) ($product->provider_id ?? 0);
        $family = LogicalProductKey::familyFromProduct($product);
        $slugs = LogicalProductKey::categoryFilterSlugs($family);

        $candidates = Product::query()
            ->with(['category', 'provider'])
            ->where('provider_id', $operatorId)
            ->whereHas('category', fn ($q) => $q->whereIn('slug', $slugs))
            ->get(['id', 'name', 'provider_id', 'product_category_id', 'sku_code']);

        $ids = [];
        foreach ($candidates as $candidate) {
            if (LogicalProductKey::groupKey($candidate) === $key) {
                $ids[] = (int) $candidate->id;
            }
        }

        if (!in_array((int) $product->id, $ids, true)) {
            $ids[] = (int) $product->id;
        }

        return array_values(array_unique($ids));
    }

    /**
     * Whether a product is sellable in the user catalog right now.
     * Uses the same priority + sibling failover set as checkout routing.
     */
    public function productHasActiveOffer(Product $product): bool
    {
        return $this->orderedOffersForProduct($product)->isNotEmpty();
    }

    protected function logSkipped(
        ?int $transactionId,
        Product $product,
        ?ProductProvider $provider,
        string $reason,
        ProductProviderSku $offer
    ): void {
        if ($this->routingTraceEnabled()) {
            Log::info('PRODUCT ROUTING — provider skipped', [
                'transaction_id' => $transactionId,
                'product_id' => $product->id,
                'provider_code' => $provider?->code,
                'reason_skipped' => $reason,
                'provider_sku' => $offer->provider_sku,
            ]);
        }

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
