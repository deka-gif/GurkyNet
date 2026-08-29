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
        // getStatus() already delegates to Control Center routing for 'active'.
        $sellable = $availabilityStatus === 'active';
        $catalogVisible = $availabilityStatus === 'active' || $availabilityStatus === 'maintenance';

        $description = '';
        $meta = ['quota' => null, 'validity' => null];
        $dataGroup = null;
        $badge = null;
        $requiresRegion = false;

        if ($this->needsOperatorTaxonomy()) {
            $resolver = resolve(\App\Services\Catalog\OperatorDataTaxonomyResolver::class);
            $metaSvc = $resolver->meta();
            $description = $metaSvc->descriptionFor($this->resource);
            $meta = $metaSvc->parseMeta((string) $this->name, $description);
            $operatorTaxonomy = $resolver->forBrand($this->provider?->name);
            if ($operatorTaxonomy) {
                $dataGroup = $operatorTaxonomy->classify((string) $this->name, $description);
                $badge = $operatorTaxonomy->badgeFor($this->resource, $dataGroup);
                $requiresRegion = $operatorTaxonomy->mentionsRegion((string) $this->name, $description);
            }
        }

        return [
            'id' => $this->id,
            'code' => $this->sku_code,
            'name' => $this->name,
            'description' => $description,
            'quota' => $meta['quota'],
            'validity' => $meta['validity'],
            'badge' => $badge,
            // Legacy keys kept for Telkomsel master template consumers.
            'telkomselGroup' => $dataGroup['group'] ?? null,
            'telkomselGroupLabel' => $dataGroup['label'] ?? null,
            'dataGroup' => $dataGroup['group'] ?? null,
            'dataGroupLabel' => $dataGroup['label'] ?? null,
            'requiresRegion' => $requiresRegion,
            'basePrice' => (float) $pricingDetails['base_price'],
            'providerCost' => (float) ($pricingDetails['provider_cost'] ?? $pricingDetails['base_price']),
            'margin' => (float) $pricingDetails['margin'],
            'adminFee' => (float) $pricingDetails['admin_fee'],
            'price' => (float) $pricingDetails['sell_price'],
            'sellingPrice' => (float) ($pricingDetails['selling_price'] ?? $pricingDetails['sell_price']),
            // Dashboard lists status === 'tersedia' | 'maintenance'.
            // Digi may leave products.status=false while VIP SKU remains sellable — prefer Control Center.
            // Maintenance remains catalog-visible; purchase is disabled via availabilityStatus / isActive.
            'status' => $availabilityStatus === 'maintenance'
                ? 'maintenance'
                : ($sellable ? 'tersedia' : 'gangguan'),
            'isActive' => $sellable,
            'opsStatus' => $this->ops_status ?? $availabilityStatus,
            'availabilityStatus' => $availabilityStatus, // Engine calculated: active, inactive, maintenance
            'isPurchasable' => $sellable,
            'isCatalogVisible' => $catalogVisible,
            'category' => $this->category?->slug ?? 'pulsa', // Frontend expected category slug
            'categoryDetails' => new CategoryResource($this->whenLoaded('category')),
            // How this product's category was resolved by ProductMappingService — lets
            // Operations spot products that fell through to the unmapped fallback instead
            // of a confident provider-category/brand-override match (Phase 20).
            'categoryMappingSource' => $this->category_mapping_source,
'operatorName' => $this->provider?->name ?? 'System',
            // Operator brand (Telkomsel, PLN, …) — kept as `provider` for existing UI.
            'provider' => $this->provider?->name ?? 'System',
            'providerDetails' => new ProviderResource($this->whenLoaded('provider')),
            // Product Provider / catalog source (Digiflazz, VipPulsa, …).
            'productProvider' => $this->productProvider?->name,
            'productProviderCode' => $this->productProvider?->code,
            'productProviderId' => $this->product_provider_id,
            'productProviderDetails' => $this->whenLoaded('productProvider', fn () => new ProductProviderResource($this->productProvider)),
            // Provider-level last catalog sync (per-product sync metadata doesn't exist —
            // every product sharing a provider shares that provider's last successful run).
            'lastSyncedAt' => $this->productProvider?->last_sync_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Telkomsel/XL/… data UX taxonomy — skip for game/voucher/langganan/international hubs.
     */
    protected function needsOperatorTaxonomy(): bool
    {
        $slug = (string) ($this->category?->slug ?? '');

        return in_array($slug, [
            'data',
            'pulsa',
            'voucher-internet',
            'sms-telepon',
            'masa-aktif',
            'aktivasi-perdana',
            'esim',
        ], true);
    }
}
