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
use App\Http\Resources\PromotionResource;
use App\Http\Resources\VoucherResource;
use App\Http\Resources\AnnouncementResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Models\BannerPromotion;
use App\Models\Faq;
use App\Models\HomepageFeaturedProduct;
use App\Models\Notification;
use App\Models\Provider;
use App\Models\WebsiteSetting;
use App\Actions\Product\GetCategoryAction;
use App\Actions\Product\SearchProductAction;
use App\Services\ProductProviders\LogicalProductKey;
use App\Services\DigiflazzService;
use App\Support\MediaUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public CMS + catalog companion endpoints for Website / Android / iOS / PWA.
 * All clients share the same Laravel API and database content.
 */
class PublicWebsiteController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected WebsiteSettingAction  $settingAction,
        protected HomepageSectionAction $sectionAction,
        protected WebsiteMenuAction     $menuAction,
        protected StaticPageAction      $pageAction,
        protected GetCategoryAction     $categoryAction,
        protected SearchProductAction   $searchProductAction,
    ) {}

    public function settings(): JsonResponse
    {
        try {
            $payload = \Illuminate\Support\Facades\Cache::remember('public:website:settings', 60, function () {
                try {
                    $setting = $this->settingAction->getLatest();
                } catch (\Throwable $e) {
                    report($e);
                    $setting = null;
                }

                if (! $setting) {
                    try {
                        $setting = WebsiteSetting::query()->latest('id')->first();
                    } catch (\Throwable $e) {
                        report($e);
                        $setting = null;
                    }
                }

                if (! $setting) {
                    return $this->defaultPublicSettingsPayload();
                }

                try {
                    return (new WebsiteSettingResource($setting))->resolve();
                } catch (\Throwable $e) {
                    report($e);
                    return $this->defaultPublicSettingsPayload($setting);
                }
            });

            if (! is_array($payload) || $payload === []) {
                $payload = $this->defaultPublicSettingsPayload();
            }

            return $this->successResponse('Pengaturan website berhasil dimuat.', $payload);
        } catch (\Throwable $e) {
            report($e);
            try {
                \Illuminate\Support\Facades\Cache::forget('public:website:settings');
            } catch (\Throwable) {
                // ignore cache flush failures
            }

            return $this->successResponse(
                'Pengaturan website berhasil dimuat.',
                $this->defaultPublicSettingsPayload()
            );
        }
    }

    /**
     * Safe public defaults — never 500 when CMS settings row/media is missing.
     */
    protected function defaultPublicSettingsPayload(?WebsiteSetting $setting = null): array
    {
        return [
            'id' => $setting?->id ?? 0,
            'websiteName' => $setting?->website_name ?: 'GurkyNet',
            'tagline' => $setting?->tagline ?: 'Platform PPOB & Solusi Pembayaran Digital Tercepat di Indonesia',
            'logo' => $setting?->logo ?: '/assets/logo.png',
            'logoDark' => $setting?->logo_dark ?: '/assets/logo-dark.png',
            'favicon' => $setting?->favicon ?: '/favicon.ico',
            'apkUrl' => null,
            'logoMediaId' => $setting?->logo_media_id,
            'logoDarkMediaId' => $setting?->logo_dark_media_id,
            'faviconMediaId' => $setting?->favicon_media_id,
            'supportEmail' => $setting?->support_email ?: 'support@gurkynet.com',
            'supportPhone' => $setting?->support_phone ?: '+62 812-3456-7890',
            'whatsapp' => $setting?->whatsapp ?: '6281234567890',
            'officeAddress' => $setting?->office_address,
            'googleMapsUrl' => $setting?->google_maps_url,
            'facebook' => $setting?->facebook,
            'instagram' => $setting?->instagram,
            'tiktok' => $setting?->tiktok,
            'youtube' => $setting?->youtube,
            'twitter' => $setting?->twitter,
            'copyright' => $setting?->copyright ?: '© 2026 PT Gurky Solusi Digital. Hak cipta dilindungi undang-undang.',
            'maintenanceMode' => (bool) ($setting?->maintenance_mode ?? false),
            'timezone' => $setting?->timezone ?: 'Asia/Jakarta',
            'currency' => $setting?->currency ?: 'IDR',
            'language' => $setting?->language ?: 'id',
            'createdAt' => optional($setting?->created_at)?->toIso8601String(),
            'lastUpdated' => optional($setting?->updated_at)?->toIso8601String(),
        ];
    }

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
     * GET /api/v1/public/static-pages/{slug}
     */
    public function staticPageBySlug(string $slug): JsonResponse
    {
        $page = $this->pageAction->findBySlug($slug);

        if (!$page || $page->status !== 'published') {
            return $this->errorResponse('Halaman tidak ditemukan.', 404);
        }

        return $this->successResponse(
            'Detail halaman berhasil dimuat.',
            new StaticPageResource($page)
        );
    }

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
     * Aggregated homepage payload for mobile/web bootstrap.
     * GET /api/v1/public/homepage
     */
    public function homepage(): JsonResponse
    {
        $settings = $this->settingAction->getLatest();
        $sections = $this->sectionAction->listAll()
            ->filter(fn ($section) => $section->visible === true && $section->status === 'active')
            ->sortBy('display_order')
            ->values();
        $banners = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])
            ->visibleInCarousel()
            ->orderedForDisplay()
            ->take(10)
            ->get();
        $heroSection = $sections->first(fn ($section) => strtolower((string) $section->component_type) === 'hero');
        $homepageCategories = $this->homepageCatalogBuckets();
        $featuredProducts = $this->featuredProducts();
        $faqs = Faq::orderBy('order')->get()->map(fn (Faq $faq) => [
            'id' => $faq->id,
            'question' => $faq->question,
            'answer' => $faq->answer,
            'order' => (int) $faq->order,
        ])->values();

        return $this->successResponse('Homepage berhasil dimuat.', [
            'settings' => $settings ? new WebsiteSettingResource($settings) : null,
            'sections' => HomepageSectionResource::collection($sections),
            'banners' => BannerResource::collection($banners),
            'hero' => $heroSection ? new HomepageSectionResource($heroSection) : null,
            'homepageCategories' => $homepageCategories,
            'featuredProducts' => ProductResource::collection($featuredProducts),
            'faqs' => $faqs,
        ]);
    }

    public function banners(): JsonResponse
    {
        $banners = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])
            ->visibleInCarousel()
            ->orderedForDisplay()
            ->get();

        return $this->successResponse(
            'Daftar banner berhasil dimuat.',
            BannerResource::collection($banners)
        );
    }

    /**
     * GET /api/v1/public/banners/{slug}
     * Promo detail for user dashboard (read-only).
     */
    public function bannerBySlug(string $slug): JsonResponse
    {
        $banner = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])
            ->banners()
            ->where('slug', $slug)
            ->first();

        if (! $banner) {
            return $this->errorResponse('Promo tidak ditemukan.', 404);
        }

        if (! $banner->is_active) {
            return $this->errorResponse('Promo tidak tersedia.', 404);
        }

        return $this->successResponse(
            'Detail promo berhasil dimuat.',
            new BannerResource($banner)
        );
    }

    /**
     * GET /api/v1/public/promotions
     */
    public function promotions(Request $request): JsonResponse
    {
        $items = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])
            ->where('type', 'promotion')
            ->where('is_active', true)
            ->latest()
            ->paginate((int) $request->query('per_page', 20));

        return $this->paginatedResponse(
            'Daftar promo berhasil dimuat.',
            PromotionResource::collection($items->items()),
            $items
        );
    }

    /**
     * GET /api/v1/public/vouchers
     */
    public function vouchers(Request $request): JsonResponse
    {
        $items = BannerPromotion::with(['imageMedia', 'mobileImageMedia'])
            ->where('type', 'voucher')
            ->where('is_active', true)
            ->latest()
            ->paginate((int) $request->query('per_page', 20));

        return $this->paginatedResponse(
            'Daftar voucher berhasil dimuat.',
            VoucherResource::collection($items->items()),
            $items
        );
    }

    /**
     * GET /api/v1/public/announcements
     */
    public function announcements(Request $request): JsonResponse
    {
        $items = Notification::with('coverMedia')
            ->whereIn('type', ['announcement', 'broadcast'])
            ->where('is_active', true)
            ->latest()
            ->paginate((int) $request->query('per_page', 20));

        return $this->paginatedResponse(
            'Daftar pengumuman berhasil dimuat.',
            AnnouncementResource::collection($items->items()),
            $items
        );
    }

    /**
     * News feed — active announcements + homepage news sections.
     * GET /api/v1/public/news
     */
    public function news(Request $request): JsonResponse
    {
        $announcements = Notification::with('coverMedia')
            ->whereIn('type', ['announcement', 'broadcast'])
            ->where('is_active', true)
            ->latest()
            ->take(50)
            ->get()
            ->map(function (Notification $item) {
                return [
                    'id' => 'announcement-' . $item->id,
                    'source' => 'announcement',
                    'title' => $item->title,
                    'body' => $item->message,
                    'cover_image' => MediaUrl::absolute(
                        $item->coverMedia?->getRawOriginal('url')
                    ),
                    'published_at' => optional($item->created_at)?->toIso8601String(),
                ];
            });

        $newsSections = $this->sectionAction->listAll()
            ->filter(function ($section) {
                $type = strtolower((string) ($section->component_type ?? ''));
                return $section->visible
                    && $section->status === 'active'
                    && in_array($type, ['news', 'berita', 'article'], true);
            })
            ->sortBy('display_order')
            ->values()
            ->map(function ($section) {
                $cover = optional($section->heroBackgroundMedia)->getRawOriginal('url')
                    ?? optional($section->heroIllustrationMedia)->getRawOriginal('url')
                    ?? optional($section->heroMobileImageMedia)->getRawOriginal('url')
                    ?? null;

                return [
                    'id' => 'section-' . $section->id,
                    'source' => 'homepage_section',
                    'title' => $section->title,
                    'body' => $section->description ?? '',
                    'cover_image' => MediaUrl::absolute($cover),
                    'published_at' => optional($section->updated_at)?->toIso8601String(),
                ];
            });

        $feed = $announcements->concat($newsSections)->values();

        return $this->successResponse('Feed berita berhasil dimuat.', $feed);
    }

    /**
     * GET /api/v1/public/faq
     */
    public function faq(): JsonResponse
    {
        $faqs = Faq::orderBy('order')->get()->map(fn (Faq $faq) => [
            'id' => $faq->id,
            'question' => $faq->question,
            'answer' => $faq->answer,
            'order' => (int) $faq->order,
        ]);

        return $this->successResponse('FAQ berhasil dimuat.', $faqs);
    }

    /**
     * Public provider health for mobile clients.
     * GET /api/v1/public/provider-status
     */
    public function providerStatus(DigiflazzService $digiflazzService): JsonResponse
    {
        $configured = $digiflazzService->isConfigured();
        $balance = null;
        if ($configured) {
            $balance = \Illuminate\Support\Facades\Cache::remember(
                'digiflazz_balance_public',
                60,
                fn () => $digiflazzService->checkBalance()
            );
        }

        $activeProviders = Provider::where('is_active', true)->count();
        $totalProviders = Provider::count();

        $status = 'offline';
        if ($configured && $balance !== null && $activeProviders > 0) {
            $status = 'online';
        } elseif ($configured && $activeProviders > 0) {
            $status = 'degraded';
        }

        return $this->successResponse('Status provider berhasil dimuat.', [
            'status' => $status,
            'digiflazz_configured' => $configured,
            'digiflazz_reachable' => $balance !== null,
            'active_providers' => $activeProviders,
            'total_providers' => $totalProviders,
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    protected function homepageCatalogBuckets(): array
    {
        $familyLabels = [
            'pulsa' => 'Pulsa',
            'data' => 'Paket Data',
            'topup-digital' => 'Top Up Digital',
            'game' => 'Game',
            'voucher-digital' => 'Voucher Digital',
            'langganan-digital' => 'Langganan Digital',
            'pln' => 'PLN',
            'international' => 'International',
            'tagihan' => 'Tagihan',
        ];

        $categories = collect($this->categoryAction->execute());

        return collect($familyLabels)->map(function (string $label, string $family) use ($categories) {
            $category = $categories->first(function ($item) use ($family) {
                $slug = (string) ($item->slug ?? '');

                return LogicalProductKey::normalizeCategoryFamily($slug) === $family;
            });

            $productPaginator = $this->searchProductAction->execute([
                'category' => $family,
                'per_page' => 8,
            ]);

            $items = collect($productPaginator->items())->values();
            $representative = $items->first();
            $icon = $category?->icon
                ?? match ($family) {
                    'pulsa' => 'smartphone',
                    'data' => 'wifi',
                    'topup-digital' => 'credit-card',
                    'voucher-digital' => 'gift',
                    'langganan-digital' => 'play-circle',
                    'international' => 'globe',
                    'pln' => 'zap',
                    'game' => 'play-circle',
                    'tagihan' => 'credit-card',
                    default => 'grid',
                };

            return [
                'key' => $family,
                'label' => $label,
                'category' => $category ? (new CategoryResource($category))->resolve() : null,
                'slug' => $category?->slug ?? $family,
                'icon' => $icon,
                'productCount' => $productPaginator->total(),
                'products' => ProductResource::collection($items)->resolve(),
                'previewProduct' => $representative ? (new ProductResource($representative))->resolve() : null,
            ];
        })->values()->all();
    }

    protected function featuredProducts()
    {
        $availability = resolve(\App\Services\AvailabilityService::class);

        return HomepageFeaturedProduct::query()
            ->with([
                'product.category',
                'product.provider',
                'product.productProvider',
                'product.providerSkus.productProvider',
            ])
            ->where('is_active', true)
            ->orderBy('display_order')
            ->get()
            ->pluck('product')
            ->filter(function ($product) use ($availability) {
                if (!$product) {
                    return false;
                }

                // Mirror User Dashboard: hide ops inactive; keep Active + Maintenance.
                if (! $availability->isCatalogVisible($product)) {
                    return false;
                }

                // Control Center gate — at least one active SKU on an enabled Product Provider.
                $product->loadMissing('providerSkus.productProvider');
                foreach ($product->providerSkus as $sku) {
                    if ($sku->is_active && $sku->productProvider && $sku->productProvider->is_active) {
                        return true;
                    }
                }

                return false;
            })
            ->values();
    }
}
