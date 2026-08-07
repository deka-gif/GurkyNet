<?php

namespace App\Services\Website;

use Illuminate\Support\Facades\Cache;

class PublicLegalCache
{
    public const INDEX_KEY = 'public:legal:index:v1';

    public const DOC_KEY_PREFIX = 'public:legal:doc:';

    public const TTL_SECONDS = 300;

    public static function docKey(string $slug): string
    {
        return self::DOC_KEY_PREFIX.$slug;
    }

    public static function forget(): void
    {
        Cache::forget(self::INDEX_KEY);
        foreach (\App\Models\LegalDocument::catalog() as $item) {
            Cache::forget(self::docKey($item['slug']));
        }
        PublicHomepageCache::forget();
    }
}
