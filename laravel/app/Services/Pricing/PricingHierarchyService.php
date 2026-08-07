<?php

namespace App\Services\Pricing;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Models\Setting;
use App\Repositories\Eloquent\OperationsRepository;
use App\Services\Catalog\OperatorDataTaxonomyResolver;
use App\Services\Catalog\ProductMappingService;
use App\Services\ProductProviders\LogicalProductKey;
use Illuminate\Support\Facades\DB;

/**
 * Hierarchical Pricing catalog: Category → Brand/Operator → (Group) → SKU.
 * Aggregates from Product Mapping Layer (products + providers) — never dumps all SKUs at L1.
 */
class PricingHierarchyService
{
    public function __construct(
        protected ProductMappingService $mapping,
        protected OperatorDataTaxonomyResolver $taxonomy,
        protected OperationsRepository $operations,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function browse(array $filters = []): array
    {
        $category = $this->normalizeCategory($filters['category'] ?? null);
        $brandId = isset($filters['brand_id']) ? (int) $filters['brand_id'] : (isset($filters['provider_id']) ? (int) $filters['provider_id'] : null);
        if ($brandId === 0) {
            $brandId = null;
        }
        $dataGroup = isset($filters['data_group']) ? trim((string) $filters['data_group']) : null;
        if ($dataGroup === '') {
            $dataGroup = null;
        }
        $nodeKey = isset($filters['node_key']) ? trim((string) $filters['node_key']) : null;
        if ($nodeKey === '') {
            $nodeKey = null;
        }

        $base = [
            'margin_rules' => $this->marginRules(),
            'summary' => $this->operations->pricingSummaryMetricsPublic(),
            'level' => 'nodes',
            'category' => $category,
            'breadcrumb' => [],
            'nodes' => [],
            'products' => [],
            'master_products' => [],
            'pagination' => [
                'currentPage' => 1,
                'lastPage' => 1,
                'perPage' => 50,
                'total' => 0,
            ],
        ];

        // SKU leaf: brand selected (and group for data), or bill subcategory node selected.
        if ($this->shouldListSkus($category, $brandId, $dataGroup, $nodeKey)) {
            return array_merge($base, $this->listSkus($filters, $category, $brandId, $dataGroup, $nodeKey));
        }

        // Paket Data: operator → groups
        if ($category === 'data' && $brandId && $dataGroup === null) {
            return array_merge($base, $this->listDataGroups($filters, $brandId));
        }

        // PLN / Tagihan: subcategory nodes before brands/SKUs
        if (in_array($category, ['pln', 'tagihan'], true) && $nodeKey === null && $brandId === null) {
            return array_merge($base, $this->listBillNodes($filters, $category));
        }

        // Semua: top-level category hubs
        if ($category === null || $category === 'all') {
            return array_merge($base, $this->listTopCategories($filters));
        }

        // Default L1: brands / operators for the category
        return array_merge($base, $this->listBrands($filters, $category));
    }

    protected function shouldListSkus(?string $category, ?int $brandId, ?string $dataGroup, ?string $nodeKey): bool
    {
        if ($nodeKey !== null && in_array($category, ['pln', 'tagihan'], true)) {
            return true;
        }
        if ($brandId === null) {
            return false;
        }
        if ($category === 'data') {
            return $dataGroup !== null;
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    protected function listSkus(array $filters, ?string $category, ?int $brandId, ?string $dataGroup, ?string $nodeKey): array
    {
        $skuFilters = $filters;
        $skuFilters['per_page'] = max(1, min(100, (int) ($filters['per_page'] ?? 50)));
        $skuFilters['page'] = max(1, (int) ($filters['page'] ?? 1));

        if ($nodeKey) {
            $skuFilters['category'] = $nodeKey;
        } elseif ($category && $category !== 'all') {
            $skuFilters['category'] = $category;
        }

        if ($brandId) {
            $skuFilters['provider_id'] = $brandId;
        }

        // Avoid double-meaning of "provider" (supplier vs brand)
        unset($skuFilters['brand_id'], $skuFilters['node_key'], $skuFilters['data_group'], $skuFilters['view']);

        $paginator = $this->operations->getProducts($skuFilters);
        $items = collect($paginator->items());

        if ($dataGroup !== null && $category === 'data' && $brandId) {
            $brand = Provider::query()->find($brandId);
            $tax = $this->taxonomy->forBrand($brand?->name);
            if ($tax) {
                $items = $this->productsQuery($skuFilters)
                    ->with(['category', 'provider', 'productProvider'])
                    ->orderBy('products.name')
                    ->get()
                    ->filter(function (Product $p) use ($tax, $dataGroup) {
                        $classified = $tax->classify((string) $p->name, null);

                        return ($classified['group'] ?? '') === $dataGroup;
                    })
                    ->values();

                $page = (int) $skuFilters['page'];
                $perPage = (int) $skuFilters['per_page'];
                $total = $items->count();
                $slice = $items->forPage($page, $perPage)->values();
                $products = $slice->map(fn (Product $p) => $this->operations->mapPricingProductRowPublic($p))->all();

                return [
                    'level' => 'skus',
                    'category' => $category,
                    'breadcrumb' => $this->breadcrumb($category, $brandId, $dataGroup, $nodeKey),
                    'nodes' => [],
                    'products' => $products,
                    'master_products' => $products,
                    'pagination' => [
                        'currentPage' => $page,
                        'lastPage' => (int) max(1, ceil(max(1, $total) / $perPage)),
                        'perPage' => $perPage,
                        'total' => $total,
                    ],
                ];
            }
        }

        $products = $items->map(fn (Product $p) => $this->operations->mapPricingProductRowPublic($p))->all();

        return [
            'level' => 'skus',
            'category' => $category,
            'breadcrumb' => $this->breadcrumb($category, $brandId, $dataGroup, $nodeKey),
            'nodes' => [],
            'products' => $products,
            'master_products' => $products,
            'pagination' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    protected function listDataGroups(array $filters, int $brandId): array
    {
        $brand = Provider::query()->findOrFail($brandId);
        $tax = $this->taxonomy->forBrand($brand->name);
        $products = $this->productsQuery(array_merge($filters, [
            'category' => 'data',
            'provider_id' => $brandId,
        ]))->get(['products.id', 'products.name', 'products.sku_code']);

        $groups = [];
        foreach ($products as $product) {
            if ($tax) {
                $c = $tax->classify((string) $product->name, null);
                $key = (string) ($c['group'] ?? 'umum');
                $label = (string) ($c['label'] ?? 'Umum');
            } else {
                $key = 'umum';
                $label = 'Umum';
            }
            if (! isset($groups[$key])) {
                $groups[$key] = [
                    'key' => $key,
                    'type' => 'group',
                    'name' => $label,
                    'brandId' => $brandId,
                    'brandName' => $brand->name,
                    'skuCount' => 0,
                    'providers' => [],
                ];
            }
            $groups[$key]['skuCount']++;
        }

        $search = strtolower(trim((string) ($filters['search'] ?? '')));
        $nodes = collect($groups)
            ->values()
            ->when($search !== '', fn ($c) => $c->filter(fn ($n) => str_contains(strtolower($n['name']), $search)))
            ->sortBy('name')
            ->values();

        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = 50;
        $total = $nodes->count();
        $slice = $nodes->forPage($page, $perPage)->values()->all();

        return [
            'level' => 'groups',
            'category' => 'data',
            'breadcrumb' => $this->breadcrumb('data', $brandId, null, null),
            'nodes' => $slice,
            'products' => [],
            'master_products' => [],
            'pagination' => [
                'currentPage' => $page,
                'lastPage' => (int) max(1, ceil(max(1, $total) / $perPage)),
                'perPage' => $perPage,
                'total' => $total,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    protected function listBillNodes(array $filters, string $category): array
    {
        $defs = $category === 'pln'
            ? [
                'pln' => 'Token PLN',
                'pln-pascabayar' => 'PLN Pascabayar',
            ]
            : [
                'pdam' => 'PDAM',
                'bpjs-kesehatan' => 'BPJS Kesehatan',
                'bpjs-tk' => 'BPJS Ketenagakerjaan',
                'internet-pascabayar' => 'Internet Pascabayar',
                'tv-pascabayar' => 'TV Pascabayar',
                'gas' => 'Gas PGN',
                'multifinance' => 'Multifinance',
                'pbb' => 'PBB',
                'samsat' => 'SAMSAT',
            ];

        $search = strtolower(trim((string) ($filters['search'] ?? '')));
        $nodes = [];
        foreach ($defs as $slug => $label) {
            if ($search !== '' && ! str_contains(strtolower($label), $search) && ! str_contains($slug, $search)) {
                continue;
            }
            $count = $this->productsQuery(array_merge($filters, ['category' => $slug]))->count();
            if ($count === 0 && $search === '') {
                // Still show node so ops sees empty bill types? Prefer hide empty.
                continue;
            }
            $nodes[] = [
                'key' => $slug,
                'type' => 'subcategory',
                'name' => $label,
                'skuCount' => $count,
                'providers' => $this->supplierNamesForCategory($slug, $filters),
            ];
        }

        $page = max(1, (int) ($filters['page'] ?? 1));
        $collection = collect($nodes)->values();
        $total = $collection->count();
        $perPage = 50;
        $slice = $collection->forPage($page, $perPage)->values()->all();

        return [
            'level' => 'subcategories',
            'category' => $category,
            'breadcrumb' => [['label' => $category === 'pln' ? 'PLN' : 'Tagihan', 'category' => $category]],
            'nodes' => $slice,
            'products' => [],
            'master_products' => [],
            'pagination' => [
                'currentPage' => $page,
                'lastPage' => (int) max(1, ceil(max(1, $total) / $perPage)),
                'perPage' => $perPage,
                'total' => $total,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    protected function listTopCategories(array $filters): array
    {
        $defs = [
            'pulsa' => 'Pulsa',
            'data' => 'Paket Data',
            'voucher-internet' => 'Voucher Internet',
            'pln' => 'PLN',
            'topup-digital' => 'Top Up Digital',
            'game' => 'Game',
            'voucher-digital' => 'Voucher Digital',
            'langganan-digital' => 'Langganan Digital',
            'tagihan' => 'Tagihan',
            'transfer' => 'Transfer',
        ];

        $search = strtolower(trim((string) ($filters['search'] ?? '')));
        $nodes = [];
        foreach ($defs as $slug => $label) {
            if ($search !== '' && ! str_contains(strtolower($label), $search) && ! str_contains($slug, $search)) {
                continue;
            }
            $count = $this->productsQuery(array_merge($filters, ['category' => $slug]))->count();
            $nodes[] = [
                'key' => $slug,
                'type' => 'category',
                'name' => $label,
                'skuCount' => $count,
                'providers' => $this->supplierNamesForCategory($slug, $filters),
            ];
        }

        return [
            'level' => 'categories',
            'category' => 'all',
            'breadcrumb' => [],
            'nodes' => $nodes,
            'products' => [],
            'master_products' => [],
            'pagination' => [
                'currentPage' => 1,
                'lastPage' => 1,
                'perPage' => count($nodes),
                'total' => count($nodes),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    protected function listBrands(array $filters, string $category): array
    {
        $slugs = LogicalProductKey::categoryFilterSlugs($category);
        $categoryIds = ProductCategory::query()->whereIn('slug', $slugs)->pluck('id');

        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = 50;
        $search = trim((string) ($filters['search'] ?? ''));

        $query = Provider::query()
            ->select([
                'providers.id',
                'providers.name',
                'providers.logo',
            ])
            ->selectRaw('COUNT(DISTINCT products.id) as sku_count')
            ->join('products', 'products.provider_id', '=', 'providers.id')
            ->whereNull('products.deleted_at')
            ->whereIn('products.product_category_id', $categoryIds)
            ->groupBy('providers.id', 'providers.name', 'providers.logo')
            ->orderBy('providers.name');

        $this->applyProductSideFilters($query, $filters);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('providers.name', 'like', "%{$search}%")
                    ->orWhere('products.name', 'like', "%{$search}%")
                    ->orWhere('products.sku_code', 'like', "%{$search}%");
            });
        }

        $total = (int) DB::query()
            ->fromSub(
                Provider::query()
                    ->select('providers.id')
                    ->join('products', 'products.provider_id', '=', 'providers.id')
                    ->whereNull('products.deleted_at')
                    ->whereIn('products.product_category_id', $categoryIds)
                    ->when(! empty($filters['product_provider_id']), function ($q) use ($filters) {
                        $q->where('products.product_provider_id', (int) $filters['product_provider_id']);
                    })
                    ->when(
                        array_key_exists('status', $filters) && $filters['status'] !== null && $filters['status'] !== '',
                        function ($q) use ($filters) {
                            $this->applyProductSideFilters($q, $filters);
                        }
                    )
                    ->when($search !== '', function ($q) use ($search) {
                        $q->where(function ($inner) use ($search) {
                            $inner->where('providers.name', 'like', "%{$search}%")
                                ->orWhere('products.name', 'like', "%{$search}%")
                                ->orWhere('products.sku_code', 'like', "%{$search}%");
                        });
                    })
                    ->groupBy('providers.id'),
                'brand_groups'
            )
            ->count();

        $rows = $query->forPage($page, $perPage)->get();

        $nodes = $rows->map(function ($row) use ($filters, $category) {
            $suppliers = $this->supplierNamesForBrand((int) $row->id, $category, $filters);

            return [
                'key' => (string) $row->id,
                'type' => 'brand',
                'id' => (int) $row->id,
                'brandId' => (int) $row->id,
                'name' => (string) $row->name,
                'logo' => $row->logo,
                'skuCount' => (int) $row->sku_count,
                'providers' => $suppliers,
                'providerLabel' => implode(' + ', $suppliers),
            ];
        })->values()->all();

        return [
            'level' => 'brands',
            'category' => $category,
            'breadcrumb' => [['label' => $this->categoryLabel($category), 'category' => $category]],
            'nodes' => $nodes,
            'products' => [],
            'master_products' => [],
            'pagination' => [
                'currentPage' => $page,
                'lastPage' => (int) max(1, ceil(max(1, $total) / $perPage)),
                'perPage' => $perPage,
                'total' => $total,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    protected function applyProductSideFilters($query, array $filters): void
    {
        $productProviderId = null;
        if (! empty($filters['product_provider_id'])) {
            $productProviderId = (int) $filters['product_provider_id'];
            $query->where('products.product_provider_id', $productProviderId);
        }

        if (array_key_exists('status', $filters) && $filters['status'] !== null && $filters['status'] !== '') {
            $status = strtolower(trim((string) $filters['status']));
            if ($status === 'maintenance') {
                $query->where(function ($q) {
                    $q->where('products.ops_status', 'maintenance')
                        ->orWhere('products.sku_code', 'like', '%MAINTENANCE%');
                });
            } elseif ($status === 'active') {
                $query->where('products.sku_code', 'not like', '%MAINTENANCE%')
                    ->where(function ($q) {
                        $q->where('products.ops_status', 'active')
                            ->orWhere(function ($legacy) {
                                $legacy->whereNull('products.ops_status')->where('products.status', true);
                            });
                    });
            } elseif ($status === 'inactive') {
                $query->where(function ($q) {
                    $q->where('products.ops_status', 'inactive')
                        ->orWhere(function ($legacy) {
                            $legacy->where(function ($ops) {
                                $ops->whereNull('products.ops_status')->orWhere('products.ops_status', 'active');
                            })->where('products.status', false)
                                ->where('products.sku_code', 'not like', '%MAINTENANCE%');
                        });
                });
            }
        }
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return \Illuminate\Database\Eloquent\Builder<\App\Models\Product>
     */
    protected function productsQuery(array $filters)
    {
        $query = Product::query()->whereNull('products.deleted_at');

        if (! empty($filters['category'])) {
            $slugs = LogicalProductKey::categoryFilterSlugs((string) $filters['category']);
            $query->whereHas('category', fn ($q) => $q->whereIn('slug', $slugs));
        }

        if (! empty($filters['provider_id'])) {
            $query->where('products.provider_id', (int) $filters['provider_id']);
        }

        if (! empty($filters['product_provider_id'])) {
            $query->where('products.product_provider_id', (int) $filters['product_provider_id']);
        }

        if (array_key_exists('status', $filters) && $filters['status'] !== null && $filters['status'] !== '') {
            // Reuse repository filter via a dummy query join alias
            $this->operations->applyProductStatusFilterPublic($query, $filters['status']);
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('products.name', 'like', "%{$search}%")
                    ->orWhere('products.sku_code', 'like', "%{$search}%")
                    ->orWhereHas('provider', fn ($pq) => $pq->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('productProvider', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%");
                    });
            });
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<string>
     */
    protected function supplierNamesForBrand(int $brandId, string $category, array $filters): array
    {
        $slugs = LogicalProductKey::categoryFilterSlugs($category);
        $q = DB::table('products')
            ->join('product_categories', 'product_categories.id', '=', 'products.product_category_id')
            ->join('product_providers', 'product_providers.id', '=', 'products.product_provider_id')
            ->whereNull('products.deleted_at')
            ->where('products.provider_id', $brandId)
            ->whereIn('product_categories.slug', $slugs);

        if (! empty($filters['product_provider_id'])) {
            $q->where('products.product_provider_id', (int) $filters['product_provider_id']);
        }

        return $q->distinct()
            ->orderBy('product_providers.name')
            ->pluck('product_providers.name')
            ->map(fn ($n) => (string) $n)
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<string>
     */
    protected function supplierNamesForCategory(string $category, array $filters): array
    {
        $slugs = LogicalProductKey::categoryFilterSlugs($category);
        $q = DB::table('products')
            ->join('product_categories', 'product_categories.id', '=', 'products.product_category_id')
            ->join('product_providers', 'product_providers.id', '=', 'products.product_provider_id')
            ->whereNull('products.deleted_at')
            ->whereIn('product_categories.slug', $slugs);

        if (! empty($filters['product_provider_id'])) {
            $q->where('products.product_provider_id', (int) $filters['product_provider_id']);
        }

        return $q->distinct()
            ->orderBy('product_providers.name')
            ->pluck('product_providers.name')
            ->map(fn ($n) => (string) $n)
            ->values()
            ->all();
    }

    /**
     * @return list<array{label:string,category?:string,brandId?:int,dataGroup?:string,nodeKey?:string}>
     */
    protected function breadcrumb(?string $category, ?int $brandId, ?string $dataGroup, ?string $nodeKey): array
    {
        $crumbs = [];
        if ($category && $category !== 'all') {
            $crumbs[] = ['label' => $this->categoryLabel($category), 'category' => $category];
        }
        if ($nodeKey) {
            $crumbs[] = [
                'label' => (string) (config('gurky_catalog.categories.'.$nodeKey.'.name') ?: $nodeKey),
                'category' => $category,
                'nodeKey' => $nodeKey,
            ];
        }
        if ($brandId) {
            $name = Provider::query()->where('id', $brandId)->value('name') ?: 'Brand';
            $crumbs[] = ['label' => (string) $name, 'category' => $category, 'brandId' => $brandId];
        }
        if ($dataGroup) {
            $crumbs[] = [
                'label' => $dataGroup,
                'category' => $category,
                'brandId' => $brandId,
                'dataGroup' => $dataGroup,
            ];
        }

        return $crumbs;
    }

    protected function categoryLabel(string $category): string
    {
        return match ($category) {
            'pulsa' => 'Pulsa',
            'data' => 'Paket Data',
            'voucher-internet' => 'Voucher Internet',
            'pln' => 'PLN',
            'topup-digital' => 'Top Up Digital',
            'game' => 'Game',
            'voucher-digital' => 'Voucher Digital',
            'langganan-digital' => 'Langganan Digital',
            'tagihan' => 'Tagihan',
            'transfer' => 'Transfer',
            default => (string) (config('gurky_catalog.categories.'.$category.'.name') ?: $category),
        };
    }

    protected function normalizeCategory(mixed $category): ?string
    {
        if ($category === null || $category === '' || strcasecmp((string) $category, 'All') === 0 || strcasecmp((string) $category, 'all') === 0) {
            return 'all';
        }

        return $this->mapping->canonicalizeSlug((string) $category);
    }

    /**
     * @return array{default_margin:float,category_margin:array,provider_margin:array}
     */
    protected function marginRules(): array
    {
        return [
            'default_margin' => (float) (Setting::where('key', 'default_margin')->value('value') ?? 1500),
            'category_margin' => json_decode(Setting::where('key', 'category_margins')->value('value') ?? '[]', true) ?: [],
            'provider_margin' => json_decode(Setting::where('key', 'provider_margins')->value('value') ?? '[]', true) ?: [],
        ];
    }
}
