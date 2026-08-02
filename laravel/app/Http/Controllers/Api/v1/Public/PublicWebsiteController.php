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
use Illuminate\Http\JsonResponse;
use App\Models\BannerPromotion;
use App\Http\Resources\BannerResource;

/**
 * PublicWebsiteController
 *
 * Serves read-only, unauthenticated endpoints that expose published website
 * content to the public frontend. All data is sourced through the same Action
 * → Repository → Model pipeline used by the admin CMS, ensuring a single
 * source of truth. Only publicly appropriate records are returned (visible,
 * published, active).
 *
 * Routes (no auth middleware):
 *   GET /api/v1/public/settings
 *   GET /api/v1/public/menus
 *   GET /api/v1/public/static-pages
 *   GET /api/v1/public/homepage-sections
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
     * Returns the single active website configuration record. The CMS is
     * designed to hold one canonical settings row (latest by id). Returns
     * 404 if the record has not been seeded yet.
     */
    public function settings(): JsonResponse
    {
        $setting = $this->settingAction->getLatest();

        if (! $setting) {
            return $this->errorResponse('Pengaturan website belum dikonfigurasi.', 404);
        }

        return $this->successResponse(
            'Pengaturan website berhasil dimuat.',
            new WebsiteSettingResource($setting)
        );
    }

    /**
     * GET /api/v1/public/menus
     *
     * Returns all visible top-level navigation menus with their children,
     * ordered by display_order ascending. Invisible menus are excluded so the
     * frontend always receives a clean, renderable navigation tree.
     */
    public function menus(): JsonResponse
    {
        // all() fetches top-level menus with eager-loaded children.
        // We filter to visible only before serializing.
        $menus = $this->menuAction->listAll()->filter(fn ($menu) => $menu->visible === true)->values();

        return $this->successResponse(
            'Daftar menu website berhasil dimuat.',
            WebsiteMenuResource::collection($menus)
        );
    }

    /**
     * GET /api/v1/public/static-pages
     *
     * Returns all published static pages. Draft and unlisted pages are
     * excluded — public visitors must not see unpublished content.
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
     * Returns all visible and active homepage sections, ordered by
     * display_order ascending. Sections that are hidden or inactive are
     * excluded so the frontend only renders fully configured sections.
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

        return $this->successResponse(
            'Daftar banner berhasil dimuat.',
            BannerResource::collection($banners)
        );
    }
}
