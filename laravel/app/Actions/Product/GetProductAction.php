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
        $product = $this->productRepository->findBySku($skuCode);
        if (! $product) {
            return null;
        }

        // Customer-facing product detail: same PURCHASABLE SoT as GET /products (no dead-end).
        $life = app(\App\Services\Catalog\ProductPurchaseLifecycleService::class)->evaluate($product);
        if (! ($life['purchasable'] ?? false)
            || ! ($life['catalog_visible'] ?? false)
            || ($life['stage'] ?? null) !== \App\Services\Catalog\ProductPurchaseLifecycleService::STAGE_PURCHASABLE
        ) {
            return null;
        }

        return $product;
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
