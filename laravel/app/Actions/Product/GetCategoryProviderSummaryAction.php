<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\Catalog\ProductPurchaseLifecycleService;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GetCategoryProviderSummaryAction
{
    public function __construct(
        protected ProductRepositoryInterface $productRepository,
        protected ProductPurchaseLifecycleService $lifecycle,
    ) {}

    /**
     * Customer-facing brand/provider summary for a category.
     *
     * Only counts products that are PURCHASABLE (schema + capability + availability).
     * Brands with zero purchasable SKUs are omitted — avoids empty Game → Brand pages.
     *
     * @return list<array{providerId: int, name: string, logo: ?string, count: int}>
     */
    public function execute(string $category): array
    {
        $cacheKey = ProductCatalogCache::providerSummaryKey($category);
        $ttl = 60;
        $loader = function () use ($category) {
            $products = $this->productRepository->getActiveProductsForCategory($category);

            $groups = [];
            foreach ($products as $product) {
                // Customer purchase grid: only PURCHASABLE SKUs contribute to brand visibility.
                $life = $this->lifecycle->evaluate($product);
                if (! ($life['purchasable'] ?? false) || ! ($life['catalog_visible'] ?? false)) {
                    continue;
                }

                $name = trim((string) ($product->provider?->name ?? 'Lainnya'));
                if ($name === '') {
                    $name = 'Lainnya';
                }
                $key = Str::lower($name);
                if (! isset($groups[$key])) {
                    $groups[$key] = [
                        'providerId' => (int) $product->provider_id,
                        'name' => $name,
                        'logo' => $product->provider?->logo,
                        'count' => 1,
                    ];
                } else {
                    $groups[$key]['count']++;
                }
            }

            $out = array_values($groups);
            usort($out, fn (array $a, array $b) => strcoll($a['name'], $b['name']));

            return $out;
        };

        try {
            try {
                return Cache::tags(['products', 'active_products'])->remember($cacheKey, $ttl, $loader);
            } catch (\BadMethodCallException) {
                return Cache::remember($cacheKey, $ttl, $loader);
            }
        } catch (\Throwable $e) {
            Log::warning('Category provider summary cache unavailable — serving direct query', [
                'category' => $category,
                'error' => $e->getMessage(),
            ]);

            return $loader();
        }
    }
}
