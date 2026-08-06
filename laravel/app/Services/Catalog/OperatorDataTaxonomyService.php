<?php

namespace App\Services\Catalog;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use Illuminate\Support\Str;

/**
 * Config-driven operator Paket Data taxonomy (Telkomsel master pattern).
 * Subclasses only set $configKey — no hardcoded SKUs.
 */
abstract class OperatorDataTaxonomyService
{
    abstract protected function configKey(): string;

    public function chips(): array
    {
        return array_values($this->cfg('chips', []));
    }

    public function regionOptions(): array
    {
        return array_values($this->cfg('region_options', []));
    }

    public function displayName(): string
    {
        return (string) $this->cfg('display_name', 'Operator');
    }

    public function isOperatorBrand(?string $brand): bool
    {
        $key = Str::lower(preg_replace('/[^a-z0-9]+/i', '', (string) $brand) ?? '');
        foreach ($this->cfg('operator_keys', []) as $op) {
            if ($key !== '' && str_contains($key, Str::lower((string) $op))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{group:string,label:string,section:?string}
     */
    public function classify(string $productName, ?string $description = null): array
    {
        $hay = Str::lower(trim($productName.' '.($description ?? '')));
        $groups = $this->cfg('groups', []);
        $priority = $this->cfg('classify_priority', array_keys($groups));

        foreach ($priority as $key) {
            if (!isset($groups[$key])) {
                continue;
            }
            foreach (($groups[$key]['keywords'] ?? []) as $kw) {
                if ($this->keywordMatches($hay, (string) $kw)) {
                    return [
                        'group' => (string) $key,
                        'label' => (string) ($groups[$key]['label'] ?? $key),
                        'section' => $groups[$key]['section'] ?? null,
                    ];
                }
            }
        }

        return [
            'group' => 'umum',
            'label' => (string) ($groups['umum']['label'] ?? 'Umum'),
            'section' => (string) ($groups['umum']['section'] ?? 'favorit'),
        ];
    }

    public function classifyProduct(Product $product): array
    {
        return $this->classify((string) $product->name, $this->descriptionFor($product));
    }

    public function descriptionFor(Product $product): ?string
    {
        $row = DigiflazzProduct::query()
            ->where('buyer_sku_code', $product->sku_code)
            ->first(['desc', 'product_name']);

        $desc = trim((string) ($row?->desc ?? ''));

        return $desc !== '' ? $desc : null;
    }

    /**
     * @return array{quota:?string,validity:?string}
     */
    public function parseMeta(string $productName, ?string $description = null): array
    {
        $hay = $productName.' '.($description ?? '');

        $quota = null;
        if (preg_match('/(\d+(?:[.,]\d+)?)\s*(GB|MB)\b/iu', $hay, $m)) {
            $quota = str_replace(',', '.', $m[1]).' '.strtoupper($m[2]);
        } elseif (preg_match('/\bunlimited\b/iu', $hay)) {
            $quota = 'Unlimited';
        }

        $validity = null;
        if (preg_match('/(\d+)\s*(hari|hr|day|days|bulan|bln|minggu)\b/iu', $hay, $m)) {
            $unit = Str::lower($m[2]);
            $unitLabel = match (true) {
                str_starts_with($unit, 'har') || str_starts_with($unit, 'day') || $unit === 'hr' => 'Hari',
                str_starts_with($unit, 'bulan') || $unit === 'bln' => 'Bulan',
                str_starts_with($unit, 'minggu') => 'Minggu',
                default => $m[2],
            };
            $validity = $m[1].' '.$unitLabel;
        }

        return [
            'quota' => $quota,
            'validity' => $validity,
        ];
    }

    public function mentionsRegion(string $productName, ?string $description = null): bool
    {
        $hay = Str::lower($productName.' '.($description ?? ''));
        foreach ($this->cfg('region_required_keywords', []) as $kw) {
            if ($this->keywordMatches($hay, (string) $kw)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    public function keywordsForGroup(string $group): array
    {
        $group = Str::lower(trim($group));
        $groups = $this->cfg('groups', []);
        if ($group === '' || $group === 'semua' || $group === 'all') {
            return [];
        }

        if ($group === 'favorit') {
            $keys = $this->cfg('favorit_keyword_union', ['favorit']);
            $out = [];
            foreach ($keys as $k) {
                foreach (($groups[$k]['keywords'] ?? []) as $kw) {
                    $out[] = (string) $kw;
                }
            }

            return array_values(array_unique(array_filter($out)));
        }

        return array_values(array_filter(array_map(
            'strval',
            $groups[$group]['keywords'] ?? []
        )));
    }

    public function productMatchesGroup(Product $product, string $group): bool
    {
        $group = Str::lower(trim($group));
        if ($group === '' || $group === 'semua' || $group === 'all') {
            return true;
        }

        $classified = $this->classifyProduct($product);
        if ($group === 'favorit') {
            $match = $this->cfg('favorit_match_groups', ['favorit', 'umum']);

            return in_array($classified['group'], $match, true)
                || $this->matchesAnyKeyword($product, $this->keywordsForGroup('favorit'));
        }

        return $classified['group'] === $group
            || $this->matchesAnyKeyword($product, $this->keywordsForGroup($group));
    }

    /**
     * Priority: PROMO > TERLARIS > FAVORIT > BARU
     */
    public function badgeFor(Product $product, ?array $classified = null): ?string
    {
        if (!$this->isOperatorBrand($product->provider?->name)) {
            return null;
        }

        $classified ??= $this->classifyProduct($product);
        $group = (string) ($classified['group'] ?? '');
        $hay = Str::lower(trim($product->name.' '.($this->descriptionFor($product) ?? '')));

        foreach ($this->cfg('badge_promo_hints', ['promo']) as $hint) {
            if ($this->keywordMatches($hay, (string) $hint)) {
                return 'PROMO';
            }
        }
        if ($group === 'promo' || $group === 'gift') {
            return 'PROMO';
        }

        foreach ($this->cfg('badge_terlaris_hints', []) as $hint) {
            if ($this->keywordMatches($hay, (string) $hint)) {
                return 'TERLARIS';
            }
        }

        $favoritGroups = $this->cfg('badge_favorit_groups', ['favorit']);
        if (in_array($group, $favoritGroups, true)) {
            return 'FAVORIT';
        }

        $created = $product->created_at ?? $product->updated_at;
        if ($created && $created->greaterThan(now()->subDays(14))) {
            return 'BARU';
        }

        return null;
    }

    public function quotaValueMb(string $productName, ?string $description = null): float
    {
        $meta = $this->parseMeta($productName, $description);
        $quota = (string) ($meta['quota'] ?? '');
        if ($quota === '' || Str::lower($quota) === 'unlimited') {
            return $quota !== '' ? 1_000_000.0 : 0.0;
        }
        if (preg_match('/([\d.]+)\s*(GB|MB)/i', $quota, $m)) {
            $n = (float) $m[1];

            return Str::upper($m[2]) === 'GB' ? $n * 1024 : $n;
        }

        return 0.0;
    }

    public function validityValueDays(string $productName, ?string $description = null): float
    {
        $meta = $this->parseMeta($productName, $description);
        $validity = (string) ($meta['validity'] ?? '');
        if ($validity === '') {
            return 0.0;
        }
        if (preg_match('/(\d+)\s*(Hari|Bulan|Minggu)/iu', $validity, $m)) {
            $n = (float) $m[1];
            $unit = Str::lower($m[2]);
            if (str_starts_with($unit, 'bulan')) {
                return $n * 30;
            }
            if (str_starts_with($unit, 'minggu')) {
                return $n * 7;
            }

            return $n;
        }

        return 0.0;
    }

    protected function matchesAnyKeyword(Product $product, array $keywords): bool
    {
        if ($keywords === []) {
            return false;
        }
        $hay = Str::lower(trim($product->name.' '.($this->descriptionFor($product) ?? '')));
        foreach ($keywords as $kw) {
            if ($this->keywordMatches($hay, (string) $kw)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Short tokens (e.g. 5g) use word boundaries so "15GB" does not match "5g".
     */
    protected function keywordMatches(string $hay, string $keyword): bool
    {
        $kw = Str::lower(trim($keyword));
        if ($kw === '') {
            return false;
        }

        $compact = preg_replace('/[^a-z0-9]+/', '', $kw) ?? '';
        if (strlen($compact) <= 3) {
            return (bool) preg_match(
                '/(?<![a-z0-9])'.preg_quote($kw, '/').'(?![a-z0-9])/iu',
                $hay
            );
        }

        return str_contains($hay, $kw);
    }

    protected function cfg(string $key, mixed $default = null): mixed
    {
        return config($this->configKey().'.'.$key, $default);
    }
}
