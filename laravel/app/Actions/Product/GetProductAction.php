<?php

namespace App\Actions\Product;

use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Models\Product;

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
        $cacheKey = 'products_active_all';
        $ttl = 3600; // 1 hour

        try {
            return \Illuminate\Support\Facades\Cache::tags(['products', 'active_products'])->remember($cacheKey, $ttl, function () {
                return $this->productRepository->getActiveProducts();
            });
        } catch (\BadMethodCallException $e) {
            return \Illuminate\Support\Facades\Cache::remember($cacheKey, $ttl, function () {
                return $this->productRepository->getActiveProducts();
            });
        }
    }
}
