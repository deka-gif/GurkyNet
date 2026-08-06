<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Services\PricingService;
use App\Services\AvailabilityService;
use App\Http\Resources\ProviderResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductProviderResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $pricingService = resolve(PricingService::class);
        $availabilityService = resolve(AvailabilityService::class);

        $pricingDetails = $pricingService->calculateForProduct($this->resource);
        $availabilityStatus = $availabilityService->getStatus($this->resource);
        $sellable = $this->isSellableViaControlCenter();

        return [
            'id' => $this->id,
            'code' => $this->sku_code,
            'name' => $this->name,
            'basePrice' => (float) $pricingDetails['base_price'],
            'providerCost' => (float) ($pricingDetails['provider_cost'] ?? $pricingDetails['base_price']),
            'margin' => (float) $pricingDetails['margin'],
            'adminFee' => (float) $pricingDetails['admin_fee'],
            'price' => (float) $pricingDetails['sell_price'],
            'sellingPrice' => (float) ($pricingDetails['selling_price'] ?? $pricingDetails['sell_price']),
            // Dashboard filters status === 'tersedia'. Digi may leave products.status=false
            // even when an enabled VIP (or Digi) SKU offer is active — prefer Control Center.
            'status' => $sellable ? 'tersedia' : 'gangguan',
            'isActive' => $sellable,
            'availabilityStatus' => $availabilityStatus, // Engine calculated: active, inactive, maintenance
            'category' => $this->category?->slug ?? 'pulsa', // Frontend expected category slug
            'categoryDetails' => new CategoryResource($this->whenLoaded('category')),
'operatorName' => $this->provider?->name ?? 'System',
            // Operator brand (Telkomsel, PLN, …) — kept as `provider` for existing UI.
            'provider' => $this->provider?->name ?? 'System',
            'providerDetails' => new ProviderResource($this->whenLoaded('provider')),
            // Product Provider / catalog source (Digiflazz, VipPulsa, …).
            'productProvider' => $this->productProvider?->name,
            'productProviderCode' => $this->productProvider?->code,
            'productProviderId' => $this->product_provider_id,
            'productProviderDetails' => $this->whenLoaded('productProvider', fn () => new ProductProviderResource($this->productProvider)),
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Sellable when any active product_provider_skus row belongs to an enabled Product Provider.
     * Falls back to products.status when SKU relations are not loaded.
     */
    protected function isSellableViaControlCenter(): bool
    {
        $this->resource->loadMissing('providerSkus.productProvider');

        foreach ($this->providerSkus as $sku) {
            if ($sku->is_active && $sku->productProvider && $sku->productProvider->is_active) {
                return true;
            }
        }

        return (bool) $this->status;
    }
}
