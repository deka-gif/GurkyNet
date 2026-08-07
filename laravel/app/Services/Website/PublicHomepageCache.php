<?php

namespace App\Services\Website;

use Illuminate\Support\Facades\Cache;

/**
 * Public homepage aggregate cache (Sprint 7.1).
 * TTL 5 minutes; invalidate whenever Marketing/CMS mutates homepage-related data.
 */
class PublicHomepageCache
{
    public const KEY = 'public:homepage:v1';

    public const SETTINGS_KEY = 'public:website:settings';

    public const TTL_SECONDS = 300;

    public static function remember(callable $callback): mixed
    {
        return Cache::remember(self::KEY, self::TTL_SECONDS, $callback);
    }

    public static function forget(): void
    {
        Cache::forget(self::KEY);
        Cache::forget(self::SETTINGS_KEY);
    }
}
