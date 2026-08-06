<?php

namespace App\Repositories\Eloquent;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\ProductProviders\LogicalProductKey;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * User catalog products — Product Provider Control Center is the single source of truth.
 * A product is visible only when it has an active product_provider_skus row whose
 * product_providers.is_active = true.
 */
class ProductRepository implements ProductRepositoryInterface
{
    /** @var int */
    protected static $vipTraceBudget = 30;

    /** @var int */
    protected static $visibilityTraceBudget = 30;

    public function getPaginatedProducts(array $filters = []): LengthAwarePaginator
    {
        static::$vipTraceBudget = 30;
        static::$visibilityTraceBudget = 30;

        Log::info('CATALOG TRACE — product_providers', [
            'rows' => ProductProvider::query()->get(['id', 'code', 'is_active', 'priority'])->map(fn (ProductProvider $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'is_active' => $p->is_active,
                'priority' => $p->priority,
            ])->all(),
        ]);

        Log::info('CATALOG TRACE — product_provider_skus active counts', [
            'rows' => ProductProviderSku::query()
                ->where('is_active', 1)
                ->selectRaw('product_provider_id, COUNT(*) as total')
                ->groupBy('product_provider_id')
                ->get()
                ->map(fn ($r) => [
                    'product_provider_id' => $r->product_provider_id,
                    'total' => (int) $r->total,
                ])
                ->all(),
        ]);

        $this->repairAndReportLegacyUnmapped();

        $query = Product::query()->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider']);

        $this->applyControlCenterVisibility($query);
        $this->applyListFilters($query, $filters);

        $perPage = (int) ($filters['per_page'] ?? 15);
        $page = max(1, (int) ($filters['page'] ?? request()->input('page', 1)));

        Log::info('CATALOG TRACE — Raw SQL', [
            'sql' => $query->toSql(),
        ]);

        Log::info('CATALOG TRACE — Bindings', [
            'bindings' => $query->getBindings(),
        ]);

        $all = $query->orderBy('id')->get();

        Log::info('CATALOG TRACE — count($all) after get()', [
            'count' => $all->count(),
        ]);

        $this->logVipCatalogMappings($all);

        $merged = $this->mergeDuplicateCatalogProducts($all);
        $merged = $this->sortCatalogProducts($merged);

        Log::info('CATALOG TRACE — count after mergeDuplicateCatalogProducts()', [
            'count' => $merged->count(),
        ]);

        $this->logFilterTraceForCollection($merged, 'getPaginatedProducts');

        $total = $merged->count();
        $slice = $merged->slice(($page - 1) * $perPage, $perPage)->values();

        Log::info('CATALOG TRACE — final count before paginator', [
            'total' => $total,
            'slice_count' => $slice->count(),
            'page' => $page,
            'per_page' => $perPage,
        ]);

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
            ->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider']);

        $this->applyControlCenterVisibility($query);

        $all = $query->orderBy('id')->get();
        $merged = $this->sortCatalogProducts($this->mergeDuplicateCatalogProducts($all));
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
        $providers = ProductProvider::query()->get(['id', 'code', 'is_active', 'priority']);
        $availableIds = $providers->pluck('id')->values()->all();
        $filteredIds = $providers->where('is_active', true)->pluck('id')->values()->all();

        Log::info('CATALOG TRACE — applyControlCenterVisibility BEFORE', [
            'Provider IDs available' => $availableIds,
            'Provider IDs filtered (is_active=1)' => $filteredIds,
            'providers' => $providers->map(fn (ProductProvider $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'is_active' => (bool) $p->is_active,
                'priority' => $p->priority,
            ])->all(),
        ]);

        $query->whereHas('providerSkus', function (Builder $q) {
            $q->where('product_provider_skus.is_active', true)
                ->whereHas('productProvider', function (Builder $pp) {
                    $pp->where('product_providers.is_active', true);
                });
        });

        Log::info('CATALOG TRACE — applyControlCenterVisibility AFTER', [
            'Provider IDs available' => $availableIds,
            'Provider IDs filtered' => $filteredIds,
            'Remaining product count' => (clone $query)->count(),
            'Generated SQL' => $query->toSql(),
            'Bindings' => $query->getBindings(),
        ]);
    }

