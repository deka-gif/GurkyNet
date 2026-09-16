<?php

namespace App\Services\Website;

use App\Actions\Admin\Website\HomepageSectionAction;
use App\Actions\Admin\Website\StaticPageAction;
use App\Actions\Admin\Website\WebsiteMenuAction;
use App\Actions\Admin\Website\WebsiteSettingAction;
use App\Actions\Product\GetCategoryAction;
use App\Actions\Product\SearchProductAction;
use App\Http\Resources\BannerResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\HomepageSectionResource;
use App\Http\Resources\ProductListResource;
use App\Http\Resources\StaticPageResource;
use App\Http\Resources\WebsiteMenuResource;
use App\Http\Resources\WebsiteSettingResource;
use App\Models\BannerPromotion;
use App\Models\Faq;
use App\Models\HomepageFeaturedProduct;
use App\Services\ProductProviders\LogicalProductKey;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Builds + warms the public homepage aggregate cache (Paket Q / Masalah 1).
 * Shared by GET /public/homepage and website:warm-public-homepage.
 */
class PublicHomepagePayloadBuilder
{
    public function __construct(
        protected WebsiteSettingAction $settingAction,
        protected HomepageSectionAction $sectionAction,
        protected WebsiteMenuAction $menuAction,
        protected StaticPageAction $pageAction,
        protected GetCategoryAction $categoryAction,
        protected SearchProductAction $searchProductAction,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(): array
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

        $menus = $this->menuAction->listAll()
            ->filter(fn ($menu) => (bool) $menu->visible)
            ->sortBy('display_order')
            ->values();

        $pages = $this->pageAction->listAll()
            ->filter(fn ($page) => ($page->status ?? '') === 'published')
            ->values();

        $seoSection = $sections->first(fn ($section) => strtolower((string) $section->component_type) === 'seo');

        return [
            'settings' => $settings ? (new WebsiteSettingResource($settings))->resolve() : null,
            'sections' => HomepageSectionResource::collection($sections)->resolve(),
            'banners' => BannerResource::collection($banners)->resolve(),
            'hero' => $heroSection ? (new HomepageSectionResource($heroSection))->resolve() : null,
            'homepageCategories' => $homepageCategories,
            'featuredProducts' => ProductListResource::collection($featuredProducts)->resolve(),
            'faqs' => $faqs->all(),
            'menus' => WebsiteMenuResource::collection($menus)->resolve(),
            'pages' => StaticPageResource::collection($pages)->resolve(),
            'seo' => [
                'title' => $seoSection?->title
                    ?? $settings?->seo_title
                    ?? $settings?->website_name,
                'description' => $seoSection?->description
                    ?? $settings?->seo_description
                    ?? $settings?->tagline,
                'keywords' => $settings?->seo_keywords,
            ],
            'cachedForSeconds' => PublicHomepageCache::TTL_SECONDS,
        ];
    }

    /**
     * Force-rebuild PublicHomepageCache and log duration (Paket Q — 1a).
     *
     * @return array{payload: array<string, mixed>, duration_ms: float}
     */
    public function warm(): array
    {
        $started = microtime(true);
        Cache::forget(PublicHomepageCache::KEY);
        $payload = PublicHomepageCache::remember(fn () => $this->build());
        $durationMs = round((microtime(true) - $started) * 1000, 1);

        Log::info('Public homepage cache warmed', [
            'duration_ms' => $durationMs,
            'ttl_seconds' => PublicHomepageCache::TTL_SECONDS,
            'cache_key' => PublicHomepageCache::KEY,
        ]);

        return [
            'payload' => $payload,
            'duration_ms' => $durationMs,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
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
                'products' => ProductListResource::collection($items)->resolve(),
                'previewProduct' => $representative ? (new ProductListResource($representative))->resolve() : null,
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
                if (! $product) {
                    return false;
                }

                if (! $availability->isCatalogVisible($product)) {
                    return false;
                }

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
