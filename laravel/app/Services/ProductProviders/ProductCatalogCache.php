<?php

namespace App\Services\ProductProviders;

use Illuminate\Support\Facades\Cache;

/**
 * Catalog cache versioning so Enable/Disable/Sync invalidate all product list caches
 * even when the cache driver does not support tags.
 */
class ProductCatalogCache
{
    public const VERSION_KEY = 'product_catalog_version';

    public static function version(): int
    {
        return (int) Cache::get(self::VERSION_KEY, 1);
    }

    public static function bump(): void
    {
        Cache::forever(self::VERSION_KEY, time());

        try {
            Cache::tags(['products', 'active_products'])->flush();
        } catch (\BadMethodCallException) {
            // File/array drivers do not support tags.
        }

        Cache::forget('products_active_all');
        Cache::forget('products_active_all_v' . self::version());
    }

    public static function searchKey(array $filters): string
    {
        return 'products_search_v' . self::version() . '_' . md5(serialize($filters));
    }

    public static function activeAllKey(): string
    {
        return 'products_active_all_v' . self::version();
    }
}
