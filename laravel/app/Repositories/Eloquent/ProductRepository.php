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
use Illuminate\Support\Str;

class ProductRepository implements ProductRepositoryInterface
{
    public function getPaginatedProducts(array $filters = []): LengthAwarePaginator
    {
        $query = Product::query()->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider']);

        $this->applyCatalogAvailability($query);
        $this->applyListFilters($query, $filters);

        // Load enough rows to merge duplicates, then paginate in memory for stable grouping.
        $perPage = (int) ($filters['per_page'] ?? 15);
        $page = max(1, (int) ($filters['page'] ?? request()->input('page', 1)));

        $all = $query->orderBy('name')->orderBy('id')->get();
        $merged = $this->mergeDuplicateCatalogProducts($all);

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
        $product = Product::with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])->find($id);
        if (!$product || !$this->isCatalogVisible($product)) {
            return null;
        }

        return $this->resolveCanonicalCatalogProduct($product);
    }

    public function findBySku(string $skuCode): ?Product
    {
        $product = Product::with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])
            ->where('sku_code', $skuCode)
            ->first();

        if (!$product || !$this->isCatalogVisible($product)) {
            return null;
        }

        return $this->resolveCanonicalCatalogProduct($product);
    }

    public function getActiveProducts(): EloquentCollection
    {
        $query = Product::query()
            ->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])
            ->where('status', true);

        $this->applyCatalogAvailability($query);

        return new EloquentCollection(
            $this->mergeDuplicateCatalogProducts($query->orderBy('name')->orderBy('id')->get())->all()
        );
    }

    /**
     * Only products that have at least one active offer from an enabled Product Provider.
     * Legacy Digiflazz / unmapped products remain visible while Digiflazz is active.
     */
    protected function applyCatalogAvailability(Builder $query): void
    {
        $digiId = ProductProvider::digiflazz()?->id;
        $digiActive = (bool) ProductProvider::digiflazz()?->is_active;

        $query->where(function (Builder $outer) use ($digiId, $digiActive) {
            $outer->whereHas('providerSkus', function (Builder $q) {
                $q->where('is_active', true)
                    ->whereHas('productProvider', fn (Builder $pp) => $pp->where('is_active', true));
            });

            if ($digiActive) {
                $outer->orWhere(function (Builder $legacy) use ($digiId) {
                    $legacy->whereDoesntHave('providerSkus');
                    if ($digiId) {
                        $legacy->where(function (Builder $owner) use ($digiId) {
                            $owner->where('product_provider_id', $digiId)
                                ->orWhereNull('product_provider_id');
                        });
                    }
                });
            }
        });
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
     * One card per (category, operator brand, normalized product name).
     * Prefer product that has the highest-priority active offer (lowest priority number).
     *
     * @param  Collection<int, Product>|EloquentCollection<int, Product>  $products
     * @return Collection<int, Product>
     */
    protected function mergeDuplicateCatalogProducts(Collection|EloquentCollection $products): Collection
    {
        $groups = [];

        foreach ($products as $product) {
            if (!$this->isCatalogVisible($product)) {
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

        // Prefer non-VIP-prefixed internal SKU as the user-facing code
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

        if ($best === PHP_INT_MAX && ProductProviderSku::where('product_id', $product->id)->doesntExist()) {
            return (int) (ProductProvider::digiflazz()?->priority ?? 100);
        }

        return $best;
    }

    protected function isCatalogVisible(Product $product): bool
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

        // Legacy products without offer rows — visible while Digiflazz is active
        $digi = ProductProvider::digiflazz();
        if ($digi && $digi->is_active && $product->providerSkus->isEmpty()) {
            if ($product->product_provider_id === null || (int) $product->product_provider_id === (int) $digi->id) {
                return true;
            }
        }

        return false;
    }

    /**
     * If duplicates exist for the same group, return the canonical catalog card.
     */
    protected function resolveCanonicalCatalogProduct(Product $product): Product
    {
        $siblings = Product::query()
            ->with(['category', 'provider', 'productProvider', 'providerSkus.productProvider'])
            ->where('product_category_id', $product->product_category_id)
            ->where('provider_id', $product->provider_id)
            ->whereRaw('LOWER(TRIM(name)) = ?', [Str::lower(trim((string) $product->name))])
            ->get();

        $merged = $this->mergeDuplicateCatalogProducts($siblings);

        return $merged->first(fn (Product $p) => (int) $p->id === (int) $product->id)
            ?? $merged->first()
            ?? $product;
    }
}
