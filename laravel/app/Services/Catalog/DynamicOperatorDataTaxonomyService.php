<?php

namespace App\Services\Catalog;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Services\Catalog\ProductPurchaseLifecycleService;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Digi `type`-driven Paket Data taxonomy for ALL operators (one reusable service).
 *
 * Chips = "Semua" + distinct Digi types that have ≥1 catalog-eligible SKU for the brand.
 * Order: Umum first (when present), then alphabetical. No Favorit. No featured-order (phase 2).
 * Filter key = exact Digi type string (empty Digi type normalizes to "Umum").
 */
class DynamicOperatorDataTaxonomyService
{
    public const EMPTY_TYPE_LABEL = 'Umum';

    public function __construct(
        protected OperatorDataTaxonomyResolver $resolver,
        protected ProductPurchaseLifecycleService $lifecycle,
    ) {}

    /**
     * @return array{chips: list<array<string, mixed>>, operator: string, regionOptions: list<string>}
     */
    public function taxonomyFor(string $operatorKey): array
    {
        $legacy = $this->legacyServiceForKey($operatorKey);
        if ($legacy === null) {
            return [
                'chips' => [$this->semuaChip()],
                'operator' => $operatorKey,
                'regionOptions' => [],
            ];
        }

        return [
            'chips' => $this->chipsForOperator($legacy),
            'operator' => $legacy->displayName(),
            'regionOptions' => $legacy->regionOptions(),
        ];
    }

    /**
     * @return list<array{key: string, label: string, group: ?string, data_type: ?string}>
     */
    public function chipsForOperator(OperatorDataTaxonomyService $operator): array
    {
        $types = $this->distinctEligibleDigiTypes($operator);
        $chips = [$this->semuaChip()];

        foreach ($this->sortDigiTypes($types) as $type) {
            $chips[] = [
                'key' => $this->chipKeyForType($type),
                'label' => $this->displayLabelForType($type),
                'group' => $type,
                'data_type' => $type,
            ];
        }

        return $chips;
    }

    /**
     * Normalize Digi type for chip/filter identity. Empty → Umum.
     */
    public function normalizeDigiType(?string $type): string
    {
        $trimmed = trim((string) $type);

        return $trimmed !== '' ? $trimmed : self::EMPTY_TYPE_LABEL;
    }

    public function digiTypeForProduct(Product $product): string
    {
        $row = DigiflazzProduct::query()
            ->where('buyer_sku_code', $product->sku_code)
            ->first(['type']);

        return $this->normalizeDigiType($row?->type);
    }

    public function productMatchesDigiType(Product $product, string $dataType): bool
    {
        $want = $this->normalizeDigiType($dataType);
        if ($want === '' || Str::lower($want) === 'semua' || Str::lower($want) === 'all') {
            return true;
        }

        return Str::lower($this->digiTypeForProduct($product)) === Str::lower($want);
    }

    public function displayLabelForType(string $type): string
    {
        $normalized = $this->normalizeDigiType($type);
        $aliases = config('data_type_display_aliases', []);
        if (is_array($aliases) && isset($aliases[$normalized]) && is_string($aliases[$normalized]) && $aliases[$normalized] !== '') {
            return $aliases[$normalized];
        }

        return $normalized;
    }

    public function chipKeyForType(string $type): string
    {
        $slug = Str::slug($this->normalizeDigiType($type));

        return $slug !== '' ? $slug : 'umum';
    }

    /**
     * @return list<string>
     */
    public function distinctEligibleDigiTypes(OperatorDataTaxonomyService $operator): array
    {
        $products = $this->eligibleDataProductsForOperator($operator);
        if ($products->isEmpty()) {
            return [];
        }

        $skuCodes = $products->pluck('sku_code')->filter()->unique()->values()->all();
        $typeBySku = DigiflazzProduct::query()
            ->whereIn('buyer_sku_code', $skuCodes)
            ->pluck('type', 'buyer_sku_code');

        $types = [];
        foreach ($skuCodes as $sku) {
            $raw = $typeBySku[$sku] ?? null;
            $types[$this->normalizeDigiType(is_string($raw) ? $raw : null)] = true;
        }

        return array_keys($types);
    }

    /**
     * @return Collection<int, Product>
     */
    protected function eligibleDataProductsForOperator(OperatorDataTaxonomyService $operator): Collection
    {
        $slugs = config('gurky_catalog.filter_aliases.data', ['data', 'paket-data', 'paket-internet']);
        if (! is_array($slugs) || $slugs === []) {
            $slugs = ['data'];
        }

        $categoryIds = ProductCategory::query()
            ->whereIn('slug', $slugs)
            ->pluck('id');

        if ($categoryIds->isEmpty()) {
            return collect();
        }

        $products = Product::query()
            ->with(['provider', 'providerSkus.productProvider', 'category'])
            ->whereIn('product_category_id', $categoryIds)
            ->where(function ($q) {
                $q->whereNull('ops_status')
                    ->orWhere('ops_status', '!=', 'inactive');
            })
            ->whereHas('providerSkus', function ($q) {
                $q->where('product_provider_skus.is_active', true)
                    ->whereHas('productProvider', function ($pp) {
                        $pp->where('product_providers.is_active', true);
                    });
            })
            ->whereHas('provider', function ($q) {
                $q->where('is_active', true);
            })
            ->get();

        return $products
            ->filter(function (Product $product) use ($operator) {
                if (! $operator->isOperatorBrand($product->provider?->name)) {
                    return false;
                }
                $life = $this->lifecycle->evaluate($product);

                return ($life['purchasable'] ?? false)
                    && ($life['catalog_visible'] ?? false)
                    && (($life['stage'] ?? null) === ProductPurchaseLifecycleService::STAGE_PURCHASABLE);
            })
            ->values();
    }

    /**
     * @param  list<string>  $types
     * @return list<string>
     */
    protected function sortDigiTypes(array $types): array
    {
        usort($types, function (string $a, string $b) {
            $aUmum = Str::lower($a) === Str::lower(self::EMPTY_TYPE_LABEL);
            $bUmum = Str::lower($b) === Str::lower(self::EMPTY_TYPE_LABEL);
            if ($aUmum !== $bUmum) {
                return $aUmum ? -1 : 1;
            }

            return strcmp(Str::lower($a), Str::lower($b));
        });

        return array_values($types);
    }

    /**
     * @return array{key: string, label: string, group: null, data_type: null}
     */
    protected function semuaChip(): array
    {
        return [
            'key' => 'semua',
            'label' => 'Semua',
            'group' => null,
            'data_type' => null,
        ];
    }

    protected function legacyServiceForKey(string $operatorKey): ?OperatorDataTaxonomyService
    {
        $key = Str::lower(trim($operatorKey));

        return match ($key) {
            'telkomsel' => app(TelkomselDataTaxonomyService::class),
            'xl' => app(XlDataTaxonomyService::class),
            'indosat' => app(IndosatDataTaxonomyService::class),
            'tri' => app(TriDataTaxonomyService::class),
            'smartfren' => app(SmartfrenDataTaxonomyService::class),
            'axis' => app(AxisDataTaxonomyService::class),
            'byu' => app(ByuDataTaxonomyService::class),
            default => null,
        };
    }
}
