<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\MarketingRepositoryInterface;
use App\Models\BannerPromotion;
use App\Models\Notification;
use App\Models\ActivityLog;
use App\Services\MarketingService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class MarketingRepository implements MarketingRepositoryInterface
{
    public function __construct(
        protected MarketingService $marketingService
    ) {}

    /**
     * Get marketing dashboard metrics.
     */
    public function getDashboardMetrics(): array
    {
        $summary = $this->marketingService->getCampaignSummary();
        $performance = $this->marketingService->getCampaignPerformance();

        $recentActivities = ActivityLog::with('user:id,name,email')
            ->where('activity', 'like', '%MARKETING%')
            ->orWhere('activity', 'like', '%BANNER%')
            ->orWhere('activity', 'like', '%PROMOTION%')
            ->orWhere('activity', 'like', '%VOUCHER%')
            ->orWhere('activity', 'like', '%ANNOUNCEMENT%')
            ->latest()
            ->take(10)
            ->get();

        return [
            'campaign_summary' => $summary,
            'campaign_performance' => $performance,
            'recent_marketing_activities' => $recentActivities,
        ];
    }

    /**
     * Get paginated banners with search and status filters.
     */
    public function getBanners(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])->where('type', 'banner');

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if (isset($filters['status'])) {
            $this->applyBannerScheduleFilter($query, $filters['status']);
        }

        return $query->orderedForDisplay()->paginate($perPage);
    }

    /**
     * Create banner.
     */
    public function createBanner(array $data): BannerPromotion
    {
        $data = $this->normalizeBannerPayload($data);
        $data['type'] = 'banner';
        $data['is_active'] = filter_var($data['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);

        if (empty($data['slug']) && ! empty($data['title'])) {
            $data['slug'] = BannerPromotion::makeUniqueSlug($data['title']);
        }

        $banner = BannerPromotion::create($data);
        $banner->load(['imageMedia', 'mobileImageMedia']);

        $this->marketingService->logActivity('CREATE_BANNER', [
            'banner_id' => $banner->id,
            'title' => $banner->title,
            'slug' => $banner->slug,
        ]);

        return $banner;
    }

    /**
     * Update banner.
     */
    public function updateBanner(string|int $id, array $data): BannerPromotion
    {
        $banner = BannerPromotion::where('type', 'banner')->findOrFail($id);
        $data = $this->normalizeBannerPayload($data);

        if (isset($data['is_active'])) {
            $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }

        if (array_key_exists('slug', $data) && filled($data['slug'])) {
            $data['slug'] = BannerPromotion::makeUniqueSlug((string) $data['slug'], $banner->id);
        } elseif (! empty($data['title']) && blank($banner->slug)) {
            $data['slug'] = BannerPromotion::makeUniqueSlug($data['title'], $banner->id);
        }

        $banner->update($data);

        $this->marketingService->logActivity('UPDATE_BANNER', [
            'banner_id' => $banner->id,
            'title' => $banner->title,
            'updated_fields' => array_keys($data),
        ]);

        return $banner->fresh(['imageMedia', 'mobileImageMedia']);
    }

    /**
     * Soft delete banner.
     */
    public function deleteBanner(string|int $id): bool
    {
        $banner = BannerPromotion::where('type', 'banner')->findOrFail($id);
        $title = $banner->title;
        $bannerId = $banner->id;

        $deleted = $banner->delete();

        if ($deleted) {
            $this->marketingService->logActivity('DELETE_BANNER', [
                'banner_id' => $bannerId,
                'title' => $title,
            ]);
        }

        return (bool) $deleted;
    }

    /**
     * Get paginated promotions with search and status filters.
     */
    public function getPromotions(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])->where('type', 'promotion');

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if (isset($filters['status'])) {
            $this->applyStatusFilter($query, $filters['status']);
        }

        return $query->latest()->paginate($perPage);
    }

    /**
     * Create promotion.
     */
    public function createPromotion(array $data): BannerPromotion
    {
        $data['type'] = 'promotion';
        $data['is_active'] = filter_var($data['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);

        $promotion = BannerPromotion::create($data);

        $this->marketingService->logActivity('CREATE_PROMOTION', [
            'promotion_id' => $promotion->id,
            'title' => $promotion->title,
        ]);

        return $promotion;
    }

    /**
     * Update promotion.
     */
    public function updatePromotion(string|int $id, array $data): BannerPromotion
    {
        $promotion = BannerPromotion::where('type', 'promotion')->findOrFail($id);

        if (isset($data['is_active'])) {
            $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }

        $promotion->update($data);

        $this->marketingService->logActivity('UPDATE_PROMOTION', [
            'promotion_id' => $promotion->id,
            'title' => $promotion->title,
            'updated_fields' => array_keys($data),
        ]);

        return $promotion->fresh();
    }

    /**
     * Soft delete promotion.
     */
    public function deletePromotion(string|int $id): bool
    {
        $promotion = BannerPromotion::where('type', 'promotion')->findOrFail($id);
        $title = $promotion->title;
        $promotionId = $promotion->id;

        $deleted = $promotion->delete();

        if ($deleted) {
            $this->marketingService->logActivity('DELETE_PROMOTION', [
                'promotion_id' => $promotionId,
                'title' => $title,
            ]);
        }

        return (bool) $deleted;
    }

    /**
     * Get paginated vouchers with search and status filters.
     */
    public function getVouchers(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])->where('type', 'voucher');

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if (isset($filters['status'])) {
            $this->applyStatusFilter($query, $filters['status']);
        }

        return $query->latest()->paginate($perPage);
    }

    /**
     * Create voucher.
     */
    public function createVoucher(array $data): BannerPromotion
    {
        $data['type'] = 'voucher';
        $data['is_active'] = filter_var($data['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);

        $voucher = BannerPromotion::create($data);

        $this->marketingService->logActivity('CREATE_VOUCHER', [
            'voucher_id' => $voucher->id,
            'code' => $voucher->code,
            'title' => $voucher->title,
        ]);

        return $voucher;
    }

    /**
     * Update voucher.
     */
    public function updateVoucher(string|int $id, array $data): BannerPromotion
    {
        $voucher = BannerPromotion::where('type', 'voucher')->findOrFail($id);

        if (isset($data['is_active'])) {
            $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }

        $voucher->update($data);

        $this->marketingService->logActivity('UPDATE_VOUCHER', [
            'voucher_id' => $voucher->id,
            'code' => $voucher->code,
            'title' => $voucher->title,
            'updated_fields' => array_keys($data),
        ]);

        return $voucher->fresh();
    }

    /**
     * Soft delete voucher.
     */
    public function deleteVoucher(string|int $id): bool
    {
        $voucher = BannerPromotion::where('type', 'voucher')->findOrFail($id);
        $title = $voucher->title;
        $voucherId = $voucher->id;

        $deleted = $voucher->delete();

        if ($deleted) {
            $this->marketingService->logActivity('DELETE_VOUCHER', [
                'voucher_id' => $voucherId,
                'title' => $title,
            ]);
        }

        return (bool) $deleted;
    }

    /**
     * Get paginated announcements with search and status filters.
     */
    public function getAnnouncements(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = Notification::with('coverMedia')->whereIn('type', ['announcement', 'broadcast']);

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('message', 'like', "%{$search}%");
            });
        }

        if (isset($filters['status'])) {
            $this->applyStatusFilter($query, $filters['status']);
        }

        return $query->latest()->paginate($perPage);
    }

    /**
     * Create announcement.
     */
    public function createAnnouncement(array $data): Notification
    {
        $data['type'] = $data['type'] ?? 'announcement';
        $data['is_active'] = filter_var($data['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN);

        $announcement = Notification::create($data);

        $this->marketingService->logActivity('CREATE_ANNOUNCEMENT', [
            'announcement_id' => $announcement->id,
            'title' => $announcement->title,
        ]);

        return $announcement;
    }

    /**
     * Update announcement.
     */
    public function updateAnnouncement(string|int $id, array $data): Notification
    {
        $announcement = Notification::whereIn('type', ['announcement', 'broadcast'])->findOrFail($id);

        if (isset($data['is_active'])) {
            $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }

        $announcement->update($data);

        $this->marketingService->logActivity('UPDATE_ANNOUNCEMENT', [
            'announcement_id' => $announcement->id,
            'title' => $announcement->title,
            'updated_fields' => array_keys($data),
        ]);

        return $announcement->fresh();
    }

    /**
     * Soft delete announcement.
     */
    public function deleteAnnouncement(string|int $id): bool
    {
        $announcement = Notification::whereIn('type', ['announcement', 'broadcast'])->findOrFail($id);
        $title = $announcement->title;
        $announcementId = $announcement->id;

        $deleted = $announcement->delete();

        if ($deleted) {
            $this->marketingService->logActivity('DELETE_ANNOUNCEMENT', [
                'announcement_id' => $announcementId,
                'title' => $title,
            ]);
        }

        return (bool) $deleted;
    }

    /**
     * Helper to apply status filter (active / inactive).
     */
    protected function applyStatusFilter($query, mixed $status): void
    {
        if ($status === 'active' || $status === '1' || $status === true || $status === 1) {
            $query->where('is_active', true);
        } elseif ($status === 'inactive' || $status === '0' || $status === false || $status === 0) {
            $query->where('is_active', false);
        }
    }

    /**
     * Banner CMS schedule filters (Active / Scheduled / Expired / Hidden).
     */
    protected function applyBannerScheduleFilter($query, mixed $status): void
    {
        $status = strtolower((string) $status);
        $now = now();

        if (in_array($status, ['active', '1', 'true'], true)) {
            $query->where('is_active', true)
                ->where(function ($q) use ($now) {
                    $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
                })
                ->where(function ($q) use ($now) {
                    $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
                });

            return;
        }

        if (in_array($status, ['scheduled', 'upcoming', 'akan datang'], true)) {
            $query->where('is_active', true)->whereNotNull('starts_at')->where('starts_at', '>', $now);

            return;
        }

        if (in_array($status, ['expired', 'berakhir'], true)) {
            $query->whereNotNull('ends_at')->where('ends_at', '<', $now);

            return;
        }

        if (in_array($status, ['hidden', 'inactive', 'draft', '0', 'false'], true)) {
            $query->where('is_active', false);

            return;
        }

        $this->applyStatusFilter($query, $status);
    }

    /**
     * Keep only fillable banner fields; drop UI-only keys.
     */
    protected function normalizeBannerPayload(array $data): array
    {
        unset(
            $data['position'],
            $data['tagline'],
            $data['name'],
            $data['link_url'],
            $data['clickUrl'],
            $data['cta_url'],
            $data['ctaUrl'],
            $data['start_date'],
            $data['end_date'],
            $data['promo_code'],
            $data['promoCode'],
            $data['ctaLabel'],
            $data['sortOrder'],
            $data['terms_and_conditions'],
            $data['mobile_image_url'],
            $data['image'],
            $data['mobileImage'],
        );

        return $data;
    }
}
