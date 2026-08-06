<?php

namespace App\Services\ProductProviders;

use App\Models\Product;
use Illuminate\Support\Str;

/**
 * Logical product identity for User catalog merge + runtime sibling offer discovery.
 * Users see one card per Category + Operator + Denomination (not raw provider names).
 */
class LogicalProductKey
{
    /**
     * Provider-noise words stripped before grouping / display normalization.
     *
     * @var list<string>
     */
    protected static array $noiseWords = [
        'pulsa',
        'regular',
        'reguler',
        'prepaid',
        'voucher',
        'nominal',
        'token',
        'topup',
        'top',
        'up',
        'isi',
        'ulang',
    ];

    /**
     * Category family aliases — source of truth is config/gurky_catalog.php.
     * Kept as a thin facade so existing call sites keep working.
     *
     * @var array<string, list<string>>
     */
    protected static array $familyAliases = [];

    public static function normalizeCategoryFamily(string $slug): string
    {
        return app(\App\Services\Catalog\ProductMappingService::class)->canonicalizeSlug($slug);
    }

    /**
     * @return list<string>
     */
    public static function categoryFilterSlugs(string $category): array
    {
        return app(\App\Services\Catalog\ProductMappingService::class)->filterSlugs($category);
    }

    public static function familyFromProduct(Product $product): string
    {
        if (!$product->relationLoaded('category')) {
            $product->loadMissing('category');
        }

        return self::normalizeCategoryFamily((string) ($product->category?->slug ?? ''));
    }

    /**
     * Strip provider-specific words, collapse space, lower-case, strip punctuation noise.
     */
    public static function normalizeName(string $name): string
    {
        $value = Str::lower(trim($name));
        $value = preg_replace('/[^\p{L}\p{N}\s.]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;

        $tokens = preg_split('/\s+/u', $value, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $kept = [];
        foreach ($tokens as $token) {
            $t = trim($token, ". \t\n\r\0\x0B");
            if ($t === '' || in_array($t, self::$noiseWords, true)) {
                continue;
            }
            // Skip standalone "voucher nominal" style already covered by noise list.
            $kept[] = $t;
        }

        return trim(implode(' ', $kept));
    }

    /**
     * Extract numeric denomination from Indonesian-style amounts.
     * "Telkomsel 5.000" → 5000, "Telkomsel Pulsa 100.000" → 100000.
     */
    public static function extractDenomination(string $name): ?int
    {
        $candidates = [];

        // Indonesian thousands: 5.000 / 100.000 / 1.000.000
        if (preg_match_all('/\b(\d{1,3}(?:\.\d{3})+)\b/u', $name, $m)) {
            foreach ($m[1] as $raw) {
                $n = (int) str_replace('.', '', $raw);
                if ($n > 0) {
                    $candidates[] = $n;
                }
            }
        }

        // Plain integers ≥ 1000 (avoid catching "3" from Tri branding alone)
        if (preg_match_all('/\b(\d{4,})\b/u', $name, $m2)) {
            foreach ($m2[1] as $raw) {
                $n = (int) $raw;
                if ($n > 0) {
                    $candidates[] = $n;
                }
            }
        }

        if ($candidates === []) {
            return null;
        }

        // Prefer the largest currency-like amount (denomination, not tiny extras).
        return max($candidates);
    }

    /**
     * Group key: category family + operator brand id + denomination (or normalized name).
     */
    public static function groupKey(Product $product): string
    {
        if (!$product->relationLoaded('category')) {
            $product->loadMissing('category');
        }
        if (!$product->relationLoaded('provider')) {
            $product->loadMissing('provider');
        }

        $family = self::familyFromProduct($product);
        $operatorId = (int) ($product->provider_id ?? 0);
        $denom = self::extractDenomination((string) $product->name);

        if ($denom !== null) {
            $tertiary = 'd:' . $denom;
        } else {
            $tertiary = 'n:' . self::normalizeName((string) $product->name);
        }

        return $family . '|' . $operatorId . '|' . $tertiary;
    }

    public static function operatorSortKey(Product $product): string
    {
        if (!$product->relationLoaded('provider')) {
            $product->loadMissing('provider');
        }

        return Str::lower(trim((string) ($product->provider?->name ?? '')));
    }

    /**
     * Sort tuple: [categoryAsc, operatorAsc, denomAsc (PHP_INT_MAX if missing), nameAsc, idAsc].
     *
     * @return array{0:string,1:string,2:int,3:string,4:int}
     */
    public static function sortTuple(Product $product): array
    {
        $family = self::familyFromProduct($product);
        $denom = self::extractDenomination((string) $product->name);

        return [
            $family,
            self::operatorSortKey($product),
            $denom ?? PHP_INT_MAX,
            self::normalizeName((string) $product->name),
            (int) $product->id,
        ];
    }

    /**
     * Whether two products share the same logical catalog identity.
     */
    public static function sameLogicalProduct(Product $a, Product $b): bool
    {
        return self::groupKey($a) === self::groupKey($b);
    }
}