    /**
     * Product is user-visible iff at least one active SKU mapping belongs to an enabled Product Provider.
     *
     * Do NOT gate on products.status — Digiflazz sync sets status=false on masters that VIP later
     * attaches to. Control Center (product_providers.is_active + product_provider_skus.is_active)
     * is the single source of truth for catalog visibility.
     */
    protected function isVisibleViaControlCenter(Product $product): bool
    {
        $product->loadMissing('providerSkus.productProvider');

        $visible = false;
        foreach ($product->providerSkus as $sku) {
            $pp = $sku->productProvider;
            $skuVisible = (bool) ($sku->is_active && $pp && $pp->is_active);
            if ($skuVisible) {
                $visible = true;
            }

            if (static::$visibilityTraceBudget > 0) {
                Log::info('VIP CATALOG TRACE — isVisibleViaControlCenter SKU', [
                    'Product ID' => $product->id,
                    'provider_id' => $sku->product_provider_id,
                    'provider_code' => $pp?->code,
                    'provider enabled' => (bool) ($pp?->is_active),
                    'sku enabled' => (bool) $sku->is_active,
                    'provider priority' => $pp?->priority,
                    'visible' => $skuVisible,
                    'product_status' => (bool) $product->status,
                ]);
            }
        }

        if (static::$visibilityTraceBudget > 0) {
            static::$visibilityTraceBudget--;
            Log::info('VIP CATALOG TRACE — isVisibleViaControlCenter', [
                'Product ID' => $product->id,
                'Final decision' => $visible,
            ]);
        }

        return $visible;
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
     * One card per logical product (category family + operator brand + normalized name).
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

            $kept = $groups[$key];
            $chosen = $this->preferCatalogProduct($kept, $product);
            $discarded = $chosen->id === $kept->id ? $product : $kept;
            $reason = $this->preferCatalogReason($kept, $product, $chosen);

            Log::info('VIP CATALOG TRACE — mergeDuplicateCatalogProducts', [
                'Normalized Name' => LogicalProductKey::normalizeName((string) $product->name),
                'Denomination' => LogicalProductKey::extractDenomination((string) $product->name),
                'Group key' => $key,
                'Category' => $product->category?->slug,
                'Category family' => LogicalProductKey::familyFromProduct($product),
                'Provider IDs' => [
                    $kept->product_provider_id,
                    $product->product_provider_id,
                ],
                'Provider Priority' => [
                    $this->bestActiveOfferPriority($kept),
                    $this->bestActiveOfferPriority($product),
                ],
                'Chosen Provider' => $chosen->productProvider?->code ?? $chosen->sku_code,
                'Chosen product_id' => $chosen->id,
                'Discarded Provider' => $discarded->productProvider?->code ?? $discarded->sku_code,
                'Discarded product_id' => $discarded->id,
                'Reason' => $reason,
            ]);

            $groups[$key] = $chosen;
        }

        return collect(array_values($groups))->values();
    }

    /**
     * Deterministic catalog order: Category → Operator → numeric Nominal → name → id.
     *
     * @param  Collection<int, Product>  $products
     * @return Collection<int, Product>
     */
    protected function sortCatalogProducts(Collection $products): Collection
    {
        return $products
            ->sort(function (Product $a, Product $b) {
                $ta = LogicalProductKey::sortTuple($a);
                $tb = LogicalProductKey::sortTuple($b);

                return $ta <=> $tb;
            })
            ->values();
    }

    protected function catalogGroupKey(Product $product): string
    {
        return LogicalProductKey::groupKey($product);
    }

    /**
     * Dashboard uses Digiflazz-style slugs (pulsa). VIP sync stores provider type slugs
     * (pulsa-reguler, paket-internet, …). Treat aliases as one catalog family so VIP
     * products appear under User Dashboard filters and merge with Digiflazz cards.
     */
    protected function normalizeCategoryFamily(string $slug): string
    {
        return LogicalProductKey::normalizeCategoryFamily($slug);
    }

    /**
     * @return list<string>
     */
    protected function categoryFilterSlugs(string $category): array
    {
        return LogicalProductKey::categoryFilterSlugs($category);
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

    protected function preferCatalogReason(Product $a, Product $b, Product $chosen): string
    {
        $pa = $this->bestActiveOfferPriority($a);
        $pb = $this->bestActiveOfferPriority($b);
        if ($pa !== $pb) {
            return 'lower_active_provider_priority';
        }

        $aVip = str_starts_with((string) $a->sku_code, 'VIP-');
        $bVip = str_starts_with((string) $b->sku_code, 'VIP-');
        if ($aVip !== $bVip) {
            return 'prefer_non_vip_sku_code';
        }

        return 'lower_or_equal_sell_price';
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
        // Only apply products.status when the client explicitly asks for it.
        // Default catalog visibility is Control Center SKU gate (applyControlCenterVisibility),
        // so Digi-marked status=false masters with an active VIP offer remain visible.
        if (array_key_exists('status', $filters) && $filters['status'] !== null && $filters['status'] !== '') {
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
                $slugs = $this->categoryFilterSlugs((string) $category);
                $query->whereHas('category', function ($q) use ($slugs) {
                    $q->whereIn('slug', $slugs);
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
    protected function logVipCatalogMappings(Collection|EloquentCollection $products): void
    {
        foreach ($products->take(30) as $product) {
            $product->loadMissing(['providerSkus.productProvider', 'category']);

            if ($product->providerSkus->isEmpty()) {
                Log::info('VIP CATALOG TRACE', [
                    'Product ID' => $product->id,
                    'Product Name' => $product->name,
                    'ProviderSku ID' => null,
                    'Provider ID' => null,
                    'Provider Code' => null,
                    'Provider Enabled' => null,
                    'Sku Enabled' => null,
                    'Priority' => null,
                    'Visible' => false,
                    'category_slug' => $product->category?->slug,
                ]);
                continue;
            }

            foreach ($product->providerSkus as $sku) {
                $pp = $sku->productProvider;
                $visible = (bool) ($product->status && $sku->is_active && $pp && $pp->is_active);

                Log::info('VIP CATALOG TRACE', [
                    'Product ID' => $product->id,
                    'Product Name' => $product->name,
                    'ProviderSku ID' => $sku->id,
                    'Provider ID' => $sku->product_provider_id,
                    'Provider Code' => $pp?->code,
                    'Provider Enabled' => (bool) ($pp?->is_active),
                    'Sku Enabled' => (bool) $sku->is_active,
                    'Priority' => $pp?->priority,
                    'Visible' => $visible,
                    'category_slug' => $product->category?->slug,
                    'sku_code' => $product->sku_code,
                ]);
            }
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
