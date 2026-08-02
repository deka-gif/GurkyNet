<?php

namespace App\Repositories\Contracts;

use App\Models\BannerPromotion;
use App\Models\Notification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface MarketingRepositoryInterface
{
    /**
     * Get marketing dashboard metrics.
     */
    public function getDashboardMetrics(): array;

    /**
     * Get paginated banners with search and status filters.
     */
    public function getBanners(array $filters): LengthAwarePaginator;

    /**
     * Create banner.
     */
    public function createBanner(array $data): BannerPromotion;

    /**
     * Update banner.
     */
    public function updateBanner(string|int $id, array $data): BannerPromotion;

    /**
     * Soft delete banner.
     */
    public function deleteBanner(string|int $id): bool;

    /**
     * Get paginated promotions with search and status filters.
     */
    public function getPromotions(array $filters): LengthAwarePaginator;

    /**
     * Create promotion.
     */
    public function createPromotion(array $data): BannerPromotion;

    /**
     * Update promotion.
     */
    public function updatePromotion(string|int $id, array $data): BannerPromotion;

    /**
     * Soft delete promotion.
     */
    public function deletePromotion(string|int $id): bool;

    /**
     * Get paginated vouchers with search and status filters.
     */
    public function getVouchers(array $filters): LengthAwarePaginator;

    /**
     * Create voucher.
     */
    public function createVoucher(array $data): BannerPromotion;

    /**
     * Update voucher.
     */
    public function updateVoucher(string|int $id, array $data): BannerPromotion;

    /**
     * Soft delete voucher.
     */
    public function deleteVoucher(string|int $id): bool;

    /**
     * Get paginated announcements with search and status filters.
     */
    public function getAnnouncements(array $filters): LengthAwarePaginator;

    /**
     * Create announcement.
     */
    public function createAnnouncement(array $data): Notification;

    /**
     * Update announcement.
     */
    public function updateAnnouncement(string|int $id, array $data): Notification;

    /**
     * Soft delete announcement.
     */
    public function deleteAnnouncement(string|int $id): bool;
}
