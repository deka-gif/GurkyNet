<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\ProductProviders\ProductCatalogCache;
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
        $cacheKey = ProductCatalogCache::searchKey($filters);
        $ttl = 60;

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
