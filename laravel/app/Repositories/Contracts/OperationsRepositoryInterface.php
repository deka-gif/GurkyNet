<?php

namespace App\Repositories\Contracts;

use App\Models\Product;
use App\Models\Provider;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface OperationsRepositoryInterface
{
    /**
     * Get dashboard operational metrics and health overview.
     */
    public function getDashboardMetrics(): array;

    /**
     * Get paginated products list with filters.
     */
    public function getProducts(array $filters): LengthAwarePaginator;

    /**
     * Update product details (sell price, margin, status, admin notes).
     */
    public function updateProduct(string|int $id, array $data): Product;

    /**
     * Get paginated providers list with filters.
     */
    public function getProviders(array $filters): LengthAwarePaginator;

    /**
     * Update provider details (status, maintenance flag, notes).
     */
    public function updateProvider(string|int $id, array $data): Provider;

    /**
     * Get pricing margin rules configuration.
     */
    public function getPricing(): array;

    /**
     * Update pricing margin rules configuration.
     */
    public function updatePricing(array $data): array;
}
