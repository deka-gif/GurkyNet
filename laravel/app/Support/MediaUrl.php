<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Builds absolute, CDN-ready media URLs for Website / Android / iOS / PWA clients.
 *
 * Contract:
 * - Database stores a disk-relative path (e.g. "general/uuid.png"), never a host.
 * - Legacy rows that already contain absolute /storage or /api/.../media URLs are normalized on read.
 * - CDN_URL wins when set; otherwise files are served through the Laravel API media route
 *   so SPA catch-all hosts (serving index.html for /storage/*) still display images.
 */
class MediaUrl
{
    public static function absolute(?string $url, ?string $disk = null): ?string
    {
        if ($url === null || trim($url) === '') {
            return null;
        }

        $url = trim($url);

        if (Str::startsWith($url, 'data:')) {
            return $url;
        }

        $relative = self::toDiskRelativePath($url);
        if ($relative === '') {
            return null;
        }

        $cdn = rtrim((string) config('filesystems.cdn_url', env('CDN_URL', '')), '/');
        if ($cdn !== '') {
            return $cdn . '/' . $relative;
        }

        $base = self::publicBaseUrl();
        $prefix = self::publicDeliveryPrefix();

        if ($base === '') {
            return $prefix . '/' . $relative;
        }

        return $base . $prefix . '/' . $relative;
    }

    /**
     * Public path prefix that actually reaches Laravel (not the SPA index.html).
     * Default: /api/v1/public/media
     */
    public static function publicDeliveryPrefix(): string
    {
        $prefix = (string) config(
            'filesystems.media_delivery_path',
            env('MEDIA_DELIVERY_PATH', '/api/v1/public/media')
        );

        $prefix = '/' . trim($prefix, '/');

        return $prefix === '/' ? '/api/v1/public/media' : $prefix;
    }

    /**
     * Normalize any stored media value to a public-disk relative path.
     * Examples:
     *   general/a.png
     *   /storage/general/a.png
     *   /api/v1/public/media/general/a.png
     *   https://host/storage/general/a.png
     *   https://host/api/v1/public/media/general/a.png
     */
    public static function toDiskRelativePath(string $url): string
    {
        $url = trim($url);

        if (preg_match('#https?://[^/]+(/.*)$#i', $url, $matches)) {
            $url = $matches[1];
        }

        $delivery = self::publicDeliveryPrefix();
        if (Str::startsWith($url, $delivery . '/')) {
            return ltrim(Str::after($url, $delivery . '/'), '/');
        }
        if (Str::startsWith($url, $delivery)) {
            return ltrim(Str::after($url, $delivery), '/');
        }

        // Legacy symlink path
        if (Str::startsWith($url, '/storage/')) {
            return ltrim(Str::after($url, '/storage/'), '/');
        }
        if (Str::startsWith($url, 'storage/')) {
            return ltrim(Str::after($url, 'storage/'), '/');
        }

        // Common API media path even if config prefix differs
        if (preg_match('#/api/v1/public/media/(.+)$#i', $url, $matches)) {
            return ltrim($matches[1], '/');
        }

        // Reject accidental filesystem absolute paths.
        if (Str::startsWith($url, ['/', '\\']) || preg_match('#^[A-Za-z]:\\\\#', $url)) {
            return ltrim(str_replace('\\', '/', $url), '/');
        }

        return ltrim($url, '/');
    }

    /**
     * Public origin that serves the API (and therefore /api/v1/public/media).
     * Prefer the current HTTP request host so a mismatched APP_URL cannot break thumbnails.
     */
    public static function publicBaseUrl(): string
    {
        $cdn = rtrim((string) config('filesystems.cdn_url', env('CDN_URL', '')), '/');
        if ($cdn !== '') {
            return $cdn;
        }

        try {
            if (app()->bound('request')) {
                $request = request();
                // A real HTTP call (or a test that binds one) always has a Host header.
                // Console/queue without a bound request falls through to APP_URL.
                if ($request && $request->headers->has('HOST')) {
                    $host = $request->getSchemeAndHttpHost();
                    if (is_string($host) && $host !== '') {
                        return rtrim($host, '/');
                    }
                }
            }
        } catch (\Throwable) {
            // Fall through to APP_URL.
        }

        return rtrim((string) config('app.url', ''), '/');
    }
}
