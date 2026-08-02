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
}
