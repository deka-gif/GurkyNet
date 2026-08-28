<?php

namespace App\Services\Catalog;

use Illuminate\Support\Str;

/**
 * Maps Digiflazz / VIP provider taxonomy → GurkyNet frontend categories.
 * Frontend must never see raw provider category trees.
 */
class ProductMappingService
{
    /**
     * @return array{slug:string,name:string,hub:?string,source:string}
     */
    public function map(
        string $provider,
        string $providerCategory,
        string $brand = '',
        string $productName = '',
        bool $isGameHint = false
    ): array {
        $slug = null;
        $source = 'fallback';

        // Priority order matters: brand_overrides (deliberate, curated) first, then the
        // provider's own authoritative category field, and only THEN a name-keyword
        // fallback. A crude substring match on the product name must never outrank the
        // real category Digiflazz/VIP reports — that's how a product named "Voucher Data
        // XYZ" from an unrelated category could get misfiled ahead of its true category.
        $brandHit = $this->matchBrandOverride($brand, $productName);
        if ($brandHit !== null) {
            $slug = $brandHit;
            $source = 'brand_override';
        }

        if ($slug === null) {
            $slug = $this->matchProviderCategory($provider, $providerCategory);
            $source = $slug !== null ? 'provider_category' : 'fallback';
        }

        if ($slug === null && $isGameHint) {
            $slug = 'game';
            $source = 'game_hint';
        }

        if ($slug === null) {
            $kw = $this->matchNameKeywords($productName.' '.$brand);
            if ($kw !== null) {
                $slug = $kw;
                $source = 'name_keyword';
            }
        }

        if ($slug === null) {
            $slug = (string) config('gurky_catalog.unmapped_fallback', 'pulsa');
            $source = 'unmapped_fallback';
        }

        $slug = $this->canonicalizeSlug($slug);
        $meta = config('gurky_catalog.categories.'.$slug, [
            'name' => Str::title(str_replace('-', ' ', $slug)),
            'hub' => null,
        ]);

        return [
            'slug' => $slug,
            'name' => (string) ($meta['name'] ?? $slug),
            'hub' => $meta['hub'] ?? null,
            'source' => $source,
            'provider_category' => $providerCategory,
            'brand' => $brand,
        ];
    }

    public function canonicalizeSlug(string $slug): string
    {
        $slug = Str::lower(trim($slug));

        $direct = match ($slug) {
            'ewallet', 'e-wallet', 'emoney', 'e-money', 'saldo-emoney' => 'topup-digital',
            'voucher' => 'voucher-digital',
            'games', 'game-feature', 'voucher-game' => 'game',
            'streaming', 'streaming-tv', 'apps', 'aplikasi' => 'langganan-digital',
            default => null,
        };
        if ($direct !== null) {
            return $direct;
        }

        // Reverse-lookup filter aliases (e.g. prepaid → pulsa, e-money → topup-digital)
        foreach (config('gurky_catalog.filter_aliases', []) as $family => $aliases) {
            if ($family === $slug) {
                return (string) $family;
            }
            foreach ($aliases as $alias) {
                if (Str::lower((string) $alias) === $slug) {
                    return (string) $family;
                }
            }
        }

        return $slug !== '' ? $slug : 'pulsa';
    }

    /**
     * @return list<string>
     */
    public function filterSlugs(string $category): array
    {
        $family = $this->canonicalizeSlug($category);
        $aliases = config('gurky_catalog.filter_aliases.'.$family);

        if (is_array($aliases) && $aliases !== []) {
            return array_values(array_unique(array_map(
                fn ($s) => Str::lower((string) $s),
                $aliases
            )));
        }

        return [$family];
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function taxonomyForFrontend(): array
    {
        $hubs = config('gurky_catalog.hubs', []);
        $out = [];

        foreach ($hubs as $key => $hub) {
            $children = [];
            foreach (($hub['children'] ?? []) as $childKey => $child) {
                $children[] = [
                    'key' => $childKey,
                    'label' => $child['label'] ?? $childKey,
                    'path' => $child['path'] ?? null,
                ];
            }

            $out[] = [
                'key' => $key,
                'label' => $hub['label'] ?? $key,
                'icon' => $hub['icon'] ?? 'grid',
                'path' => $hub['path'] ?? null,
                'children' => $children,
            ];
        }

        return $out;
    }

    public function hubForCategory(string $slug): ?string
    {
        $slug = $this->canonicalizeSlug($slug);
        $meta = config('gurky_catalog.categories.'.$slug);

        return is_array($meta) ? ($meta['hub'] ?? null) : null;
    }

    protected function matchBrandOverride(string $brand, string $productName): ?string
    {
        $hay = Str::lower(trim($brand.' '.$productName));
        if ($hay === '') {
            return null;
        }

        $overrides = config('gurky_catalog.brand_overrides', []);
        // Longer keys first for specificity (e.g. "steam wallet" before "steam")
        uksort($overrides, fn ($a, $b) => strlen((string) $b) <=> strlen((string) $a));

        foreach ($overrides as $needle => $slug) {
            if ($needle !== '' && str_contains($hay, Str::lower((string) $needle))) {
                return (string) $slug;
            }
        }

        return null;
    }

    protected function matchNameKeywords(string $text): ?string
    {
        $hay = Str::lower(trim($text));
        if ($hay === '') {
            return null;
        }

        foreach (config('gurky_catalog.name_keywords', []) as $slug => $keywords) {
            foreach ($keywords as $kw) {
                if ($kw !== '' && str_contains($hay, Str::lower((string) $kw))) {
                    return (string) $slug;
                }
            }
        }

        return null;
    }

    protected function matchProviderCategory(string $provider, string $providerCategory): ?string
    {
        $raw = Str::lower(trim($providerCategory));
        if ($raw === '') {
            return null;
        }

        $mapKey = str_starts_with(Str::lower($provider), 'vip')
            ? 'vip_categories'
            : 'digiflazz_categories';

        $map = config('gurky_catalog.'.$mapKey, []);

        if (isset($map[$raw])) {
            return (string) $map[$raw];
        }

        // Try slug form
        $asSlug = Str::slug($raw);
        if (isset($map[$asSlug])) {
            return (string) $map[$asSlug];
        }

        // VIP sometimes already uses our slugs
        if (array_key_exists($asSlug, config('gurky_catalog.categories', []))) {
            return $asSlug;
        }

        return null;
    }
}
