<?php

namespace App\Services\Catalog;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Services\AvailabilityService;
use App\Services\ProductProviders\LogicalProductKey;
use App\Services\ProductProviders\ProductRoutingService;
use Illuminate\Support\Collection;

/**
 * Read-only catalog / provider mapping audit (FR-OPS catalog diagnostics).
 */
class CatalogProviderAuditService
{
    public function __construct(
        protected ProductRoutingService $routing,
        protected AvailabilityService $availability,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function summarize(?array $categorySlugs = null): array
    {
        $digiId = ProductProvider::digiflazz()?->id;
        $vipId = ProductProvider::vip()?->id;

        $query = Product::query()
            ->with(['category', 'provider', 'providerSkus.productProvider'])
            ->whereNull('deleted_at')
            ->where('status', true)
            ->where(function ($q) {
                $q->where('ops_status', 'active')
                    ->orWhereNull('ops_status')
                    ->orWhere('ops_status', '');
            });

        if ($categorySlugs !== null && $categorySlugs !== []) {
            $query->whereHas('category', fn ($q) => $q->whereIn('slug', $categorySlugs));
        }

        $products = $query->get();

        $stats = [
            'total_active' => $products->count(),
            'digiflazz_only' => 0,
            'vip_only' => 0,
            'both_providers' => 0,
            'no_mapping' => 0,
            'invalid_mapping' => 0,
            'purchasable' => 0,
            'likely_duplicate_groups' => 0,
        ];

        $byCategory = [];
        $duplicateKeys = [];

        foreach ($products as $product) {
            $slug = (string) ($product->category?->slug ?? 'unknown');
            if (!isset($byCategory[$slug])) {
                $byCategory[$slug] = [
                    'active' => 0,
                    'digiflazz_only' => 0,
                    'vip_only' => 0,
                    'both_providers' => 0,
                    'no_mapping' => 0,
                    'invalid_mapping' => 0,
                    'purchasable' => 0,
                    'duplicate_group_keys' => [],
                ];
            }
            $byCategory[$slug]['active']++;

            $mapping = $this->classifyProviderMapping($product, $digiId, $vipId);
            $stats[$mapping['bucket']]++;
            $byCategory[$slug][$mapping['bucket']]++;

            if ($mapping['invalid']) {
                $stats['invalid_mapping']++;
                $byCategory[$slug]['invalid_mapping']++;
            }

            if ($this->availability->isAvailable($product) && $this->routing->productHasActiveOffer($product)) {
                $stats['purchasable']++;
                $byCategory[$slug]['purchasable']++;
            }

            $groupKey = LogicalProductKey::groupKey($product);
            $duplicateKeys[$slug][$groupKey] = ($duplicateKeys[$slug][$groupKey] ?? 0) + 1;
        }

        foreach ($duplicateKeys as $slug => $groups) {
            $dupCount = collect($groups)->filter(fn (int $c) => $c > 1)->count();
            $stats['likely_duplicate_groups'] += $dupCount;
            $byCategory[$slug]['duplicate_group_keys'] = $dupCount;
        }

        uasort($byCategory, fn (array $a, array $b) => ($b['no_mapping'] + $b['duplicate_group_keys']) <=> ($a['no_mapping'] + $a['duplicate_group_keys']));

        return [
            'generated_at' => now()->toIso8601String(),
            'summary' => $stats,
            'by_category' => $byCategory,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function sampleProducts(string $categorySlug, int $limit = 5): array
    {
        $digiId = ProductProvider::digiflazz()?->id;
        $vipId = ProductProvider::vip()?->id;

        $products = Product::query()
            ->with(['category', 'provider', 'providerSkus.productProvider'])
            ->whereNull('deleted_at')
            ->where('status', true)
            ->whereHas('category', fn ($q) => $q->where('slug', $categorySlug))
            ->orderBy('name')
            ->limit($limit)
            ->get();

        return $products->map(fn (Product $p) => $this->productRow($p, $digiId, $vipId))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function productRow(Product $product, ?int $digiId, ?int $vipId): array
    {
        $activeSkus = $product->providerSkus->filter(fn (ProductProviderSku $s) => (bool) $s->is_active);
        $hasDigi = $digiId && $activeSkus->contains(fn (ProductProviderSku $s) => (int) $s->product_provider_id === $digiId);
        $hasVip = $vipId && $activeSkus->contains(fn (ProductProviderSku $s) => (int) $s->product_provider_id === $vipId);

        $result = 'BLOCKED';
        $routing = [];
        if ($hasDigi && $hasVip) {
            $result = 'AVAILABLE';
            $routing = ['primary' => ProductProvider::CODE_DIGIFLAZZ, 'fallback' => ProductProvider::CODE_VIP];
        } elseif ($hasDigi) {
            $result = 'AVAILABLE';
            $routing = ['provider' => ProductProvider::CODE_DIGIFLAZZ];
        } elseif ($hasVip) {
            $result = 'AVAILABLE';
            $routing = ['provider' => ProductProvider::CODE_VIP];
        } elseif ($this->routing->productHasActiveOffer($product)) {
            $result = 'AVAILABLE';
            $offers = $this->routing->orderedOffersForProduct($product);
            $routing = ['provider' => $offers->first()?->productProvider?->code];
        }

        $purchasable = $this->availability->isAvailable($product) && $this->routing->productHasActiveOffer($product);
        if (!$purchasable && $result === 'AVAILABLE') {
            $result = 'BLOCKED';
        }

        return [
            'id' => $product->id,
            'sku' => $product->sku_code,
            'name' => $product->name,
            'category' => $product->category?->slug,
            'operator' => $product->provider?->name,
            'digiflazz' => $hasDigi ? 'tersedia' : 'tidak tersedia',
            'vipayment' => $hasVip ? 'tersedia' : 'tidak tersedia',
            'result' => $result,
            'routing' => $routing,
            'purchasable' => $purchasable,
        ];
    }

    /**
     * @return array{bucket: string, invalid: bool}
     */
    protected function classifyProviderMapping(Product $product, ?int $digiId, ?int $vipId): array
    {
        $activeSkus = $product->providerSkus->filter(fn (ProductProviderSku $s) => (bool) $s->is_active);
        $hasDigi = $digiId && $activeSkus->contains(fn (ProductProviderSku $s) => (int) $s->product_provider_id === $digiId && trim((string) $s->provider_sku) !== '');
        $hasVip = $vipId && $activeSkus->contains(fn (ProductProviderSku $s) => (int) $s->product_provider_id === $vipId && trim((string) $s->provider_sku) !== '');

        $invalid = $activeSkus->contains(fn (ProductProviderSku $s) => trim((string) $s->provider_sku) === '');

        if ($hasDigi && $hasVip) {
            return ['bucket' => 'both_providers', 'invalid' => $invalid];
        }
        if ($hasDigi) {
            return ['bucket' => 'digiflazz_only', 'invalid' => $invalid];
        }
        if ($hasVip) {
            return ['bucket' => 'vip_only', 'invalid' => $invalid];
        }

        // Legacy Digiflazz master without SKU row
        if ($activeSkus->isEmpty()
            && $product->product_provider_id === $digiId
            && trim((string) $product->sku_code) !== ''
            && !str_starts_with((string) $product->sku_code, 'VIP-')
        ) {
            return ['bucket' => 'digiflazz_only', 'invalid' => false];
        }

        return ['bucket' => 'no_mapping', 'invalid' => $invalid];
    }
}
