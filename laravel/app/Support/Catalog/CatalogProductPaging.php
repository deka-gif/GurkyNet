<?php

namespace App\Support\Catalog;

/**
 * Customer catalog product-list paging policy (providers-first optimization).
 * Threshold and page size are Owner-approved (2026-09-13) — do not change silently.
 */
final class CatalogProductPaging
{
    /** Paginate only when catalog total (after visibility) exceeds this. */
    public const THRESHOLD = 30;

    /** Page size when pagination is active. */
    public const PAGE_SIZE = 20;

    public static function shouldPaginate(int $totalAfterVisibility): bool
    {
        return $totalAfterVisibility > self::THRESHOLD;
    }
}
