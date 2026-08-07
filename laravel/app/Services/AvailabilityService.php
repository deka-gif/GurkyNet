<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductProviderSku;
use App\Services\ProductProviders\ProductRoutingService;

class AvailabilityService
{
    /**
     * Determine availability status of a product.
     * Returns: 'active', 'inactive', or 'maintenance'
     *
     * Product-centric (not provider-centric):
     * - Sellable when ANY mapped provider (including logical siblings) can fulfill via priority routing.
     * - Digiflazz Offline/Maintenance does NOT kill the product if VIP (or another partner) can sell it.
     * - All routable offers gone → maintenance (temporary) or inactive (ops / no mapping).
     */
    public function getStatus(Product $product): string
    {
        $ops = strtolower(trim((string) ($product->ops_status ?? 'active')));
        if ($ops === 'maintenance' || str_contains(strtoupper((string) $product->sku_code), 'MAINTENANCE')) {
            return 'maintenance';
        }

        if ($ops === 'inactive') {
            return 'inactive';
        }

        $product->loadMissing('providerSkus.productProvider', 'productProvider', 'category', 'provider');

        // Legacy masters without Control Center SKU rows: boolean status still applies.
        // (Digi status=false masters that already have VIP/Digi SKU mappings stay product-centric.)
        if ($product->providerSkus->isEmpty()
            && ! $product->status
            && ($product->ops_status === null || $product->ops_status === '')
        ) {
            return 'inactive';
        }

        if ($this->isSellableViaControlCenter($product)) {
            return 'active';
        }

        if ($this->hasMappedOffersAwaitingProvider($product)) {
            return 'maintenance';
        }

        // Legacy masters without SKU rows — respect primary partner mode only.
        if ($product->providerSkus->isEmpty() && $product->status) {
            $pp = $product->productProvider;
            if ($pp && method_exists($pp, 'isPartnerMaintenance') && $pp->isPartnerMaintenance()) {
                return 'maintenance';
            }
            if ($pp && method_exists($pp, 'isPartnerSellable') && $pp->isPartnerSellable()) {
                return 'active';
            }
            if ($pp && (! $pp->is_active || (method_exists($pp, 'isPartnerOffline') && $pp->isPartnerOffline()))) {
                return 'maintenance';
            }

            return 'active';
        }

        return 'inactive';
    }

    /**
     * Check if product is currently available for purchase.
     */
    public function isAvailable(Product $product): bool
    {
        return $this->getStatus($product) === 'active';
    }

    /**
     * Visible on user dashboard catalog (Active + Maintenance). Inactive is hidden.
     */
    public function isCatalogVisible(Product $product): bool
    {
        $status = $this->getStatus($product);

        return $status === 'active' || $status === 'maintenance';
    }

    /**
     * Sellable when Product Routing finds at least one Online / non-maintenance offer
     * across this product and its logical siblings (priority + auto-failover set).
     */
    public function isSellableViaControlCenter(Product $product): bool
    {
        return app(ProductRoutingService::class)
            ->orderedOffersForProduct($product)
            ->isNotEmpty();
    }

    /**
     * Product (or logical siblings) still have SKU↔provider mappings, but none are
     * currently routable (all partners offline / maintenance / powered off).
     * Catalog may still show the card as Maintenance when the listing gate allows.
     */
    protected function hasMappedOffersAwaitingProvider(Product $product): bool
    {
        $routing = app(ProductRoutingService::class);
        $siblingIds = $routing->logicalSiblingProductIdsPublic($product);

        return ProductProviderSku::query()
            ->where('is_active', true)
            ->whereIn('product_id', $siblingIds)
            ->exists();
    }
}
