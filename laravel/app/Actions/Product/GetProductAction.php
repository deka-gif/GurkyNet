<?php

namespace App\Actions\Product;

use App\Models\Product;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Support\Facades\Cache;

class GetProductAction
{
    protected ProductRepositoryInterface $productRepository;

    public function __construct(ProductRepositoryInterface $productRepository)
    {
        $this->productRepository = $productRepository;
    }

    public function execute(int $id): ?Product
    {
        return $this->productRepository->findById($id);
    }

    public function executeBySku(string $skuCode): ?Product
    {
        return $this->productRepository->findBySku($skuCode);
    }

    public function getActiveProducts(): \Illuminate\Database\Eloquent\Collection
    {
        $cacheKey = ProductCatalogCache::activeAllKey();
        $ttl = 60;

        try {
            return Cache::tags(['products', 'active_products'])->remember($cacheKey, $ttl, function () {
                return $this->productRepository->getActiveProducts();
            });
        } catch (\BadMethodCallException $e) {
            return Cache::remember($cacheKey, $ttl, function () {
                return $this->productRepository->getActiveProducts();
            });
        }
    }
}
