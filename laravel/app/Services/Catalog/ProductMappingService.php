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
     * @param  string|null  $listType  Digiflazz cmd / digiflazz_products.list_type (`prepaid`|`pasca`).
     * @return array{slug:string,name:string,hub:?string,source:string}
     */
    public function map(
        string $provider,
        string $providerCategory,
        string $brand = '',
        string $productName = '',
        bool $isGameHint = false,
        ?string $listType = null,
    ): array {
        $slug = null;
        $source = 'fallback';

        // Priority order matters: brand_overrides (deliberate, curated) first, then the
        // provider's own authoritative category field, and only THEN a name-keyword
        // fallback. A crude substring match on the product name must never outrank the
        // real category Digiflazz/VIP reports — that's how a product named "Voucher Data
        // XYZ" from an unrelated category could get misfiled ahead of its true category.
        $brandHit = $this->matchBrandOverride($brand, $productName);
        // Telco brands (Telkomsel, Tri, XL, …) must never be forced into Game or Langganan
        // Digital by title overrides like "Free Fire" / "YouTube" / "Vidio" — those are
        // Paket Data under Telekomunikasi, not diamond top-up or streaming subscriptions.
        if (
            ($brandHit === 'game' || $brandHit === 'langganan-digital')
            && $this->isTelcoBrand($brand)
        ) {
            $brandHit = null;
        }
        if ($brandHit !== null) {
            $slug = $brandHit;
            $source = 'brand_override';
        }

        if ($slug === null) {
            $slug = $this->matchProviderCategory($provider, $providerCategory);
            $source = $slug !== null ? 'provider_category' : 'fallback';
        }

        if ($slug === null && $isGameHint && ! $this->isTelcoBrand($brand)) {
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

        // Final guard: telco operators never belong in Game or Langganan Digital —
        // Digiflazz may label operator data packs as Games / Streaming / Aplikasi.
        if ($slug === 'game' && $this->isTelcoBrand($brand)) {
            $slug = 'data';
            $source = 'telco_not_game';
        }
        if ($slug === 'langganan-digital' && $this->isTelcoBrand($brand)) {
            $slug = 'data';
            $source = 'telco_not_langganan';
        }

        // Digiflazz PLN: brand "PLN" alone must not decide Token vs Pascabayar —
        // list_type (prepaid|pasca) is authoritative when present.
        $slug = $this->resolvePlnByListType($slug, $providerCategory, $brand, $listType, $source);

        // Digiflazz Gas: prepaid voucher/top-up ≠ postpaid Gas Negara bill.
        $slug = $this->resolveGasByListType($slug, $providerCategory, $brand, $listType, $source);

        // Digiflazz HP Pascabayar (Halo/XL/… postpaid phone) ≠ generic "Tagihan Lainnya".
        $slug = $this->resolveHpPascabayar($slug, $providerCategory, $brand, $listType, $source);

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

    /**
     * Split Digiflazz Token PLN (`pln`) vs PLN Pascabayar (`pln-pascabayar`)
     * vs PLN Nontaglis (`pln-nontaglis`).
     * brand_overrides['pln'] historically forced both into Token PLN.
     *
     * Nontaglis is Digi Pascabayar + brand PLN NONTAGLIS — same inq-pasca contract
     * as other bills, but a distinct customer-facing service (not ordinary PLN bill).
     */
    protected function resolvePlnByListType(
        string $slug,
        string $providerCategory,
        string $brand,
        ?string $listType,
        string &$source,
    ): string {
        if (! $this->isPlnElectricityCandidate($slug, $providerCategory, $brand)) {
            return $slug;
        }

        $lt = Str::lower(trim((string) $listType));
        $cat = Str::lower(trim($providerCategory));
        $brandL = Str::lower(trim($brand));

        // Brand evidence first — do not fold Nontaglis into generic PLN Pascabayar.
        if ($this->isPlnNontaglisBrand($brandL) || $slug === 'pln-nontaglis') {
            $source = 'pln_nontaglis_brand';

            return 'pln-nontaglis';
        }

        // Primary: Digiflazz price-list cmd stored as digiflazz_products.list_type
        if (in_array($lt, ['pasca', 'pascabayar', 'postpaid'], true)) {
            $source = 'pln_list_type_pasca';

            return 'pln-pascabayar';
        }
        if ($lt === 'prepaid') {
            $source = 'pln_list_type_prepaid';

            return 'pln';
        }

        // Fallback when list_type missing (legacy callers): Digi category / brand signals.
        if ($cat === 'pascabayar' || str_contains($brandL, 'pascabayar')) {
            $source = 'pln_pasca_signal';

            return 'pln-pascabayar';
        }

        $source = $cat === 'pln' ? 'pln_prepaid_signal' : $source;

        return 'pln';
    }

    protected function isPlnNontaglisBrand(string $brandLower): bool
    {
        return $brandLower === 'pln nontaglis'
            || str_starts_with($brandLower, 'pln nontaglis')
            || str_contains($brandLower, 'nontaglis');
    }

    protected function isPlnElectricityCandidate(string $slug, string $providerCategory, string $brand): bool
    {
        if (in_array($slug, ['pln', 'pln-pascabayar', 'pln-nontaglis'], true)) {
            return true;
        }

        $cat = Str::lower(trim($providerCategory));
        if ($cat === 'pln') {
            return true;
        }

        $brandL = Str::lower(trim($brand));
        // Digi pasca: category=Pascabayar + brand PLN / PLN PASCABAYAR / PLN NONTAGLIS
        if ($cat === 'pascabayar' && (
            $brandL === 'pln'
            || str_starts_with($brandL, 'pln ')
            || str_contains($brandL, 'pln pascabayar')
            || $this->isPlnNontaglisBrand($brandL)
        )) {
            return true;
        }

        return false;
    }

    /**
     * Digiflazz category "Gas" + list_type prepaid → gas-prepaid (direct buy).
     * Pasca / Gas Negara bill stays on slug gas (inquiry).
     */
    protected function resolveGasByListType(
        string $slug,
        string $providerCategory,
        string $brand,
        ?string $listType,
        string &$source,
    ): string {
        $cat = Str::lower(trim($providerCategory));
        $brandL = Str::lower(trim($brand));
        $lt = Str::lower(trim((string) $listType));

        $isGasFamily = $slug === 'gas'
            || $slug === 'gas-prepaid'
            || $cat === 'gas'
            || $cat === 'gas negara'
            || str_contains($brandL, 'pertagas')
            || str_contains($brandL, 'pgn')
            || str_contains($brandL, 'gas negara');

        if (! $isGasFamily) {
            return $slug;
        }

        if (in_array($lt, ['pasca', 'pascabayar', 'postpaid'], true)) {
            $source = 'gas_list_type_pasca';

            return 'gas';
        }

        if ($lt === 'prepaid' || $cat === 'gas') {
            // Digi prepaid Gas SKUs (Pertagas/PGN nominal) — not postpaid inquiry.
            if ($lt === 'prepaid' || ($cat === 'gas' && ! in_array($lt, ['pasca', 'pascabayar', 'postpaid'], true))) {
                $source = 'gas_list_type_prepaid';

                return 'gas-prepaid';
            }
        }

        return $slug === 'gas-prepaid' ? 'gas-prepaid' : $slug;
    }

    /**
     * Digiflazz Pascabayar mobile postpaid brands → dedicated hp-pascabayar CF slug.
     * Evidence: Digi category Pascabayar + brand family (HP PASCABAYAR + operator Omni/Cuan packs).
     * Do not map prepaid operator brands here — gated by pasca list_type / category.
     */
    protected function resolveHpPascabayar(
        string $slug,
        string $providerCategory,
        string $brand,
        ?string $listType,
        string &$source,
    ): string {
        $brandL = Str::lower(trim($brand));
        $cat = Str::lower(trim($providerCategory));
        $lt = Str::lower(trim((string) $listType));

        $isPascaContext = $cat === 'pascabayar'
            || in_array($lt, ['pasca', 'pascabayar', 'postpaid'], true)
            || in_array($slug, ['tagihan', 'hp-pascabayar'], true);

        if (! $isPascaContext) {
            return $slug;
        }

        $isHp = $brandL === 'hp pascabayar'
            || str_starts_with($brandL, 'hp pascabayar')
            || str_contains($brandL, 'hp pascabayar')
            || in_array($brandL, [
                'by.u',
                'telkomsel omni',
                'indosat only4u',
                'tri cuanmax',
                'xl axis cuanku',
            ], true);

        if (! $isHp) {
            return $slug;
        }

        $source = 'hp_pascabayar_brand';

        return 'hp-pascabayar';
    }

    public function canonicalizeSlug(string $slug): string
    {
        $slug = Str::lower(trim($slug));

        $direct = match ($slug) {
            'ewallet', 'e-wallet', 'emoney', 'e-money', 'saldo-emoney' => 'topup-digital',
            'voucher' => 'voucher-digital',
            'games', 'game-feature', 'voucher-game', 'gamed', 'topup-game', 'top-up-game' => 'game',
            'streaming', 'streaming-tv', 'apps', 'aplikasi' => 'langganan-digital',
            'token-pln', 'token_pln' => 'pln',
            'paket-data', 'paket_data' => 'data',
            'pln-nontaglis', 'pln_nontaglis', 'nontaglis' => 'pln-nontaglis',
            'gas-negara' => 'gas',
            'hp-postpaid', 'pulsa-pascabayar' => 'hp-pascabayar',
            default => null,
        };
        if ($direct !== null) {
            return $direct;
        }

        // Digi/VIP legacy prefix families — never leave as customer-facing slugs.
        if (str_starts_with($slug, 'pulsa-')) {
            return 'pulsa';
        }
        if (str_starts_with($slug, 'paket-')) {
            if (str_contains($slug, 'sms') || str_contains($slug, 'telepon') || str_contains($slug, 'telpon')) {
                return 'sms-telepon';
            }

            return 'data';
        }

        $aliasMap = config('gurky_catalog.filter_aliases', []);

        // A slug that is itself a defined family key is ALREADY canonical — resolve it
        // immediately, before scanning any other family's alias list. Without this guard,
        // a broad "catch-all" filter family (e.g. 'bpjs' listing both 'bpjs-kesehatan' and
        // 'bpjs-tk' as aliases so a generic `category=bpjs` filter matches both) can hijack
        // a real category's own canonical slug if that family happens to be enumerated
        // earlier in the config array than the slug's own family entry.
        if (array_key_exists($slug, $aliasMap)) {
            return $slug;
        }

        // Reverse-lookup filter aliases (e.g. prepaid → pulsa, e-money → topup-digital)
        foreach ($aliasMap as $family => $aliases) {
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
        $raw = Str::lower(trim($category));
        $family = $this->canonicalizeSlug($category);
        $aliases = config('gurky_catalog.filter_aliases.'.$family);

        $slugs = is_array($aliases) && $aliases !== []
            ? array_map(fn ($s) => Str::lower((string) $s), $aliases)
            : [$family];

        // Keep the request slug so legacy ProductCategory rows (e.g. pulsa-seluler)
        // remain findable until remapped — without exposing them as CF menu items.
        if ($raw !== '') {
            $slugs[] = $raw;
        }
        $slugs[] = $family;

        return array_values(array_unique($slugs));
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

    /**
     * True when brand is a known Indonesian prepaid operator (Telekomunikasi).
     * Used so GamesMAX / game-titled data packages never land in hub Game.
     */
    public function isTelcoBrand(string $brand): bool
    {
        $raw = Str::lower(preg_replace('/[^a-z0-9]+/i', '', $brand) ?? '');
        if ($raw === '') {
            return false;
        }

        // Mirror mobile/web operatorMatch keys — exact-ish, no bare substring traps.
        if (str_contains($raw, 'telkomsel') || $raw === 'tsel') {
            return true;
        }
        if (str_contains($raw, 'indosat') || $raw === 'im3') {
            return true;
        }
        if ($raw === 'xl' || str_contains($raw, 'xlaxiata')) {
            return true;
        }
        if ($raw === 'tri' || $raw === 'three' || $raw === '3') {
            return true;
        }
        if ($raw === 'axis') {
            return true;
        }
        if (str_contains($raw, 'smartfren')) {
            return true;
        }
        if (str_contains($raw, 'byu')) {
            return true;
        }

        return false;
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
