<?php

namespace App\Services\Catalog;

use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Customer-facing category listing for GET /categories.
 *
 * Digiflazz is the active catalog provider. Raw/legacy provider slugs must never
 * surface as menu items; known aliases are canonicalized at mapping time.
 * (Product Mapping Layer — keep CF names like E-Wallet / Token PLN.)
 */
class CustomerFacingCategoryLister
{
    public function __construct(
        protected ProductMappingService $mapping,
    ) {}

    /**
     * Canonical slugs allowed as customer-facing menu rows.
     *
     * @return list<string>
     */
    public function allowedSlugs(): array
    {
        return [
            'pulsa',
            'data',
            'voucher-internet',
            'sms-telepon',
            'masa-aktif',
            'aktivasi-perdana',
            'esim',
            'pln',
            'pln-pascabayar',
            'pln-nontaglis',
            'pdam',
            'bpjs-kesehatan',
            'bpjs-tk',
            'internet-pascabayar',
            'tv-pascabayar',
            'gas',
            'gas-prepaid',
            'pbb',
            'samsat',
            'multifinance',
            'tagihan',
            'hp-pascabayar',
            'topup-digital',
            'game',
            'voucher-digital',
            'langganan-digital',
            'international',
            // Internal CF service (not Digi) — keep if present
            'transfer',
        ];
    }

    /**
     * Legacy/raw slugs that must never appear as their own menu tile.
     *
     * @return list<string>
     */
    public function hiddenRawSlugs(): array
    {
        return [
            'game-feature',
            'gamed',
            'voucher-game',
            'topup-game',
            'top-up-game',
            'games',
            'saldo-emoney',
            'emoney',
            'e-money',
            'e-wallet',
            'ewallet',
            'streaming-tv',
            'streaming',
            'aplikasi',
            'apps',
            'voucher',
            'prepaid',
            'paket-data',
            'paket_data',
            'token-pln',
            'bpjs',
            'langganan',
        ];
    }

    public function isHiddenRawSlug(string $slug): bool
    {
        $slug = Str::lower(trim($slug));
        if ($slug === '') {
            return true;
        }

        if (in_array($slug, $this->hiddenRawSlugs(), true)) {
            return true;
        }

        if (str_starts_with($slug, 'pulsa-') || str_starts_with($slug, 'paket-')) {
            return true;
        }

        // Alias that canonicalizes away from itself → never expose raw row.
        $canon = $this->mapping->canonicalizeSlug($slug);
        if ($canon !== $slug && ! in_array($slug, $this->allowedSlugs(), true)) {
            return true;
        }

        // Unknown / orphan provider taxonomy
        if (! in_array($slug, $this->allowedSlugs(), true)) {
            return true;
        }

        return false;
    }

    /**
     * @return EloquentCollection<int, ProductCategory>
     */
    public function list(): EloquentCollection
    {
        $cacheKey = ProductCatalogCache::categoriesKey();
        $ttl = 3600;
        $loader = fn () => $this->loadFresh();

        try {
            try {
                return Cache::tags(['categories', 'products', 'active_products'])->remember($cacheKey, $ttl, $loader);
            } catch (\BadMethodCallException) {
                return Cache::remember($cacheKey, $ttl, $loader);
            }
        } catch (\Throwable $e) {
            Log::warning('Customer-facing categories cache unavailable — serving direct query', [
                'error' => $e->getMessage(),
            ]);

            return $loader();
        }
    }

    /**
     * @return EloquentCollection<int, ProductCategory>
     */
    protected function loadFresh(): EloquentCollection
    {
        $allowed = $this->allowedSlugs();
        $digi = ProductProvider::digiflazz();
        $digiId = $digi?->id;

        // Resolve Digi-active product categories through canonicalizeSlug so legacy
        // rows (game-feature, saldo-emoney, …) activate their CF canonical slug.
        $canonicalWithDigi = collect();
        if ($digiId) {
            $rawCategoryIds = \App\Models\Product::query()
                ->where(function ($ops) {
                    $ops->whereNull('ops_status')
                        ->orWhere('ops_status', '!=', 'inactive');
                })
                ->whereHas('providerSkus', function ($ps) use ($digiId) {
                    $ps->where('product_provider_skus.is_active', true)
                        ->where('product_provider_skus.product_provider_id', $digiId)
                        ->whereHas('productProvider', function ($pp) {
                            $pp->where('product_providers.is_active', true);
                        });
                })
                ->distinct()
                ->pluck('product_category_id');

            $rawSlugs = ProductCategory::query()
                ->whereIn('id', $rawCategoryIds)
                ->pluck('slug');

            $canonicalWithDigi = $rawSlugs
                ->map(fn ($s) => $this->mapping->canonicalizeSlug((string) $s))
                ->filter(fn ($s) => in_array($s, $allowed, true) && $s !== 'transfer')
                ->unique()
                ->values();

            // Ensure CF category rows exist when only legacy slug rows hold Digi SKUs.
            foreach ($canonicalWithDigi as $slug) {
                $meta = config('gurky_catalog.categories.'.$slug);
                $name = is_array($meta) && ! empty($meta['name'])
                    ? (string) $meta['name']
                    : Str::title(str_replace('-', ' ', $slug));
                ProductCategory::firstOrCreate(
                    ['slug' => $slug],
                    ['name' => $name, 'icon' => 'box']
                );
            }
        }

        $visibleSlugs = $canonicalWithDigi->all();
        // Transfer is GurkyNet-internal — keep without Digi requirement when present.
        if (in_array('transfer', $allowed, true)) {
            $visibleSlugs[] = 'transfer';
        }
        $visibleSlugs = array_values(array_unique($visibleSlugs));

        /** @var Collection<int, ProductCategory> $rows */
        $rows = ProductCategory::query()
            ->whereIn('slug', $visibleSlugs)
            ->orderBy('id')
            ->get()
            // Drop transfer if the row was never seeded.
            ->filter(function (ProductCategory $cat) use ($canonicalWithDigi) {
                if ($cat->slug === 'transfer') {
                    return true;
                }

                return $canonicalWithDigi->contains($cat->slug);
            });

        // Apply CF display names from config (E-Wallet, Token PLN, …).
        foreach ($rows as $cat) {
            $meta = config('gurky_catalog.categories.'.$cat->slug);
            if (is_array($meta) && ! empty($meta['name'])) {
                $cat->name = (string) $meta['name'];
            }
        }

        return new EloquentCollection($rows->values()->all());
    }
}
