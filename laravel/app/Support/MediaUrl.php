<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Builds absolute, CDN-ready media URLs for Website / Android / iOS / PWA clients.
 *
 * Contract:
 * - Database stores a disk-relative path (e.g. "general/uuid.png"), never a host.
 * - Legacy rows that already contain absolute /storage URLs are normalized on read.
 * - CDN_URL wins when set; otherwise APP_URL / current API request host is used.
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
        if ($base === '') {
            // Last resort: root-relative path (same-origin API + SPA only).
            return '/storage/' . $relative;
        }

        return $base . '/storage/' . $relative;
    }

    /**
     * Normalize any stored media value to a public-disk relative path.
     * Examples:
     *   general/a.png
     *   /storage/general/a.png
     *   https://host/storage/general/a.png
     *   http://127.0.0.1:9000/storage/general/a.png
     */
    public static function toDiskRelativePath(string $url): string
    {
        $url = trim($url);

        if (preg_match('#https?://[^/]+/storage/(.+)$#i', $url, $matches)) {
            return ltrim($matches[1], '/');
        }

        if (Str::startsWith($url, '/storage/')) {
            return ltrim(Str::after($url, '/storage/'), '/');
        }

        if (Str::startsWith($url, 'storage/')) {
            return ltrim(Str::after($url, 'storage/'), '/');
        }

        // Reject accidental filesystem absolute paths.
        if (Str::startsWith($url, ['/', '\\']) || preg_match('#^[A-Za-z]:\\\\#', $url)) {
            return ltrim(str_replace('\\', '/', $url), '/');
        }

        return ltrim($url, '/');
    }

    /**
     * Public origin that actually serves /storage (API host).
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
