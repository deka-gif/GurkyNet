<?php

namespace App\Services;

use App\Models\Product;

class AvailabilityService
{
    /**
     * Determine availability status of a product.
     * Returns: 'active', 'inactive', or 'maintenance'
     *
     * Priority:
     * 1) Product Management ops_status
     * 2) Provider Management partner_status (Digiflazz/VIP maintenance)
     * 3) Control Center SKU sellability
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

        $product->loadMissing('providerSkus.productProvider', 'productProvider');

        if ($this->isSellableViaControlCenter($product)) {
            return 'active';
        }

        if ($this->hasOnlyMaintenanceOffers($product)) {
            return 'maintenance';
        }

        if ($product->status) {
            // Legacy masters without SKU rows — still respect primary product provider partner mode.
            $pp = $product->productProvider;
            if ($pp && method_exists($pp, 'isPartnerMaintenance') && $pp->isPartnerMaintenance()) {
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
     * Sellable when any active SKU belongs to an enabled + non-maintenance Product Provider.
     */
    public function isSellableViaControlCenter(Product $product): bool
    {
        $product->loadMissing('providerSkus.productProvider');

        foreach ($product->providerSkus as $sku) {
            $pp = $sku->productProvider;
            if (!$sku->is_active || !$pp || !$pp->is_active) {
                continue;
            }
            if (method_exists($pp, 'isPartnerMaintenance') && $pp->isPartnerMaintenance()) {
                continue;
            }
            if (method_exists($pp, 'isPartnerOffline') && $pp->isPartnerOffline()) {
                continue;
            }

            return true;
        }

        return false;
    }

    /**
     * Product still has enabled provider SKUs, but every offer is in partner maintenance.
     */
    protected function hasOnlyMaintenanceOffers(Product $product): bool
    {
        $product->loadMissing('providerSkus.productProvider');

        $sawEnabled = false;
        foreach ($product->providerSkus as $sku) {
            $pp = $sku->productProvider;
            if (!$sku->is_active || !$pp || !$pp->is_active) {
                continue;
            }
            $sawEnabled = true;
            if (!(method_exists($pp, 'isPartnerMaintenance') && $pp->isPartnerMaintenance())) {
                return false;
            }
        }

        return $sawEnabled;
    }
}
