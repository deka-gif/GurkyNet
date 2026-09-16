<?php

namespace App\Services\Website;

use Illuminate\Support\Facades\Cache;

/**
 * Public CMS cache keys + TTLs (Sprint 7.3).
 * Homepage 5m · Settings/Menu/Static pages 30m · cleared immediately on Marketing save.
 *
 * Paket cold-load: keep a longer-lived STALE snapshot so Marketing invalidation
 * does not force every guest to wait for a full rebuild. Catalog buckets use a
 * separate key that survives CMS edits (only product sync should bust it).
 */
class PublicHomepageCache
{
    public const KEY = 'public:homepage:v2';

    public const STALE_KEY = 'public:homepage:v2:stale';

    public const CATALOG_KEY = 'public:homepage:catalog:v1';

    public const SETTINGS_KEY = 'public:website:settings';

    public const MENUS_KEY = 'public:website:menus';

    public const PAGES_KEY = 'public:website:static-pages';

    /** Homepage aggregate — 5 minutes */
    public const TTL_SECONDS = 300;

    /** Stale snapshot kept after invalidation — serve instantly while rebuilding */
    public const STALE_TTL_SECONDS = 3600;

    /** Catalog preview buckets — 15 minutes (independent of CMS edits) */
    public const CATALOG_TTL_SECONDS = 900;

    /** Website settings / menus / static pages — 30 minutes */
    public const SETTINGS_TTL_SECONDS = 1800;

    public const MENUS_TTL_SECONDS = 1800;

    public const PAGES_TTL_SECONDS = 1800;

    /**
     * Cache-aside with lock + stale-while-revalidate.
     * Fast path avoids lock. After Marketing forget, STALE_KEY lets guests
     * paint immediately while one worker rebuilds KEY.
     */
    public static function remember(callable $callback): mixed
    {
        $cached = Cache::get(self::KEY);
        if ($cached !== null) {
            return $cached;
        }

        $stale = Cache::get(self::STALE_KEY);
        if ($stale !== null) {
            self::rebuildAfterResponse($callback);

            return $stale;
        }

        $lock = Cache::lock(self::KEY.':build', 120);

        try {
            return $lock->block(25, function () use ($callback) {
                $cached = Cache::get(self::KEY);
                if ($cached !== null) {
                    return $cached;
                }

                $stale = Cache::get(self::STALE_KEY);
                if ($stale !== null) {
                    self::rebuildAfterResponse($callback);

                    return $stale;
                }

                return self::storeFresh($callback());
            });
        } catch (\Illuminate\Contracts\Cache\LockTimeoutException) {
            $cached = Cache::get(self::KEY);
            if ($cached !== null) {
                return $cached;
            }

            $stale = Cache::get(self::STALE_KEY);
            if ($stale !== null) {
                return $stale;
            }

            // Last resort if lock holder is stuck — avoid failing the public homepage.
            return Cache::remember(self::KEY, self::TTL_SECONDS, function () use ($callback) {
                $value = $callback();
                Cache::put(self::STALE_KEY, $value, self::STALE_TTL_SECONDS);

                return $value;
            });
        }
    }

    public static function rememberCatalog(callable $callback): mixed
    {
        return Cache::remember(self::CATALOG_KEY, self::CATALOG_TTL_SECONDS, $callback);
    }

    public static function rememberSettings(callable $callback): mixed
    {
        return Cache::remember(self::SETTINGS_KEY, self::SETTINGS_TTL_SECONDS, $callback);
    }

    public static function rememberMenus(callable $callback): mixed
    {
        return Cache::remember(self::MENUS_KEY, self::MENUS_TTL_SECONDS, $callback);
    }

    public static function rememberPages(callable $callback): mixed
    {
        return Cache::remember(self::PAGES_KEY, self::PAGES_TTL_SECONDS, $callback);
    }

    /** Clear keys only — use CmsSyncService::publish for full live-sync pipeline. */
    public static function forgetCachesOnly(): void
    {
        $current = Cache::get(self::KEY);
        if ($current !== null) {
            Cache::put(self::STALE_KEY, $current, self::STALE_TTL_SECONDS);
        }

        // Also migrate any leftover v1 snapshot into stale for one deploy window.
        $legacy = Cache::get('public:homepage:v1');
        if ($legacy !== null && Cache::get(self::STALE_KEY) === null) {
            Cache::put(self::STALE_KEY, $legacy, self::STALE_TTL_SECONDS);
        }

        Cache::forget(self::KEY);
        Cache::forget('public:homepage:v1');
        Cache::forget(self::SETTINGS_KEY);
        Cache::forget(self::MENUS_KEY);
        Cache::forget(self::PAGES_KEY);
        // Intentionally keep CATALOG_KEY — CMS copy edits must not rebuild 9 product searches.
    }

    /** Bust catalog preview when product catalog changes. */
    public static function forgetCatalog(): void
    {
        Cache::forget(self::CATALOG_KEY);
    }

    /**
     * Backward-compatible entrypoint used across Marketing actions.
     * Clears cache + bumps CMS revision (live sync).
     */
    public static function forget(?string $scope = null, ?string $reason = null): void
    {
        CmsSyncService::publish(
            [$scope ?: CmsSyncService::SCOPE_HOMEPAGE],
            $reason
        );
    }

    protected static function storeFresh(mixed $value): mixed
    {
        Cache::put(self::KEY, $value, self::TTL_SECONDS);
        Cache::put(self::STALE_KEY, $value, self::STALE_TTL_SECONDS);

        return $value;
    }

    protected static function rebuildAfterResponse(callable $callback): void
    {
        $lock = Cache::lock(self::KEY.':build', 120);
        if (! $lock->get()) {
            return;
        }

        $runner = function () use ($callback, $lock) {
            try {
                if (Cache::get(self::KEY) !== null) {
                    return;
                }
                self::storeFresh($callback());
            } finally {
                $lock->release();
            }
        };

        try {
            dispatch($runner)->afterResponse();
        } catch (\Throwable) {
            // Environments without queue/afterResponse — rebuild inline once.
            $runner();
        }
    }
}
