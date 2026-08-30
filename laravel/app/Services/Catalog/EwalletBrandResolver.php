<?php

namespace App\Services\Catalog;

use Illuminate\Support\Str;

/**
 * Digiflazz/VIP report a generic brand ("E-MONEY"/"EMONEY") for cross-wallet
 * "Bebas Nominal" SKUs. The real wallet is only visible in the product name
 * ("Dana Bebas Nominal", "Gopay Bebas Nominal", ...). Mirrors EsimCountryResolver:
 * resolve the true brand from the name instead of trusting the generic label.
 */
class EwalletBrandResolver
{
    /** Generic brand labels that must NOT be used as the Provider name as-is. */
    protected const GENERIC_BRANDS = ['e-money', 'emoney', 'e money', 'ewallet', 'e-wallet'];

    /** Known wallet keyword → canonical display name. Keep in sync with
     *  config('gurky_catalog.brand_overrides') wallet entries. Longest keys first
     *  isn't required here since we take the first match found in the name, but we
     *  still order the more specific multi-word entries before their substrings. */
    protected const WALLET_NAMES = [
        'shopeepay' => 'ShopeePay',
        'shopee pay' => 'ShopeePay',
        'gopay' => 'GoPay',
        'gojek' => 'GoPay',
        'ovo' => 'OVO',
        'dana' => 'DANA',
        'linkaja' => 'LinkAja',
        'link aja' => 'LinkAja',
        'astrapay' => 'AstraPay',
        'grabpay' => 'GrabPay',
        'grab' => 'GrabPay',
        'maxim' => 'Maxim',
        'isaku' => 'i.saku',
        'sakuku' => 'Sakuku',
        'doku' => 'DOKU',
        'paytren' => 'Paytren',
    ];

    public function isGenericBrand(string $brand): bool
    {
        $b = Str::lower(trim($brand));

        return in_array($b, self::GENERIC_BRANDS, true);
    }

    /**
     * Returns the resolved wallet display name, or null if none of the known
     * wallet keywords appear in the product name (caller should keep the
     * original brand in that case rather than guessing).
     */
    public function extractWallet(string $productName): ?string
    {
        $hay = Str::lower(trim($productName));
        if ($hay === '') {
            return null;
        }

        foreach (self::WALLET_NAMES as $needle => $displayName) {
            if (str_contains($hay, $needle)) {
                return $displayName;
            }
        }

        return null;
    }
}
