<?php

namespace App\Services;

use App\Models\BannerPromotion;
use App\Models\Notification;
use App\Models\ActivityLog;
use Illuminate\Support\Facades\Auth;

class MarketingService
{
    /**
     * Compute marketing campaign summary statistics.
     */
    public function getCampaignSummary(): array
    {
        $bannerCount = BannerPromotion::where('type', 'banner')->count();
        $promotionCount = BannerPromotion::where('type', 'promotion')->count();
        $voucherCount = BannerPromotion::where('type', 'voucher')->count();
        $announcementCount = Notification::where('type', 'announcement')->count();

        $activeBanners = BannerPromotion::where('type', 'banner')->where('is_active', true)->count();
        $activePromotions = BannerPromotion::where('type', 'promotion')->where('is_active', true)->count();
        $activeVouchers = BannerPromotion::where('type', 'voucher')->where('is_active', true)->count();
        $activeAnnouncements = Notification::where('type', 'announcement')->where('is_active', true)->count();

        $totalCampaigns = $bannerCount + $promotionCount + $voucherCount + $announcementCount;
        $activeCampaigns = $activeBanners + $activePromotions + $activeVouchers + $activeAnnouncements;

        return [
            'banner_count' => $bannerCount,
            'promotion_count' => $promotionCount,
            'voucher_count' => $voucherCount,
            'announcement_count' => $announcementCount,
            'total_campaigns' => $totalCampaigns,
            'active_campaigns' => $activeCampaigns,
        ];
    }

    /**
     * Compute overall campaign performance analytics.
     */
    public function getCampaignPerformance(): array
    {
        $totalVouchersRedeemed = (int) BannerPromotion::where('type', 'voucher')->sum('used_count');
        $totalQuotaAvailable = (int) BannerPromotion::where('type', 'voucher')->sum('quota');

        // Views/clicks are not tracked anywhere in the platform yet, so they are
        // reported as null instead of fabricated numbers. Redemption metrics and
        // the redemption rate are computed from real database values.
        $redemptionRate = $totalQuotaAvailable > 0
            ? round(($totalVouchersRedeemed / $totalQuotaAvailable) * 100, 2)
            : null;

        return [
            'total_views' => null,
            'total_clicks' => null,
            'ctr_percentage' => null,
            'total_vouchers_redeemed' => $totalVouchersRedeemed,
            'total_quota_available' => $totalQuotaAvailable,
            'conversion_rate' => $redemptionRate,
        ];
    }

    /**
     * Log marketing activity into ActivityLog.
     */
    public function logActivity(string $activity, array $payload = []): void
    {
        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'MARKETING_' . strtoupper($activity),
            'payload' => $payload,
        ]);
    }
}
