<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SearchProductAction
{
    protected ProductRepositoryInterface $productRepository;

    public function __construct(ProductRepositoryInterface $productRepository)
    {
        $this->productRepository = $productRepository;
    }

    public function execute(array $filters = []): LengthAwarePaginator
    {
        $cacheKey = ProductCatalogCache::searchKey($filters);
        $ttl = 60;
        $loader = fn () => $this->productRepository->getPaginatedProducts($filters);

        try {
            try {
                return Cache::tags(['products', 'active_products'])->remember($cacheKey, $ttl, $loader);
            } catch (\BadMethodCallException) {
                return Cache::remember($cacheKey, $ttl, $loader);
            }
        } catch (\Throwable $e) {
            // Cache write/read must never break catalog GET (file driver permission/subdir issues).
            Log::warning('Catalog search cache unavailable — serving direct query', [
                'category' => $filters['category'] ?? null,
                'error' => $e->getMessage(),
            ]);

            return $loader();
        }
    }
}
