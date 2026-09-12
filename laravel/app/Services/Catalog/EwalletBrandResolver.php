<?php

namespace App\Services\Catalog;

use App\Models\Product;
use Illuminate\Support\Str;

/**
 * Digiflazz/VIP report a generic brand ("E-MONEY"/"EMONEY") for cross-wallet
 * "Bebas Nominal" SKUs. The real wallet is only visible in the product name
 * ("Dana Bebas Nominal", "Gopay Bebas Nominal", ...). Mirrors EsimCountryResolver:
 * resolve the true brand from the name instead of trusting the generic label.
 *
 * Also canonicalizes spaced Digi brands ("GO PAY", "SHOPEE PAY") to one
 * customer-facing name so API/UI never show duplicate GoPay tiles.
 */
class EwalletBrandResolver
{
    /** Generic brand labels that must NOT be used as the Provider name as-is. */
    protected const GENERIC_BRANDS = ['e-money', 'emoney', 'e money', 'ewallet', 'e-wallet'];

    /** Known wallet keyword → canonical display name. Keep in sync with
     *  config('gurky_catalog.brand_overrides') wallet entries. */
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
     * Open-amount / Pascabayar Bebas Nominal SKU (not fixed prepaid denomination).
     */
    public function isOpenAmountProduct(Product|string $productOrName): bool
    {
        $name = $productOrName instanceof Product
            ? (string) $productOrName->name
            : (string) $productOrName;

        return (bool) preg_match('/bebas\s*nominal/iu', $name);
    }

    public function isCekNamaProduct(Product|string $productOrName): bool
    {
        $name = $productOrName instanceof Product
            ? (string) $productOrName->name
            : (string) $productOrName;

        return (bool) preg_match('/cek\s*nama/iu', $name);
    }

    /**
     * Returns the resolved wallet display name, or null if none of the known
     * wallet keywords appear. Matching is space/punctuation-insensitive so
     * "GO PAY" and "GoPay" collapse to the same canonical name.
     */
    public function extractWallet(string $productOrProviderName): ?string
    {
        $raw = trim($productOrProviderName);
        if ($raw === '') {
            return null;
        }

        $hay = Str::lower($raw);
        $hayCollapsed = $this->collapseKey($raw);

        foreach (self::WALLET_NAMES as $needle => $displayName) {
            if (str_contains($hay, $needle) || str_contains($hayCollapsed, $this->collapseKey($needle))) {
                return $displayName;
            }
        }

        return null;
    }

    /**
     * Canonical provider name for topup-digital sync / API grouping.
     */
    public function canonicalize(string $brand, ?string $productName = null): string
    {
        $brand = trim($brand);
        if ($brand === '') {
            return $brand;
        }

        if ($this->isGenericBrand($brand)) {
            $fromName = $productName !== null ? $this->extractWallet($productName) : null;

            return $fromName ?? $brand;
        }

        return $this->extractWallet($brand) ?? $this->extractWallet((string) $productName) ?? $brand;
    }

    /**
     * @return array{min_amount:int,max_amount:int}|null
     */
    public function openAmountLimitsForBrand(string $canonicalBrand): ?array
    {
        $limits = config('ewallet.open_amount_limits', []);
        if (! is_array($limits)) {
            return null;
        }

        $row = $limits[$canonicalBrand] ?? null;
        if (! is_array($row)) {
            return null;
        }

        $min = (int) ($row['min_amount'] ?? 0);
        $max = (int) ($row['max_amount'] ?? 0);
        if ($min <= 0 || $max < $min) {
            return null;
        }

        return [
            'min_amount' => $min,
            'max_amount' => $max,
        ];
    }

    /**
     * @return array{min_amount:int,max_amount:int}|null
     */
    public function openAmountLimitsForProduct(Product $product): ?array
    {
        if (! $this->isOpenAmountProduct($product)) {
            return null;
        }

        $product->loadMissing('provider');
        $canonical = $this->canonicalize(
            (string) ($product->provider?->name ?? ''),
            (string) $product->name
        );

        return $this->openAmountLimitsForBrand($canonical);
    }

    protected function collapseKey(string $value): string
    {
        return (string) preg_replace('/[^a-z0-9]+/', '', Str::lower($value));
    }
}
