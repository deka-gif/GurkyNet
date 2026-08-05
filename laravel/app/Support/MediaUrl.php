<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Builds absolute, CDN-ready media URLs for Website / Android / iOS / PWA clients.
 */
class MediaUrl
{
    public static function absolute(?string $url, ?string $disk = null): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }

        if (Str::startsWith($url, ['http://', 'https://', 'data:'])) {
            $cdn = rtrim((string) config('filesystems.cdn_url', env('CDN_URL', '')), '/');
            $appUrl = rtrim((string) config('app.url'), '/');

            // Rewrite local storage URLs to CDN when configured.
            if ($cdn !== '' && $appUrl !== '' && Str::startsWith($url, $appUrl . '/storage')) {
                return $cdn . Str::after($url, $appUrl . '/storage');
            }

            return $url;
        }

        $diskName = $disk ?: config('filesystems.default_public_disk', 'public');
        $cdn = rtrim((string) config('filesystems.cdn_url', env('CDN_URL', '')), '/');

        if (Str::startsWith($url, '/storage/')) {
            $path = ltrim(Str::after($url, '/storage/'), '/');
            if ($cdn !== '') {
                return $cdn . '/' . $path;
            }

            return rtrim((string) config('app.url'), '/') . '/storage/' . $path;
        }

        if (Str::startsWith($url, '/')) {
            return rtrim((string) config('app.url'), '/') . $url;
        }

        try {
            $generated = Storage::disk($diskName)->url($url);
            return self::absolute($generated, $diskName);
        } catch (\Throwable) {
            $base = $cdn !== '' ? $cdn : rtrim((string) config('app.url'), '/') . '/storage';
            return $base . '/' . ltrim($url, '/');
        }
    }
}
