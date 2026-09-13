<?php

namespace App\Http\Resources;

use App\Services\AvailabilityService;
use App\Services\Catalog\ProductPurchaseLifecycleService;
use App\Services\PricingService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Sparse customer LIST DTO for GET /api/v1/products.
 *
 * Omits sensitive cost fields (basePrice, providerCost, margin) and heavy nested
 * admin/sync metadata. Detail remains ProductResource via GET /products/{sku}.
 *
 * KEEP for list UI: id, code, name, price, adminFee, status, isPurchasable,
 * zoneLabel, description, quota, validity, badge, operatorName, provider,
 * providerDetails (id,name,logo), digiflazzCategory, category, requiresRegion,
 * transactionCapability, dataType/dataGroup/telkomselGroup, open-amount fields.
 *
 * DROP from list: basePrice, providerCost, margin, categoryDetails,
 * productProvider nested objects, timestamps, purchaseLifecycle, mappingSource.
 */
class ProductListResource extends JsonResource
{
    /** @var array<int, 'active'|'maintenance'|'offline'>|null */
    protected static ?array $providerFulfillmentCache = null;

    public static function resetListingCache(): void
    {
        self::$providerFulfillmentCache = null;
        ProductResource::resetListingCache();
    }

    public function toArray(Request $request): array
    {
        $pricingService = resolve(PricingService::class);
        $availabilityService = resolve(AvailabilityService::class);

        $pricingDetails = $pricingService->calculateForProduct($this->resource);

        if (self::$providerFulfillmentCache === null) {
            self::$providerFulfillmentCache = $availabilityService->buildProviderFulfillmentMap();
        }
        $availabilityStatus = $availabilityService->getListingStatus(
            $this->resource,
            self::$providerFulfillmentCache
        );

        $sellable = $availabilityStatus === 'active';
        $lifecycle = resolve(ProductPurchaseLifecycleService::class)->evaluate($this->resource);
        if (! ($lifecycle['purchasable'] ?? false)) {
            $sellable = false;
        }

        $description = '';
        $meta = ['quota' => null, 'validity' => null];
        $dataGroup = null;
        $badge = null;
        $requiresRegion = false;
        $digiDataType = null;

        if ($this->needsOperatorTaxonomy()) {
            $resolver = resolve(\App\Services\Catalog\OperatorDataTaxonomyResolver::class);
            $metaSvc = $resolver->meta();
            $description = $metaSvc->descriptionFor($this->resource);
            $meta = $metaSvc->parseMeta((string) $this->name, $description);
            $dynamic = resolve(\App\Services\Catalog\DynamicOperatorDataTaxonomyService::class);
            $digiDataType = $dynamic->digiTypeForProduct($this->resource);
            $dataGroup = [
                'group' => $dynamic->chipKeyForType($digiDataType),
                'label' => $dynamic->displayLabelForType($digiDataType),
            ];
            $operatorTaxonomy = $resolver->forBrand($this->provider?->name);
            if ($operatorTaxonomy) {
                $classified = $operatorTaxonomy->classify((string) $this->name, $description);
                $badge = $operatorTaxonomy->badgeFor($this->resource, $classified);
                $requiresRegion = $operatorTaxonomy->mentionsRegion((string) $this->name, $description);
            }
        }

        $capability = $lifecycle['capability'] ?? null;

        return [
            'id' => $this->id,
            'code' => $this->sku_code,
            'name' => $this->name,
            'zoneLabel' => $this->zone_label,
            'description' => $description,
            'quota' => $meta['quota'],
            'validity' => $meta['validity'],
            'badge' => $badge,
            'telkomselGroup' => $dataGroup['group'] ?? null,
            'telkomselGroupLabel' => $dataGroup['label'] ?? null,
            'dataGroup' => $dataGroup['group'] ?? null,
            'dataGroupLabel' => $dataGroup['label'] ?? null,
            'dataType' => $digiDataType,
            'requiresRegion' => $requiresRegion,
            // Customer sell price only — never basePrice / providerCost / margin on list.
            'adminFee' => (float) $pricingDetails['admin_fee'],
            'price' => (float) $pricingDetails['sell_price'],
            'sellingPrice' => (float) ($pricingDetails['selling_price'] ?? $pricingDetails['sell_price']),
            'status' => $availabilityStatus === 'maintenance'
                ? 'maintenance'
                : ($sellable ? 'tersedia' : 'gangguan'),
            'isActive' => $sellable,
            'isPurchasable' => $sellable,
            'transactionCapability' => $capability === null ? null : [
                'mode' => $capability['mode'] ?? null,
                'targetSchema' => $capability['target_schema'] ?? null,
                'inquiryRequired' => $capability['inquiry_required'] ?? false,
                'mobilePurchase' => $capability['mobile_purchase'] ?? false,
                'webPurchase' => $capability['web_purchase'] ?? false,
            ],
            'category' => $this->category?->slug ?? 'pulsa',
            'digiflazzCategory' => $this->resolveDigiflazzCategory(),
            'operatorName' => $this->provider?->name ?? 'System',
            'provider' => $this->provider?->name ?? 'System',
            'providerDetails' => $this->whenLoaded('provider', function () {
                return [
                    'id' => $this->provider->id,
                    'name' => $this->provider->name,
                    'logo' => $this->provider->logo,
                    'isActive' => (bool) $this->provider->is_active,
                ];
            }),
            ...$this->ewalletOpenAmountMeta(),
        ];
    }

    protected function resolveDigiflazzCategory(): ?string
    {
        if ((string) ($this->category?->slug ?? '') !== 'voucher-internet') {
            return null;
        }

        return resolve(\App\Services\Catalog\VoucherInternetDigiCategoryGate::class)
            ->resolveDigiCategory($this->resource);
    }

    /**
     * @return array{is_open_amount?: bool, min_amount?: int, max_amount?: int}
     */
    protected function ewalletOpenAmountMeta(): array
    {
        $resolver = resolve(\App\Services\Catalog\EwalletBrandResolver::class);
        if (! $resolver->isOpenAmountProduct($this->resource)) {
            return ['is_open_amount' => false];
        }

        $limits = $resolver->openAmountLimitsForProduct($this->resource);
        if ($limits === null) {
            return ['is_open_amount' => true];
        }

        return [
            'is_open_amount' => true,
            'min_amount' => $limits['min_amount'],
            'max_amount' => $limits['max_amount'],
        ];
    }

    protected function needsOperatorTaxonomy(): bool
    {
        $slug = (string) ($this->category?->slug ?? '');

        return in_array($slug, [
            'data',
            'paket-data',
            'pulsa',
            'voucher-internet',
            'sms-telepon',
            'masa-aktif',
            'aktivasi-perdana',
            'esim',
        ], true);
    }
}
