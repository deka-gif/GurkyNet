<?php

namespace App\Services\Catalog;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use Illuminate\Support\Str;

/**
 * Classifies Telkomsel data products into UX taxonomy groups from real provider names/desc.
 */
class TelkomselDataTaxonomyService
{
    public function chips(): array
    {
        return array_values(config('telkomsel_data.chips', []));
    }

    public function isTelkomselBrand(?string $brand): bool
    {
        $key = Str::lower(preg_replace('/[^a-z0-9]+/i', '', (string) $brand) ?? '');
        foreach (config('telkomsel_data.operator_keys', ['telkomsel']) as $op) {
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
        $groups = config('telkomsel_data.groups', []);

        // Prefer specific groups before broad "favorit" / "promo"
        $priority = [
            'internet-sakti', 'combo-sakti', 'roaming', 'games', 'streaming', 'sosial',
            'bisnis', 'harian', 'promo', 'favorit', 'umum',
        ];

        foreach ($priority as $key) {
            if (!isset($groups[$key])) {
                continue;
            }
            $keywords = $groups[$key]['keywords'] ?? [];
            foreach ($keywords as $kw) {
                if ($kw !== '' && str_contains($hay, Str::lower((string) $kw))) {
                    return [
                        'group' => $key,
                        'label' => (string) ($groups[$key]['label'] ?? $key),
                        'section' => $groups[$key]['section'] ?? null,
                    ];
                }
            }
        }

        return [
            'group' => 'umum',
            'label' => (string) ($groups['umum']['label'] ?? 'Umum'),
            'section' => 'favorit',
        ];
    }

    public function classifyProduct(Product $product): array
    {
        $desc = $this->descriptionFor($product);

        return $this->classify((string) $product->name, $desc);
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

    /**
     * Whether product name implies a regional/area variant.
     */
    public function mentionsRegion(string $productName, ?string $description = null): bool
    {
        $hay = Str::lower($productName.' '.($description ?? ''));
        foreach (config('telkomsel_data.region_required_keywords', []) as $kw) {
            if ($kw !== '' && str_contains($hay, Str::lower((string) $kw))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Keywords used to SQL/collection-filter a group (including favorit umbrella).
     *
     * @return list<string>
     */
    public function keywordsForGroup(string $group): array
    {
        $group = Str::lower(trim($group));
        $groups = config('telkomsel_data.groups', []);
        if ($group === '' || $group === 'semua' || $group === 'all') {
            return [];
        }

        if ($group === 'favorit') {
            // Union of popular Telkomsel families
            $keys = ['favorit', 'internet-sakti', 'combo-sakti'];
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
            return in_array($classified['group'], ['favorit', 'internet-sakti', 'combo-sakti', 'umum'], true)
                || $this->matchesAnyKeyword($product, $this->keywordsForGroup('favorit'));
        }

        return $classified['group'] === $group
            || $this->matchesAnyKeyword($product, $this->keywordsForGroup($group));
    }

    protected function matchesAnyKeyword(Product $product, array $keywords): bool
    {
        if ($keywords === []) {
            return false;
        }
        $hay = Str::lower(trim($product->name.' '.($this->descriptionFor($product) ?? '')));
        foreach ($keywords as $kw) {
            if ($kw !== '' && str_contains($hay, Str::lower((string) $kw))) {
                return true;
            }
        }

        return false;
    }
}
