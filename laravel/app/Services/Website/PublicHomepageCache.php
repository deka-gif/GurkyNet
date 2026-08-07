<?php

namespace App\Services\Website;

use Illuminate\Support\Facades\Cache;

/**
 * Public CMS cache keys + TTLs (Sprint 7.3).
 * Homepage 5m · Settings/Menu/Static pages 30m · cleared immediately on Marketing save.
 */
class PublicHomepageCache
{
    public const KEY = 'public:homepage:v1';

    public const SETTINGS_KEY = 'public:website:settings';

    public const MENUS_KEY = 'public:website:menus';

    public const PAGES_KEY = 'public:website:static-pages';

    /** Homepage aggregate — 5 minutes */
    public const TTL_SECONDS = 300;

    /** Website settings / menus / static pages — 30 minutes */
    public const SETTINGS_TTL_SECONDS = 1800;

    public const MENUS_TTL_SECONDS = 1800;

    public const PAGES_TTL_SECONDS = 1800;

    public static function remember(callable $callback): mixed
    {
        return Cache::remember(self::KEY, self::TTL_SECONDS, $callback);
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
        Cache::forget(self::KEY);
        Cache::forget(self::SETTINGS_KEY);
        Cache::forget(self::MENUS_KEY);
        Cache::forget(self::PAGES_KEY);
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
}
