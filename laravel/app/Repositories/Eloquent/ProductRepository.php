<?php

namespace App\Repositories\Eloquent;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Repositories\Contracts\ProductRepositoryInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * User catalog products — Product Provider Control Center is the single source of truth.
 * A product is visible only when it has an active product_provider_skus row whose
 * product_providers.is_active = true.
 */
class ProductRepository implements ProductRepositoryInterface
{
    public function getPaginatedProducts(array $filters = []): LengthAwarePaginator
    {
        $this->repairAndReportLegacyUnmapped();

        $query = Product::query()->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider']);

        $this->applyControlCenterVisibility($query);
        $this->applyListFilters($query, $filters);

        $perPage = (int) ($filters['per_page'] ?? 15);
        $page = max(1, (int) ($filters['page'] ?? request()->input('page', 1)));

        $all = $query->orderBy('name')->orderBy('id')->get();
        $merged = $this->mergeDuplicateCatalogProducts($all);
        $this->logFilterTraceForCollection($merged, 'getPaginatedProducts');

        $total = $merged->count();
        $slice = $merged->slice(($page - 1) * $perPage, $perPage)->values();

        return new LengthAwarePaginator(
            $slice,
            $total,
            $perPage,
            $page,
            [
                'path' => request()->url(),
                'query' => request()->query(),
            ]
        );
    }

