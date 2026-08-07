<?php

namespace App\Services\Website;

use App\Events\CmsContentUpdated;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Marketing CMS live-sync (Sprint 7.3).
 *
 * Pipeline: Save DB → clear/regenerate cache → bump revision → broadcast event.
 * Public clients poll GET /public/cms-sync and refetch when revision changes.
 */
class CmsSyncService
{
    public const REVISION_KEY = 'cms:public:revision';

    public const META_KEY = 'cms:public:meta';

    public const SCOPE_SETTINGS = 'WebsiteSettingUpdated';

    public const SCOPE_HOMEPAGE = 'HomepageUpdated';

    public const SCOPE_MENU = 'MenuUpdated';

    public const SCOPE_BANNER = 'BannerUpdated';

    public const SCOPE_PROMOTION = 'PromotionUpdated';

    public const SCOPE_VOUCHER = 'VoucherUpdated';

    public const SCOPE_ANNOUNCEMENT = 'AnnouncementUpdated';

    public const SCOPE_STATIC_PAGE = 'StaticPageUpdated';

    public const SCOPE_LEGAL = 'LegalUpdated';

    /**
     * Clear public caches, bump revision, fire CMS event.
     *
     * @param  list<string>  $scopes
     */
    public static function publish(array $scopes, ?string $reason = null): array
    {
        $scopes = array_values(array_unique(array_filter($scopes)));

        PublicHomepageCache::forgetCachesOnly();
        PublicLegalCache::forgetCachesOnly();

        $revision = (int) Cache::increment(self::REVISION_KEY);
        if ($revision < 1) {
            $revision = 1;
            Cache::forever(self::REVISION_KEY, $revision);
        }

        $meta = [
            'revision' => $revision,
            'scopes' => $scopes,
            'reason' => $reason,
            'updatedAt' => now()->toIso8601String(),
        ];
        Cache::forever(self::META_KEY, $meta);

        try {
            event(new CmsContentUpdated($revision, $scopes, $reason));
        } catch (\Throwable $e) {
            Log::warning('CmsSyncService event failed', ['error' => $e->getMessage()]);
        }

        return $meta;
    }

    /**
     * Lightweight public sync payload for frontend polling.
     *
     * @return array{revision:int,scopes:list<string>,updatedAt:?string,reason:?string}
     */
    public static function status(): array
    {
        $meta = Cache::get(self::META_KEY);
        if (is_array($meta) && isset($meta['revision'])) {
            return [
                'revision' => (int) $meta['revision'],
                'scopes' => array_values($meta['scopes'] ?? []),
                'updatedAt' => $meta['updatedAt'] ?? null,
                'reason' => $meta['reason'] ?? null,
            ];
        }

        $revision = (int) Cache::get(self::REVISION_KEY, 0);

        return [
            'revision' => $revision,
            'scopes' => [],
            'updatedAt' => null,
            'reason' => null,
        ];
    }
}
