<?php

namespace App\Repositories\Contracts;

use App\Models\Product;
use Illuminate\Pagination\LengthAwarePaginator;

interface ProductRepositoryInterface
{
    public function getPaginatedProducts(array $filters = []): LengthAwarePaginator;
    public function findById(int $id): ?Product;
    public function findBySku(string $skuCode): ?Product;
    public function getActiveProducts(): \Illuminate\Database\Eloquent\Collection;

    /**
     * @param  array<string, mixed>  $filters  Optional list filters (e.g. vi_mode for voucher-internet Digi category split).
     */
    public function getActiveProductsForCategory(string $category, array $filters = []): \Illuminate\Database\Eloquent\Collection;
}
