<?php

namespace App\Services\ProductProviders;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

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
        $previous = self::version();

        try {
            // Always advance version even when multiple bumps occur in the same second.
            Cache::forever(self::VERSION_KEY, max(time(), $previous + 1));

            try {
                Cache::tags(['products', 'active_products'])->flush();
            } catch (\BadMethodCallException) {
                // File/array drivers do not support tags.
            }

            // Drop legacy + previous versioned keys so User Dashboard never serves stale catalog.
            Cache::forget('products_active_all');
            Cache::forget('products_active_all_v'.$previous);
            Cache::forget(self::activeAllKey());
        } catch (\Throwable $e) {
            // Cache driver permission issues must not fail catalog sync (post-upsert).
            Log::warning('Product catalog cache bump unavailable — continuing without invalidation', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    public static function searchKey(array $filters): string
    {
        return 'products_search_v'.self::version().'_'.md5(serialize($filters));
    }

    public static function activeAllKey(): string
    {
        return 'products_active_all_v'.self::version();
    }
}
