<?php

namespace App\Services\Catalog;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use Illuminate\Validation\ValidationException;

/**
 * Digiflazz splits telco vouchers into two prepaid categories that must not be mixed:
 * - "Voucher" → Tembak (MSISDN) + Elektronik (e-code)
 * - "Aktivasi Voucher" → Fisik blank-card serial activation only
 *
 * GurkyNet CF slug remains voucher-internet; mode filters + purchase gates use Digi category.
 */
class VoucherInternetDigiCategoryGate
{
    public const DIGI_VOUCHER = 'Voucher';

    public const DIGI_AKTIVASI_VOUCHER = 'Aktivasi Voucher';

    public const MODE_TEMBAK = 'tembak';

    public const MODE_ELEKTRONIK = 'elektronik';

    public const MODE_FISIK = 'fisik';

    /**
     * @return list<string>
     */
    public function digiCategoriesForMode(string $mode): array
    {
        $normalized = $this->normalizeMode($mode);
        if ($normalized === self::MODE_FISIK) {
            return [self::DIGI_AKTIVASI_VOUCHER];
        }

        if (in_array($normalized, [self::MODE_TEMBAK, self::MODE_ELEKTRONIK], true)) {
            return [self::DIGI_VOUCHER];
        }

        throw ValidationException::withMessages([
            'vi_mode' => ['Mode voucher internet tidak valid. Gunakan tembak, elektronik, atau fisik.'],
        ]);
    }

    /**
     * Resolve Digiflazz category for a master product (preferred Digi PPS SKU, else sku_code).
     */
    public function resolveDigiCategory(Product $product): ?string
    {
        $product->loadMissing(['providerSkus']);

        $codes = [];
        foreach ($product->providerSkus as $pps) {
            if (! $pps->is_active) {
                continue;
            }
            $code = trim((string) $pps->provider_sku);
            if ($code !== '') {
                $codes[] = $code;
            }
        }
        $fallback = trim((string) $product->sku_code);
        if ($fallback !== '') {
            $codes[] = $fallback;
        }
        $codes = array_values(array_unique($codes));
        if ($codes === []) {
            return null;
        }

        $rows = DigiflazzProduct::query()
            ->whereIn('buyer_sku_code', $codes)
            ->get(['buyer_sku_code', 'category']);

        if ($rows->isEmpty()) {
            return null;
        }

        // Prefer preferred Digi PPS mapping when present.
        $preferred = $product->providerSkus
            ->first(fn ($pps) => $pps->is_active && $pps->is_preferred);
        if ($preferred) {
            $hit = $rows->firstWhere('buyer_sku_code', $preferred->provider_sku);
            if ($hit) {
                return $this->normalizeDigiCategory((string) $hit->category);
            }
        }

        $first = $rows->first();

        return $first ? $this->normalizeDigiCategory((string) $first->category) : null;
    }

    public function normalizeDigiCategory(string $category): string
    {
        $c = strtolower(trim($category));
        if ($c === 'aktivasi voucher') {
            return self::DIGI_AKTIVASI_VOUCHER;
        }
        if ($c === 'voucher') {
            return self::DIGI_VOUCHER;
        }

        return trim($category);
    }

    public function normalizeMode(string $mode): string
    {
        return strtolower(trim($mode));
    }

    public function isVoucherInternetProduct(Product $product): bool
    {
        $product->loadMissing('category');

        return ($product->category?->slug ?? '') === 'voucher-internet';
    }

    /**
     * POST /transactions (Tembak + Elektronik) — Digi Aktivasi Voucher is forbidden.
     */
    public function assertAllowedForSinglePurchase(Product $product): void
    {
        if (! $this->isVoucherInternetProduct($product)) {
            return;
        }

        $digi = $this->resolveDigiCategory($product);
        if ($digi === null) {
            throw ValidationException::withMessages([
                'sku_code' => [
                    'Kategori Digiflazz untuk produk voucher internet ini tidak ditemukan. Silakan pilih produk lain atau sinkronkan katalog.',
                ],
            ]);
        }

        if ($digi === self::DIGI_AKTIVASI_VOUCHER) {
            throw ValidationException::withMessages([
                'sku_code' => [
                    'SKU Aktivasi Voucher hanya untuk mode Voucher Fisik (kartu kosongan). Gunakan mode Fisik atau pilih produk kategori Voucher.',
                ],
            ]);
        }

        if ($digi !== self::DIGI_VOUCHER) {
            throw ValidationException::withMessages([
                'sku_code' => [
                    'Produk ini bukan kategori Digiflazz Voucher yang didukung untuk Tembak/Elektronik.',
                ],
            ]);
        }
    }

    /**
     * POST /voucher-internet/physical-batches — Digi Voucher (non-Aktivasi) is forbidden.
     */
    public function assertAllowedForPhysicalBatch(Product $product): void
    {
        if (! $this->isVoucherInternetProduct($product)) {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk ini bukan kategori Voucher Internet.'],
            ]);
        }

        $digi = $this->resolveDigiCategory($product);
        if ($digi === null) {
            throw ValidationException::withMessages([
                'sku_code' => [
                    'Kategori Digiflazz untuk produk voucher fisik ini tidak ditemukan. Silakan pilih produk Aktivasi Voucher atau sinkronkan katalog.',
                ],
            ]);
        }

        if ($digi !== self::DIGI_AKTIVASI_VOUCHER) {
            throw ValidationException::withMessages([
                'sku_code' => [
                    'Voucher Fisik hanya menerima SKU Digiflazz kategori Aktivasi Voucher. SKU Voucher biasa tidak dapat dipakai untuk nomor seri kartu fisik.',
                ],
            ]);
        }
    }
}