    public function findById(int $id): ?Product
    {
        $this->repairAndReportLegacyUnmapped();

        $product = Product::with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])->find($id);
        if (!$product) {
            return null;
        }

        if (!$this->isVisibleViaControlCenter($product)) {
            $this->logFilterTrace($product, 'HIDDEN', 'no_active_product_provider_sku');
            return null;
        }

        $this->logFilterTrace($product, 'VISIBLE', 'provider_enabled');
        return $product;
    }

    public function findBySku(string $skuCode): ?Product
    {
        $this->repairAndReportLegacyUnmapped();

        $product = Product::with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])
            ->where('sku_code', $skuCode)
            ->first();

        if (!$product) {
            return null;
        }

        if (!$this->isVisibleViaControlCenter($product)) {
            $this->logFilterTrace($product, 'HIDDEN', 'no_active_product_provider_sku');
            return null;
        }

        $this->logFilterTrace($product, 'VISIBLE', 'provider_enabled');
        return $product;
    }

    public function getActiveProducts(): EloquentCollection
    {
        $this->repairAndReportLegacyUnmapped();

        $query = Product::query()
            ->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])
            ->where('status', true);

        $this->applyControlCenterVisibility($query);

        $all = $query->orderBy('name')->orderBy('id')->get();
        $merged = $this->mergeDuplicateCatalogProducts($all);
        $this->logFilterTraceForCollection($merged, 'getActiveProducts');

        return new EloquentCollection($merged->all());
    }

    /**
     * STRICT Control Center gate:
     *
     * EXISTS product_provider_skus
     *   WHERE product_id = products.id
     *     AND is_active = 1
     *     AND product_provider_id IN (
     *       SELECT id FROM product_providers WHERE is_active = 1
     *     )
     */
    protected function applyControlCenterVisibility(Builder $query): void
    {
        $query->whereHas('providerSkus', function (Builder $q) {
            $q->where('product_provider_skus.is_active', true)
                ->whereHas('productProvider', function (Builder $pp) {
                    $pp->where('product_providers.is_active', true);
                });
        });
    }

    /**
     * Product is user-visible iff at least one active SKU mapping belongs to an enabled Product Provider.
     */
    protected function isVisibleViaControlCenter(Product $product): bool
    {
        if (!$product->status) {
            return false;
        }

        $product->loadMissing('providerSkus.productProvider');

        foreach ($product->providerSkus as $sku) {
            if ($sku->is_active && $sku->productProvider && $sku->productProvider->is_active) {
                return true;
            }
        }

        return false;
    }

    /**
     * Legacy Digiflazz / unmapped products: report explicitly and attach Digiflazz mapping
     * when that Product Provider is enabled — so they pass the same Control Center filter.
     */
    protected function repairAndReportLegacyUnmapped(): void
    {
        $legacy = Product::query()
            ->where('status', true)
            ->whereDoesntHave('providerSkus')
            ->get(['id', 'sku_code', 'name', 'base_price', 'product_provider_id']);

        if ($legacy->isEmpty()) {
            return;
        }

        $digi = ProductProvider::digiflazz();

        Log::warning('PRODUCT FILTER TRACE — LEGACY UNMAPPED DETECTED', [
            'count' => $legacy->count(),
            'sku_codes' => $legacy->pluck('sku_code')->take(50)->values()->all(),
            'digiflazz_enabled' => (bool) ($digi?->is_active),
        ]);

        if (!$digi || !$digi->is_active) {
            Log::warning('PRODUCT FILTER TRACE — LEGACY UNMAPPED LEFT HIDDEN', [
                'reason' => 'no_enabled_digiflazz_to_attach_mapping',
                'count' => $legacy->count(),
            ]);

            return;
        }

        foreach ($legacy as $product) {
            // Only auto-map rows that are Digiflazz-owned or historically unassigned.
            if ($product->product_provider_id !== null
                && (int) $product->product_provider_id !== (int) $digi->id) {
                Log::warning('PRODUCT FILTER TRACE — LEGACY UNMAPPED SKIPPED (owned by other provider)', [
                    'product_id' => $product->id,
                    'sku' => $product->sku_code,
                    'product_provider_id' => $product->product_provider_id,
                ]);
                continue;
            }

            ProductProviderSku::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'product_provider_id' => $digi->id,
                ],
                [
                    'provider_sku' => $product->sku_code,
                    'provider_name' => $product->name,
                    'base_price' => $product->base_price,
                    'provider_price' => $product->base_price,
                    'provider_status' => 'available',
                    'is_preferred' => true,
                    'is_active' => true,
                ]
            );

            if ($product->product_provider_id === null) {
                $product->product_provider_id = $digi->id;
                $product->save();
            }

            Log::info('PRODUCT FILTER TRACE — LEGACY MAPPED TO DIGIFLAZZ', [
                'product_id' => $product->id,
                'sku' => $product->sku_code,
                'product_provider_id' => $digi->id,
            ]);
        }
    }

    /**
     * One card per logical product (category + operator brand + normalized name).
     *
     * @param  Collection<int, Product>|EloquentCollection<int, Product>  $products
     * @return Collection<int, Product>
     */
    protected function mergeDuplicateCatalogProducts(Collection|EloquentCollection $products): Collection
    {
        $groups = [];

        foreach ($products as $product) {
            if (!$this->isVisibleViaControlCenter($product)) {
                continue;
            }

            $key = $this->catalogGroupKey($product);
            if (!isset($groups[$key])) {
                $groups[$key] = $product;
                continue;
            }

            $groups[$key] = $this->preferCatalogProduct($groups[$key], $product);
        }

        return collect(array_values($groups))->values();
    }

    protected function catalogGroupKey(Product $product): string
    {
        $name = Str::lower(preg_replace('/\s+/u', ' ', trim((string) $product->name)) ?? '');

        return (int) $product->product_category_id
            . '|' . (int) ($product->provider_id ?? 0)
            . '|' . $name;
    }

    protected function preferCatalogProduct(Product $a, Product $b): Product
    {
        $pa = $this->bestActiveOfferPriority($a);
        $pb = $this->bestActiveOfferPriority($b);

        if ($pa !== $pb) {
            return $pa < $pb ? $a : $b;
        }

        $aVip = str_starts_with((string) $a->sku_code, 'VIP-');
        $bVip = str_starts_with((string) $b->sku_code, 'VIP-');
        if ($aVip !== $bVip) {
            return $aVip ? $b : $a;
        }

        return (float) $a->sell_price <= (float) $b->sell_price ? $a : $b;
    }

    protected function bestActiveOfferPriority(Product $product): int
    {
        $best = PHP_INT_MAX;
        foreach ($product->providerSkus as $sku) {
            if (!$sku->is_active) {
                continue;
            }
            $pp = $sku->productProvider;
            if (!$pp || !$pp->is_active) {
                continue;
            }
            $best = min($best, (int) ($pp->priority ?? 100));
        }

        return $best === PHP_INT_MAX ? 100 : $best;
    }

    protected function applyListFilters(Builder $query, array $filters): void
    {
        if (!isset($filters['status'])) {
            $query->where('status', true);
        } else {
            $status = filter_var($filters['status'], FILTER_VALIDATE_BOOLEAN);
            $query->where('status', $status);
        }

        if (!empty($filters['category_id'])) {
            $query->where('product_category_id', $filters['category_id']);
        } elseif (!empty($filters['category'])) {
            $category = $filters['category'];
            if (is_numeric($category)) {
                $query->where('product_category_id', $category);
            } else {
                $query->whereHas('category', function ($q) use ($category) {
                    $q->where('slug', $category);
                });
            }
        }

        if (!empty($filters['provider_id'])) {
            $query->where('provider_id', $filters['provider_id']);
        } elseif (!empty($filters['provider'])) {
            $provider = $filters['provider'];
            if (is_numeric($provider)) {
                $query->where('provider_id', $provider);
            } else {
                $query->whereHas('provider', function ($q) use ($provider) {
                    $q->where('name', 'like', "%{$provider}%");
                });
            }
        }

        if (!empty($filters['keyword'])) {
            $keyword = $filters['keyword'];
            $query->where(function ($q) use ($keyword) {
                $q->where('name', 'like', "%{$keyword}%")
                    ->orWhere('sku_code', 'like', "%{$keyword}%");
            });
        }
    }

    /**
     * @param  Collection<int, Product>|EloquentCollection<int, Product>  $products
     */
    protected function logFilterTraceForCollection(Collection|EloquentCollection $products, string $context): void
    {
        $enabledProviders = ProductProvider::query()
            ->where('is_active', true)
            ->get(['id', 'code', 'name', 'is_active'])
            ->map(fn (ProductProvider $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'enabled' => (bool) $p->is_active,
            ])
            ->values()
            ->all();

        Log::info('PRODUCT FILTER TRACE — catalog request', [
            'context' => $context,
            'enabled_product_providers' => $enabledProviders,
            'returned_count' => $products->count(),
        ]);

        foreach ($products as $product) {
            $this->logFilterTrace($product, 'VISIBLE', 'provider_enabled');
        }
    }

    protected function logFilterTrace(Product $product, string $verdict, string $reason): void
    {
        $product->loadMissing('providerSkus.productProvider');

        $activeOffers = [];
        foreach ($product->providerSkus as $sku) {
            $activeOffers[] = [
                'product_provider_id' => $sku->product_provider_id,
                'provider_code' => $sku->productProvider?->code,
                'provider_enabled' => (bool) ($sku->productProvider?->is_active),
                'sku_mapping_active' => (bool) $sku->is_active,
                'provider_sku' => $sku->provider_sku,
            ];
        }

        Log::info('PRODUCT FILTER TRACE', [
            'verdict' => $verdict,
            'reason' => $reason,
            'product_id' => $product->id,
            'sku' => $product->sku_code,
            'providers' => $activeOffers,
        ]);
    }
}
