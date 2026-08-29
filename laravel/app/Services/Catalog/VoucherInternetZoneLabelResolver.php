<?php

namespace App\Services\Catalog;

/**
 * Derives products.zone_label for voucher-internet only (Telkomsel regional SKUs).
 * null = national / no regional gate (includes legacy "Umum" and non-data specials).
 */
class VoucherInternetZoneLabelResolver
{
    public const CATEGORY_SLUG = 'voucher-internet';

    public function appliesToCategorySlug(?string $slug): bool
    {
        return (string) $slug === self::CATEGORY_SLUG;
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

    public function fromVipProviderMeta(?array $meta, ?string $productName = null): ?string
    {
        if (! is_array($meta)) {
            return null;
        }

        return $this->normalize($meta['category'] ?? null, $productName);
    }

    public function fromDigiflazzType(?string $type, ?string $productName = null): ?string
    {
        return $this->normalize($type, $productName);
    }
}
