<?php

namespace App\Repositories\Contracts;

use App\Models\Product;
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
     * Active product providers (Digiflazz, VIP brand, …) for catalog filters.
     */
    public function getProductProviders(): \Illuminate\Support\Collection;

    /**
     * Update product details (sell price, margin, status, admin notes).
     */
    public function updateProduct(string|int $id, array $data): Product;

    /**
     * Get paginated integration partners (Digiflazz / VIP / Midtrans) with filters.
     */
    public function getProviders(array $filters): LengthAwarePaginator;

    /**
     * Update partner status / notes (product provider or payment gateway).
     *
     * @return array<string, mixed>
     */
    public function updateProvider(string|int $id, array $data): array;

    /**
     * Probe live health for all partners and return refreshed list metadata.
     *
     * @return array<int, mixed>
     */
    public function refreshProviderStatuses(): array;

    /**
     * Get service monitoring data for Operations dashboard.
     */
    public function getMonitoring(array $filters = []): array;

    /**
     * Get pricing margin rules configuration.
     */
    public function getPricing(array $filters = []): array;

    /**
     * Update pricing margin rules configuration.
     */
    public function updatePricing(array $data): array;

    /**
     * Digiflazz catalog sync status metadata.
     */
    public function getDigiflazzSyncStatus(): array;
}
