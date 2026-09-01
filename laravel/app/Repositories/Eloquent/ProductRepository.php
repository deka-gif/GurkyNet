<?php

namespace App\Repositories\Eloquent;

use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\ProductProviders\LogicalProductKey;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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

    protected function catalogTraceEnabled(): bool
    {
        return (bool) config('app.catalog_trace_enabled', false);
    }

    public function getPaginatedProducts(array $filters = []): LengthAwarePaginator
    {
        ProductResource::resetListingCache();
        static::$vipTraceBudget = 30;
        static::$visibilityTraceBudget = 30;

        if ($this->catalogTraceEnabled()) {
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
        }

        $this->repairAndReportLegacyUnmapped();

        $query = Product::query()->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider']);

        $this->applyControlCenterVisibility($query);
        $this->applyListFilters($query, $filters);

        $perPage = (int) ($filters['per_page'] ?? 15);
        $page = max(1, (int) ($filters['page'] ?? request()->input('page', 1)));

        if ($this->catalogTraceEnabled()) {
            Log::info('CATALOG TRACE — Raw SQL', [
                'sql' => $query->toSql(),
            ]);

            Log::info('CATALOG TRACE — Bindings', [
                'bindings' => $query->getBindings(),
            ]);
        }

        $all = $query->orderBy('id')->get();

        if ($this->catalogTraceEnabled()) {
            Log::info('CATALOG TRACE — count($all) after get()', [
                'count' => $all->count(),
            ]);

            $this->logVipCatalogMappings($all);
        }

        $merged = $this->mergeDuplicateCatalogProducts($all);
        $merged = $this->applyTelkomselGroupFilter($merged, $filters);
        $merged = $this->sortCatalogProducts($merged, $filters);

        if ($this->catalogTraceEnabled()) {
            Log::info('CATALOG TRACE — count after mergeDuplicateCatalogProducts()', [
                'count' => $merged->count(),
            ]);

            $this->logFilterTraceForCollection($merged, 'getPaginatedProducts');

            Log::info('CATALOG TRACE — final count before paginator', [
                'total' => $merged->count(),
                'slice_count' => min($perPage, max(0, $merged->count() - (($page - 1) * $perPage))),
                'page' => $page,
                'per_page' => $perPage,
            ]);
        }

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
        ProductResource::exitListingMode();
        $this->repairAndReportLegacyUnmapped();

        $product = Product::with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])->find($id);
        if (!$product) {
            return null;
        }

        if (strtolower((string) ($product->ops_status ?? 'active')) === 'inactive') {
            $this->logFilterTrace($product, 'HIDDEN', 'ops_status_inactive');
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
        ProductResource::exitListingMode();
        $this->repairAndReportLegacyUnmapped();

        $product = Product::with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])
            ->where('sku_code', $skuCode)
            ->first();

        if (!$product) {
            return null;
        }

        if (strtolower((string) ($product->ops_status ?? 'active')) === 'inactive') {
            $this->logFilterTrace($product, 'HIDDEN', 'ops_status_inactive');
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
        ProductResource::resetListingCache();
        static::$vipTraceBudget = 30;
        static::$visibilityTraceBudget = 30;

        $this->repairAndReportLegacyUnmapped();

        $query = Product::query()
            ->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider']);

        $this->applyControlCenterVisibility($query);

        $all = $query->orderBy('id')->get();
        $merged = $this->sortCatalogProducts($this->mergeDuplicateCatalogProducts($all));
        $this->logFilterTraceForCollection($merged, 'getActiveProducts');

        return new EloquentCollection($merged->all());
    }

    public function getActiveProductsForCategory(string $category): EloquentCollection
    {
        ProductResource::resetListingCache();
        static::$vipTraceBudget = 30;
        static::$visibilityTraceBudget = 30;

        $this->repairAndReportLegacyUnmapped();

        $query = Product::query()
            ->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider']);

        $this->applyControlCenterVisibility($query);
        $this->applyListFilters($query, ['category' => $category]);

        $all = $query->orderBy('id')->get();
        $merged = $this->sortCatalogProducts($this->mergeDuplicateCatalogProducts($all));
        $this->logFilterTraceForCollection($merged, 'getActiveProductsForCategory');

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
        if ($this->catalogTraceEnabled()) {
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
        }

        // Product Management Control Center: hide ops_status=inactive from User Dashboard.
        // Maintenance stays visible (buy disabled via AvailabilityService / ProductResource).
        $query->where(function (Builder $q) {
            $q->whereNull('products.ops_status')
                ->orWhere('products.ops_status', '!=', 'inactive');
        });

        $query->whereHas('providerSkus', function (Builder $q) {
            $q->where('product_provider_skus.is_active', true)
                ->whereHas('productProvider', function (Builder $pp) {
                    $pp->where('product_providers.is_active', true);
                });
        });

        if ($this->catalogTraceEnabled()) {
            $providers = ProductProvider::query()->get(['id', 'code', 'is_active', 'priority']);
            $availableIds = $providers->pluck('id')->values()->all();
            $filteredIds = $providers->where('is_active', true)->pluck('id')->values()->all();

            Log::info('CATALOG TRACE — applyControlCenterVisibility AFTER', [
                'Provider IDs available' => $availableIds,
                'Provider IDs filtered' => $filteredIds,
                'Remaining product count' => (clone $query)->count(),
                'Generated SQL' => $query->toSql(),
                'Bindings' => $query->getBindings(),
            ]);
        }
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

            if ($this->catalogTraceEnabled() && static::$visibilityTraceBudget > 0) {
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

        if ($this->catalogTraceEnabled() && static::$visibilityTraceBudget > 0) {
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
        try {
            if (Cache::has('catalog:legacy-unmapped-repair:throttle')) {
                return;
            }

            Cache::put('catalog:legacy-unmapped-repair:throttle', true, now()->addMinutes(10));
        } catch (\Throwable $e) {
            // Throttle cache must never break catalog GET (file driver permission/subdir issues).
            Log::warning('Catalog legacy-unmapped repair throttle cache unavailable — continuing without throttle', [
                'error' => $e->getMessage(),
            ]);
        }

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

            if ($this->catalogTraceEnabled()) {
                Log::info('PRODUCT FILTER TRACE — LEGACY MAPPED TO DIGIFLAZZ', [
                    'product_id' => $product->id,
                    'sku' => $product->sku_code,
                    'product_provider_id' => $digi->id,
                ]);
            }
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

            if ($this->catalogTraceEnabled()) {
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
            }

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
    protected function sortCatalogProducts(\Illuminate\Support\Collection $products, array $filters = []): \Illuminate\Support\Collection
    {
        $sort = Str::lower((string) ($filters['sort'] ?? ''));

        if (in_array($sort, ['price_asc', 'termurah', 'harga_termurah'], true)) {
            return $products->sortBy(fn (Product $p) => (float) $p->sell_price)->values();
        }
        if (in_array($sort, ['price_desc', 'tertinggi', 'harga_tertinggi'], true)) {
            return $products->sortByDesc(fn (Product $p) => (float) $p->sell_price)->values();
        }
        if (in_array($sort, ['newest', 'terbaru'], true)) {
            return $products->sortByDesc(fn (Product $p) => $p->updated_at?->timestamp ?? $p->id)->values();
        }
        if (in_array($sort, ['popular', 'terlaris'], true)) {
            // No sales counter yet — prefer shorter / common package names as soft popularity proxy + price mid.
            return $products
                ->sort(function (Product $a, Product $b) {
                    $la = strlen((string) $a->name);
                    $lb = strlen((string) $b->name);
                    if ($la !== $lb) {
                        return $la <=> $lb;
                    }

                    return ((float) $a->sell_price) <=> ((float) $b->sell_price);
                })
                ->values();
        }

        if (in_array($sort, ['quota_desc', 'kuota_terbesar'], true)) {
            /** @var \App\Services\Catalog\OperatorDataTaxonomyResolver $resolver */
            $resolver = app(\App\Services\Catalog\OperatorDataTaxonomyResolver::class);
            $taxonomy = $resolver->meta();

            return $products
                ->sortByDesc(fn (Product $p) => $taxonomy->quotaValueMb(
                    (string) $p->name,
                    $taxonomy->descriptionFor($p)
                ))
                ->values();
        }

        if (in_array($sort, ['validity_desc', 'masa_aktif_terlama'], true)) {
            /** @var \App\Services\Catalog\OperatorDataTaxonomyResolver $resolver */
            $resolver = app(\App\Services\Catalog\OperatorDataTaxonomyResolver::class);
            $taxonomy = $resolver->meta();

            return $products
                ->sortByDesc(fn (Product $p) => $taxonomy->validityValueDays(
                    (string) $p->name,
                    $taxonomy->descriptionFor($p)
                ))
                ->values();
        }

        return $products
            ->sort(function (Product $a, Product $b) {
                $ta = LogicalProductKey::sortTuple($a);
                $tb = LogicalProductKey::sortTuple($b);

                return $ta <=> $tb;
            })
            ->values();
    }

    /**
     * Filter operator data products by UX taxonomy group (keyword classification).
     * Accepts telkomsel_group (legacy) or data_group.
     *
     * @param  \Illuminate\Support\Collection<int, Product>  $products
     * @return \Illuminate\Support\Collection<int, Product>
     */
    protected function applyTelkomselGroupFilter(\Illuminate\Support\Collection $products, array $filters): \Illuminate\Support\Collection
    {
        $group = Str::lower(trim((string) (
            $filters['data_group']
            ?? $filters['telkomsel_group']
            ?? ''
        )));
        if ($group === '' || $group === 'semua' || $group === 'all') {
            return $products;
        }

        /** @var \App\Services\Catalog\OperatorDataTaxonomyResolver $resolver */
        $resolver = app(\App\Services\Catalog\OperatorDataTaxonomyResolver::class);

        return $products
            ->filter(function (Product $product) use ($resolver, $group) {
                $taxonomy = $resolver->forBrand($product->provider?->name);
                if (!$taxonomy) {
                    return false;
                }

                return $taxonomy->productMatchesGroup($product, $group);
            })
            ->values();
    }

    protected function catalogGroupKey(Product $product): string
    {
        if (\App\Services\Langganan\LanggananCatalogIdentity::isLanggananProduct($product)) {
            return \App\Services\Langganan\LanggananCatalogIdentity::groupKey($product);
        }

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
        $aLang = \App\Services\Langganan\LanggananCatalogIdentity::isLanggananProduct($a);
        $bLang = \App\Services\Langganan\LanggananCatalogIdentity::isLanggananProduct($b);
        if ($aLang && $bLang) {
            return $this->preferLanggananCatalogProduct($a, $b);
        }

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

    /**
     * Langganan Digital — Digiflazz PRIMARY card; VIP row is hidden but kept for failover routing.
     */
    protected function preferLanggananCatalogProduct(Product $a, Product $b): Product
    {
        $aDigi = $this->isDigiflazzPrimaryCatalogRow($a);
        $bDigi = $this->isDigiflazzPrimaryCatalogRow($b);
        if ($aDigi !== $bDigi) {
            return $aDigi ? $a : $b;
        }

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

    protected function isDigiflazzPrimaryCatalogRow(Product $product): bool
    {
        if (! str_starts_with((string) $product->sku_code, 'VIP-')) {
            return true;
        }

        $digi = ProductProvider::digiflazz();
        if ($digi && (int) $product->product_provider_id === (int) $digi->id) {
            return true;
        }

        foreach ($product->providerSkus ?? [] as $sku) {
            if (! $sku->is_active) {
                continue;
            }
            $pp = $sku->productProvider;
            if ($pp && $pp->code === 'digiflazz' && $pp->is_active) {
                return true;
            }
        }

        return false;
    }

    protected function preferCatalogReason(Product $a, Product $b, Product $chosen): string
    {
        $aLang = \App\Services\Langganan\LanggananCatalogIdentity::isLanggananProduct($a);
        $bLang = \App\Services\Langganan\LanggananCatalogIdentity::isLanggananProduct($b);
        if ($aLang && $bLang) {
            if ($this->isDigiflazzPrimaryCatalogRow($chosen) && ! $this->isDigiflazzPrimaryCatalogRow($chosen->id === $a->id ? $b : $a)) {
                return 'langganan_digiflazz_primary';
            }
        }

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
            if (! $sku->is_active) {
                continue;
            }
            $pp = $sku->productProvider;
            if (! $pp || ! $pp->is_active) {
                continue;
            }
            // Maintenance / offline partners must not win the merged catalog card
            // over a sellable backup provider (VIP).
            if (method_exists($pp, 'isPartnerMaintenance') && $pp->isPartnerMaintenance()) {
                continue;
            }
            if (method_exists($pp, 'isPartnerOffline') && $pp->isPartnerOffline()) {
                continue;
            }
            if (in_array(strtolower((string) ($pp->api_status ?? '')), ['offline', 'not_configured'], true)) {
                continue;
            }
            $best = min($best, (int) ($pp->priority ?? 100));
        }

        // Fallback: if this row has no sellable local offers, use routing (siblings).
        if ($best === PHP_INT_MAX) {
            $offer = app(\App\Services\ProductProviders\ProductRoutingService::class)
                ->orderedOffersForProduct($product)
                ->first();
            if ($offer?->productProvider) {
                return (int) ($offer->productProvider->priority ?? 100);
            }
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
                    ->orWhere('sku_code', 'like', "%{$keyword}%")
                    ->orWhereExists(function ($sub) use ($keyword) {
                        $sub->selectRaw('1')
                            ->from('digiflazz_products')
                            ->whereColumn('digiflazz_products.buyer_sku_code', 'products.sku_code')
                            ->where(function ($d) use ($keyword) {
                                $d->where('desc', 'like', "%{$keyword}%")
                                    ->orWhere('product_name', 'like', "%{$keyword}%");
                            });
                    });
            });
        }
    }

    /**
     * @param  Collection<int, Product>|EloquentCollection<int, Product>  $products
     */
    protected function logVipCatalogMappings(Collection|EloquentCollection $products): void
    {
        if (!$this->catalogTraceEnabled()) {
            return;
        }

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
        if (!$this->catalogTraceEnabled()) {
            return;
        }

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
        if (!$this->catalogTraceEnabled()) {
            return;
        }

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
