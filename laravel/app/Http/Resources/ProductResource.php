<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Services\PricingService;
use App\Services\AvailabilityService;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $pricingService = resolve(PricingService::class);
        $availabilityService = resolve(AvailabilityService::class);

        $pricingDetails = $pricingService->calculateForProduct($this->resource);
        $availabilityStatus = $availabilityService->getStatus($this->resource);

        return [
            'id' => $this->id,
            'code' => $this->sku_code,
            'name' => $this->name,
            'basePrice' => (float) $pricingDetails['base_price'],
            'margin' => (float) $pricingDetails['margin'],
            'adminFee' => (float) $pricingDetails['admin_fee'],
            'price' => (float) $pricingDetails['sell_price'],
            'status' => $this->status ? 'tersedia' : 'gangguan', // Frontend expected enum string
            'isActive' => (bool) $this->status, // Raw boolean status
            'availabilityStatus' => $availabilityStatus, // Engine calculated: active, inactive, maintenance
            'category' => $this->category?->slug ?? 'pulsa', // Frontend expected category slug
            'categoryDetails' => new CategoryResource($this->whenLoaded('category')),
'operatorName' => $this->provider?->name ?? 'System',
'provider' => $this->provider?->name ?? 'System',
'providerDetails' => new ProviderResource($this->whenLoaded('provider')),
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }
}
