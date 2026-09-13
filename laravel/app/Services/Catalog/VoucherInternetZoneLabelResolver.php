<?php

namespace App\Services\Catalog;

/**
 * Derives products.zone_label for Telkomsel regional SKUs.
 * Used by voucher-internet and sms-telepon (audit Item 9).
 * null = national / no regional gate (Umum, marketing, non-geographic Digi types).
 */
class VoucherInternetZoneLabelResolver
{
    public const CATEGORY_SLUG = 'voucher-internet';

    /** @var list<string> */
    public const SMS_CATEGORY_SLUGS = ['sms-telepon', 'paket-sms-telpon'];

    public function appliesToCategorySlug(?string $slug): bool
    {
        $s = (string) $slug;

        return $s === self::CATEGORY_SLUG || $this->isSmsCategorySlug($s);
    }

    public function isSmsCategorySlug(?string $slug): bool
    {
        return in_array((string) $slug, self::SMS_CATEGORY_SLUGS, true);
    }

    public function normalize(?string $raw, ?string $productName = null): ?string
    {
        if ($productName !== null && stripos($productName, 'GamesMAX') !== false) {
            return null;
        }

        $label = trim((string) ($raw ?? ''));
        if ($label === '' || strcasecmp($label, 'Umum') === 0) {
            return null;
        }

        if (stripos($label, 'GamesMAX') !== false) {
            return null;
        }

        return $label;
    }

    /**
     * SMS Digi types include many non-geo labels (Telepon Pas, Spesial, …).
     * Only keep labels that look geographic so they do not flood Wilayah Lainnya.
     */
    public function looksGeographic(string $label): bool
    {
        $hay = strtolower($label);
        $hints = [
            'sumatera', 'sumatra', 'jawa', 'jabodetabek', 'jabo', 'jabar', 'jateng', 'jatim',
            'kalimantan', 'sulawesi', 'bali', 'nusa', 'lombok', 'papua', 'maluku', 'zona',
            'sukabumi', 'bogor', 'banten', 'ntt', 'ntb', 'kalsul', 'wilayah',
        ];
        foreach ($hints as $hint) {
            if (str_contains($hay, $hint)) {
                return true;
            }
        }

        return false;
    }

    public function fromVipProviderMeta(?array $meta, ?string $productName = null, ?string $categorySlug = null): ?string
    {
        if (! is_array($meta)) {
            return null;
        }

        return $this->fromDigiflazzType($meta['category'] ?? null, $productName, $categorySlug);
    }

    public function fromDigiflazzType(?string $type, ?string $productName = null, ?string $categorySlug = null): ?string
    {
        $normalized = $this->normalize($type, $productName);
        if ($normalized === null) {
            return null;
        }

        // SMS: drop non-geographic Digi types (Telepon Pas, Umroh, …) → Nasional path.
        if ($this->isSmsCategorySlug($categorySlug) && ! $this->looksGeographic($normalized)) {
            return null;
        }

        return $normalized;
    }
}
