<?php

namespace App\Services\Website;

use App\Actions\Admin\Website\HomepageSectionAction;
use App\Actions\Admin\Website\StaticPageAction;
use App\Actions\Admin\Website\WebsiteMenuAction;
use App\Actions\Admin\Website\WebsiteSettingAction;
use App\Actions\Product\GetCategoryAction;
use App\Http\Resources\BannerResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\HomepageSectionResource;
use App\Http\Resources\ProductListResource;
use App\Http\Resources\WebsiteMenuResource;
use App\Http\Resources\WebsiteSettingResource;
use App\Models\BannerPromotion;
use App\Models\Faq;
use App\Models\HomepageFeaturedProduct;
use App\Models\Product;
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

        // Landing bootstrap only needs page titles/slugs (footer + legal links).
        // Full HTML body is loaded later via /page/:slug — including it here bloated cold JSON.
        $pagesLite = $pages->map(fn ($page) => [
            'id' => $page->id,
            'title' => $page->title,
            'slug' => $page->slug,
            'status' => $page->status ?? 'published',
            'seoTitle' => $page->seo_title,
            'seoDescription' => $page->seo_description,
            'publishedAt' => optional($page->published_at)?->toIso8601String(),
            'createdAt' => optional($page->created_at)?->toIso8601String(),
            'lastUpdated' => optional($page->updated_at)?->toIso8601String(),
        ])->values()->all();

        return [
            'settings' => $settings ? (new WebsiteSettingResource($settings))->resolve() : null,
            'sections' => HomepageSectionResource::collection($sections)->resolve(),
            'banners' => BannerResource::collection($banners)->resolve(),
            'hero' => $heroSection ? (new HomepageSectionResource($heroSection))->resolve() : null,
            'homepageCategories' => $homepageCategories,
            'featuredProducts' => ProductListResource::collection($featuredProducts)->resolve(),
            'faqs' => $faqs->all(),
            'menus' => WebsiteMenuResource::collection($menus)->resolve(),
            'pages' => $pagesLite,
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
        // Rebuild fresh payload and publish both live + stale keys.
        // Do NOT clear catalog cache here — SearchProductAction / CATALOG_KEY already warm.
        Cache::forget(PublicHomepageCache::KEY);
        $payload = $this->build();
        Cache::put(PublicHomepageCache::KEY, $payload, PublicHomepageCache::TTL_SECONDS);
        Cache::put(PublicHomepageCache::STALE_KEY, $payload, PublicHomepageCache::STALE_TTL_SECONDS);
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
        // Survives CMS invalidation — Marketing edits must not re-run 9 catalog searches.
        return PublicHomepageCache::rememberCatalog(fn () => $this->buildHomepageCatalogBuckets());
    }

    /**
     * Lightweight landing catalog preview — MUST stay fast on cold miss.
     * Avoids SearchProductAction + ProductListResource (pricing/taxonomy per SKU)
     * which previously made cold homepage rebuild take tens of seconds.
     *
     * @return list<array<string, mixed>>
     */
    protected function buildHomepageCatalogBuckets(): array
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

            $filterSlugs = LogicalProductKey::categoryFilterSlugs($family);

            $baseQuery = Product::query()
                ->whereHas('providerSkus', function ($q) {
                    $q->where('is_active', true)
                        ->whereHas('productProvider', fn ($pq) => $pq->where('is_active', true));
                })
                ->whereHas('category', function ($q) use ($filterSlugs, $family) {
                    if ($filterSlugs !== []) {
                        $q->whereIn('slug', $filterSlugs);
                    } else {
                        $q->where('slug', $family);
                    }
                });

            $productCount = (clone $baseQuery)->count();

            $items = (clone $baseQuery)
                ->with(['provider:id,name,logo', 'category:id,name,slug'])
                ->orderBy('id')
                ->limit(8)
                ->get(['id', 'sku_code', 'name', 'sell_price', 'base_price', 'provider_id', 'product_category_id', 'zone_label']);

            $products = $items->map(function (Product $product) use ($family) {
                $price = (float) ($product->sell_price ?? $product->base_price ?? 0);

                return [
                    'id' => $product->id,
                    'code' => $product->sku_code,
                    'name' => $product->name,
                    'zoneLabel' => $product->zone_label,
                    'price' => $price,
                    'sellingPrice' => $price,
                    'adminFee' => 0,
                    'status' => 'tersedia',
                    'isActive' => true,
                    'isPurchasable' => true,
                    'category' => $family,
                    'operatorName' => $product->provider?->name,
                    'provider' => $product->provider?->name,
                    'providerDetails' => $product->provider ? [
                        'id' => $product->provider->id,
                        'name' => $product->provider->name,
                        'logo' => $product->provider->logo,
                        'isActive' => true,
                    ] : null,
                ];
            })->values()->all();

            $representative = $products[0] ?? null;
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
                'productCount' => $productCount,
                'products' => $products,
                'previewProduct' => $representative,
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
