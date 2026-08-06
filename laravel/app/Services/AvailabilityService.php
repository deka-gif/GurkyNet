<?php

namespace App\Services;

use App\Models\Product;

class AvailabilityService
{
    /**
     * Determine availability status of a product.
     * Returns: 'active', 'inactive', or 'maintenance'
     *
     * Control Center (active product_provider_skus on an enabled Product Provider)
     * is the sellability source of truth — same rule as catalog ProductResource.
     * Digiflazz may leave products.status=false while VIP (or another provider) remains sellable.
     */
    public function getStatus(Product $product): string
    {
        // Simulating maintenance mode for specific SKUs or categories for sandbox/testing purposes
        if (str_contains(strtoupper($product->sku_code), 'MAINTENANCE')) {
            return 'maintenance';
        }

        if ($this->isSellableViaControlCenter($product)) {
            return 'active';
        }

        if ($product->status) {
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
     * Mirrors ProductResource / ProductRepository Control Center visibility.
     */
    public function isSellableViaControlCenter(Product $product): bool
    {
        $product->loadMissing('providerSkus.productProvider');

        foreach ($product->providerSkus as $sku) {
            if ($sku->is_active && $sku->productProvider && $sku->productProvider->is_active) {
                return true;
            }
        }

        return false;
    }
}
