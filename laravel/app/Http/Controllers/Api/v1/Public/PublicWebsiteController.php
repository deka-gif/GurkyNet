<?php

namespace App\Http\Controllers\Api\v1\Public;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Website\WebsiteSettingAction;
use App\Actions\Admin\Website\HomepageSectionAction;
use App\Actions\Admin\Website\WebsiteMenuAction;
use App\Actions\Admin\Website\StaticPageAction;
use App\Http\Resources\WebsiteSettingResource;
use App\Http\Resources\HomepageSectionResource;
use App\Http\Resources\WebsiteMenuResource;
use App\Http\Resources\StaticPageResource;
use App\Http\Resources\BannerResource;
use App\Models\BannerPromotion;
use App\Models\WebsiteSetting;
use Illuminate\Http\JsonResponse;

/**
 * PublicWebsiteController
 *
 * Serves read-only, unauthenticated endpoints that expose published website
 * content to the public frontend. Designed with high resilience and self-healing
 * capabilities: public endpoints will NEVER fail or return 404/500 if initial
 * database rows have not been configured yet.
 *
 * Routes (no auth middleware):
 *   GET /api/v1/public/settings
 *   GET /api/v1/public/menus
 *   GET /api/v1/public/static-pages
 *   GET /api/v1/public/homepage-sections
 *   GET /api/v1/public/banners
 */
class PublicWebsiteController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected WebsiteSettingAction  $settingAction,
        protected HomepageSectionAction $sectionAction,
        protected WebsiteMenuAction     $menuAction,
        protected StaticPageAction      $pageAction,
    ) {}

    /**
     * GET /api/v1/public/settings
     *
     * Returns the active website configuration record.
     * Guaranteed to always return a valid configuration object.
     */
    public function settings(): JsonResponse
    {
        $setting = $this->settingAction->getLatest();

        if (! $setting) {
            // Self-healing fallback: create canonical settings
            $setting = WebsiteSetting::firstOrCreate(
                ['id' => 1],
                [
                    'website_name' => 'GurkyNet',
                    'tagline' => 'Platform PPOB & Solusi Pembayaran Digital Tercepat di Indonesia',
                    'logo' => '/assets/logo.png',
                    'logo_dark' => '/assets/logo-dark.png',
                    'favicon' => '/favicon.ico',
                    'support_email' => 'support@gurkynet.com',
                    'support_phone' => '+62 812-3456-7890',
                    'whatsapp' => '6281234567890',
                    'office_address' => 'Jl. Gatot Subroto No. 88, Jakarta',
                    'google_maps_url' => 'https://maps.google.com/?q=Jakarta',
                    'facebook' => 'https://facebook.com/gurkynet',
                    'instagram' => 'https://instagram.com/gurkynet',
                    'tiktok' => 'https://tiktok.com/@gurkynet',
                    'youtube' => 'https://youtube.com/@gurkynet',
                    'twitter' => 'https://x.com/gurkynet',
                    'copyright' => '© 2026 PT Gurky Solusi Digital. Hak cipta dilindungi undang-undang.',
                    'maintenance_mode' => false,
                    'timezone' => 'Asia/Jakarta',
                    'currency' => 'IDR',
                    'language' => 'id',
                ]
            )->load(['logoMedia', 'logoDarkMedia', 'faviconMedia']);
        }

        return $this->successResponse(
            'Pengaturan website berhasil dimuat.',
            new WebsiteSettingResource($setting)
        );
    }

    /**
     * GET /api/v1/public/menus
     *
     * Returns all visible navigation menus with their children.
     */
    public function menus(): JsonResponse
    {
        $menus = $this->menuAction->listAll()
            ->filter(fn ($menu) => $menu->visible === true)
            ->values();

        return $this->successResponse(
            'Daftar menu website berhasil dimuat.',
            WebsiteMenuResource::collection($menus)
        );
    }

    /**
     * GET /api/v1/public/static-pages
     *
     * Returns all published static pages.
     */
    public function staticPages(): JsonResponse
    {
        $pages = $this->pageAction->listAll()
            ->filter(fn ($page) => $page->status === 'published')
            ->values();

        return $this->successResponse(
            'Daftar halaman statis berhasil dimuat.',
            StaticPageResource::collection($pages)
        );
    }

    /**
     * GET /api/v1/public/homepage-sections
     *
     * Returns all visible and active homepage sections.
     */
    public function homepageSections(): JsonResponse
    {
        $sections = $this->sectionAction->listAll()
            ->filter(fn ($section) => $section->visible === true && $section->status === 'active')
            ->sortBy('display_order')
            ->values();

        return $this->successResponse(
            'Daftar homepage section berhasil dimuat.',
            HomepageSectionResource::collection($sections)
        );
    }

    /**
     * GET /api/v1/public/banners
     *
     * Returns all active banners for the public website.
     */
    public function banners(): JsonResponse
    {
        $banners = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])
            ->where('type', 'banner')
            ->where('is_active', true)
            ->latest()
            ->get();

        if ($banners->isEmpty()) {
            // Seed a default promo banner if none exists
            $defaultBanner = BannerPromotion::firstOrCreate(
                ['title' => 'Flash Sale Spesial PPOB GurkyNet'],
                [
                    'type' => 'banner',
                    'description' => 'Dapatkan diskon potongan harga langsung hingga 50% untuk transaksi pulsa dan token listrik setiap hari!',
                    'code' => 'FLASHSALE',
                    'discount_amount' => 5000,
                    'discount_type' => 'fixed',
                    'image_url' => 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&q=80',
                    'redirect_url' => '/promo/flash-sale',
                    'is_active' => true,
                ]
            );
            $banners = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])
                ->where('type', 'banner')
                ->where('is_active', true)
                ->get();
        }

        return $this->successResponse(
            'Daftar banner berhasil dimuat.',
            BannerResource::collection($banners)
        );
    }
}
