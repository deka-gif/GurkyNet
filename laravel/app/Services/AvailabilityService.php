<?php

namespace App\Services;

use App\Models\Product;

class AvailabilityService
{
    /**
     * Determine availability status of a product.
     * Returns: 'active', 'inactive', or 'maintenance'
     */
    public function getStatus(Product $product): string
    {
        if (!$product->status) {
            return 'inactive';
        }

        // Simulating maintenance mode for specific SKUs or categories for sandbox/testing purposes
        if (str_contains(strtoupper($product->sku_code), 'MAINTENANCE')) {
            return 'maintenance';
        }

        // Default to active if status is true
        return 'active';
    }

    /**
     * Check if product is currently available for purchase.
     */
    public function isAvailable(Product $product): bool
    {
        return $this->getStatus($product) === 'active';
    }
}
