<?php

namespace App\Services\Catalog;

use Illuminate\Support\Str;

/**
 * Canonicalize Indonesian telecom operator brand strings from Digiflazz / VIPayment
 * before persisting `providers` rows — mirrors VoucherBrandResolver / EwalletBrandResolver.
 *
 * Whitelist only (no fuzzy matching). Different commercial brands (XL vs AXIS) must
 * never collapse into one row.
 */
class TelecomOperatorBrandResolver
{
    /**
     * @var list<string>
     */
    public const TELECOM_CATEGORY_SLUGS = [
        'pulsa',
        'data',
        'voucher-internet',
        'sms-telepon',
        'masa-aktif',
        'aktivasi-perdana',
    ];

    /**
     * Exact brand string (lower-case) => canonical display name.
     *
     * @var array<string, string>
     */
    protected const EXACT_ALIASES = [
        'smart' => 'Smartfren',
        'smarfren' => 'Smartfren',
        'tsel' => 'Telkomsel',
        'tri' => 'Tri',
        'three' => 'Tri',
        'xl' => 'XL',
        'axis' => 'AXIS',
        'im3' => 'Indosat',
        'mentari' => 'Indosat',
        'by.u' => 'by.U',
        'byu' => 'by.U',
    ];

    /**
     * Substring needles (lower-case, longest first) => canonical name.
     *
     * @var array<string, string>
     */
    protected const SUBSTRING_ALIASES = [
        'telkomsel' => 'Telkomsel',
        'smartfren' => 'Smartfren',
        'indosat' => 'Indosat',
    ];

    public function appliesToCategory(string $categorySlug): bool
    {
        return in_array($categorySlug, self::TELECOM_CATEGORY_SLUGS, true);
    }

    public function resolve(string $rawBrand, string $productName = ''): ?string
    {
        $hayBrand = Str::lower(trim($rawBrand));
        if ($hayBrand !== '') {
            if (isset(self::EXACT_ALIASES[$hayBrand])) {
                return self::EXACT_ALIASES[$hayBrand];
            }

            $needles = self::SUBSTRING_ALIASES;
            uksort($needles, fn (string $a, string $b) => strlen($b) <=> strlen($a));
            foreach ($needles as $needle => $canonical) {
                if (str_contains($hayBrand, $needle)) {
                    return $canonical;
                }
            }
        }

        $hayName = Str::lower(trim($productName));
        if ($hayName === '') {
            return null;
        }

        foreach (self::EXACT_ALIASES as $needle => $canonical) {
            if (preg_match('/\b'.preg_quote($needle, '/').'\b/u', $hayName) === 1) {
                return $canonical;
            }
        }

        $needles = self::SUBSTRING_ALIASES;
        uksort($needles, fn (string $a, string $b) => strlen($b) <=> strlen($a));
        foreach ($needles as $needle => $canonical) {
            if (str_contains($hayName, $needle)) {
                return $canonical;
            }
        }

        return null;
    }
}
