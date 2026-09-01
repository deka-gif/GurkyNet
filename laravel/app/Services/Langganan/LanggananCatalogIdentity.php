<?php

namespace App\Services\Langganan;

use App\Models\Product;
use App\Services\ProductProviders\LogicalProductKey;
use Illuminate\Support\Str;

/**
 * Langganan Digital — canonical catalog identity for PRIMARY Digiflazz + FALLBACK VIP merge.
 * Groups equivalent subscription products across providers by brand + business variant (not provider SKU).
 */
class LanggananCatalogIdentity
{
    public const FAMILY = 'langganan-digital';

    /**
     * @var list<string>
     */
    protected static array $noiseWords = [
        'wallet',
        'code',
        'voucher',
        'digital',
        'subscription',
        'langganan',
        'member',
        'membership',
        'paket',
        'topup',
        'top',
        'up',
        'isi',
        'ulang',
        'aktivasi',
        'activation',
        'premium',
        'platinum',
        'standard',
        'basic',
        'pro',
        'family',
        'bulan',
        'hari',
        'day',
        'days',
        'month',
        'months',
        'minggu',
        'week',
        'tahun',
        'year',
    ];

    public static function isLanggananProduct(Product $product): bool
    {
        return LogicalProductKey::familyFromProduct($product) === self::FAMILY;
    }

    /**
     * Canonical group key: langganan-digital|{operator_id}|{variant}.
     */
    public static function groupKey(Product $product): string
    {
        $product->loadMissing(['category', 'provider']);

        $operatorId = (int) ($product->provider_id ?? 0);
        $brand = trim((string) ($product->provider?->name ?? ''));
        $name = trim((string) $product->name);

        $variant = self::extractVariantKey($name, $brand);

        return self::FAMILY . '|' . $operatorId . '|' . $variant;
    }

    public static function sameIdentity(Product $a, Product $b): bool
    {
        return self::groupKey($a) === self::groupKey($b);
    }

    /**
     * Business variant key — currency amount, duration+tier, or normalized name.
     */
    public static function extractVariantKey(string $name, string $brandName = ''): string
    {
        $currency = self::extractCurrencyAmount($name);
        if ($currency !== null) {
            return 'cur:' . $currency;
        }

        $duration = self::extractDurationDays($name);
        if ($duration !== null) {
            $tier = self::extractTierToken($name);
            if ($tier !== '') {
                return 'dur:' . $duration . ':t:' . $tier;
            }

            return 'dur:' . $duration;
        }

        return 'n:' . self::normalizeLanggananName($name, $brandName);
    }

    /**
     * e.g. MYR 5, USD 10, 5 MYR → myr:5
     */
    public static function extractCurrencyAmount(string $name): ?string
    {
        if (preg_match('/\b(myr|usd|sgd|eur|gbp|idr|rm)\s*(\d+(?:[.,]\d+)?)\b/ui', $name, $m)) {
            $cur = strtolower($m[1] === 'rm' ? 'myr' : $m[1]);
            $amt = self::normalizeAmount($m[2]);

            return $cur . ':' . $amt;
        }

        if (preg_match('/\b(\d+(?:[.,]\d+)?)\s*(myr|usd|sgd|eur|gbp|idr|rm)\b/ui', $name, $m)) {
            $cur = strtolower($m[2] === 'rm' ? 'myr' : $m[2]);
            $amt = self::normalizeAmount($m[1]);

            return $cur . ':' . $amt;
        }

        return null;
    }

    /**
     * Normalize duration to days for grouping (1 bulan → 30, 12 bulan → 365).
     */
    public static function extractDurationDays(string $name): ?int
    {
        $hay = Str::lower($name);

        if (preg_match('/\b(\d+)\s*(hari|day|days)\b/u', $hay, $m)) {
            return max(1, (int) $m[1]);
        }

        if (preg_match('/\b(\d+)\s*(minggu|week|weeks)\b/u', $hay, $m)) {
            return max(1, (int) $m[1]) * 7;
        }

        if (preg_match('/\b(\d+)\s*(bulan|month|months|bln)\b/u', $hay, $m)) {
            return max(1, (int) $m[1]) * 30;
        }

        if (preg_match('/\b(\d+)\s*(tahun|year|years|thn)\b/u', $hay, $m)) {
            return max(1, (int) $m[1]) * 365;
        }

        return null;
    }

    public static function extractTierToken(string $name): string
    {
        $hay = Str::lower($name);
        foreach (['platinum', 'premium', 'standard', 'basic', 'pro', 'family', 'plus'] as $tier) {
            if (preg_match('/\b' . preg_quote($tier, '/') . '\b/u', $hay)) {
                return $tier;
            }
        }

        return '';
    }

    public static function normalizeLanggananName(string $name, string $brandName = ''): string
    {
        $value = Str::lower(trim($name));
        if ($brandName !== '') {
            $brandNorm = Str::lower(trim($brandName));
            if ($brandNorm !== '' && str_starts_with($value, $brandNorm)) {
                $value = trim(substr($value, strlen($brandNorm)));
            }
        }

        $value = preg_replace('/[^\p{L}\p{N}\s.]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;

        $tokens = preg_split('/\s+/u', $value, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $kept = [];
        foreach ($tokens as $token) {
            $t = trim($token, ". \t\n\r\0\x0B");
            if ($t === '' || in_array($t, self::$noiseWords, true)) {
                continue;
            }
            $kept[] = $t;
        }

        return trim(implode(' ', $kept));
    }

    protected static function normalizeAmount(string $raw): string
    {
        $normalized = str_replace(',', '.', trim($raw));
        if (str_contains($normalized, '.')) {
            $normalized = rtrim(rtrim($normalized, '0'), '.');
        }

        return $normalized !== '' ? $normalized : '0';
    }
}
