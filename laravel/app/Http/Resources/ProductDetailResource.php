<?php

namespace App\Http\Resources;

use App\Services\Catalog\ProductPurchaseLifecycleService;
use Illuminate\Http\Request;

/**
 * Customer DETAIL DTO for GET /api/v1/products/{sku}.
 *
 * Same safe sell-price surface as ProductListResource, plus purchase-gate
 * extras useful on the detail/checkout screen. Never exposes basePrice,
 * providerCost, or margin. Ops/Finance continue to use ProductResource.
 */
class ProductDetailResource extends ProductListResource
{
    public function toArray(Request $request): array
    {
        $base = parent::toArray($request);

        $lifecycle = resolve(ProductPurchaseLifecycleService::class)->evaluate($this->resource);
        $availabilityStatus = match ($base['status'] ?? null) {
            'maintenance' => 'maintenance',
            'tersedia' => 'active',
            default => 'inactive',
        };

        return array_merge($base, [
            'availabilityStatus' => $availabilityStatus,
            'isCatalogVisible' => (bool) ($lifecycle['catalog_visible'] ?? ($base['isPurchasable'] ?? false)),
            'purchaseLifecycle' => $lifecycle['stage'] ?? null,
            'notPurchasableReason' => $lifecycle['reason'] ?? null,
        ]);
    }
}
