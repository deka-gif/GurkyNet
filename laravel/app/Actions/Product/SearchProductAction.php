<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\ProductRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;

class SearchProductAction
{
    protected ProductRepositoryInterface $productRepository;

    public function __construct(ProductRepositoryInterface $productRepository)
    {
        $this->productRepository = $productRepository;
    }

    public function execute(array $filters = []): LengthAwarePaginator
    {
        // For search with filters, caching the entire result can be complex or create high-cardinality keys.
        // But we can cache the query based on serialized filters for a short duration,
        // or just use the repository optimized query directly.
        // Let's cache the specific active products filter queries or just general searches.
        $cacheKey = 'products_search_' . md5(serialize($filters));
        $ttl = 600; // 10 minutes

        try {
            return Cache::tags(['products', 'active_products'])->remember($cacheKey, $ttl, function () use ($filters) {
                return $this->productRepository->getPaginatedProducts($filters);
            });
        } catch (\BadMethodCallException $e) {
            return Cache::remember($cacheKey, $ttl, function () use ($filters) {
                return $this->productRepository->getPaginatedProducts($filters);
            });
        }
    }
}
