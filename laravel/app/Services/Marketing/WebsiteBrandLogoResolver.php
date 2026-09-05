<?php

namespace App\Services\Marketing;

use App\Models\WebsiteSetting;
use Illuminate\Support\Facades\Storage;

/**
 * Resolve Marketing Website Settings logo to a local filesystem path for DomPDF.
 *
 * Source of truth: website_settings.logo_media_id → media (FR-MKT01 / FR-MKT04).
 * No PDF-specific logo store — Marketing CMS changes flow through automatically.
 */
class WebsiteBrandLogoResolver
{
    /**
     * Absolute readable path to the active light logo, or null when unavailable.
     */
    public function absolutePathForPdf(): ?string
    {
        $settings = WebsiteSetting::query()
            ->with('logoMedia')
            ->latest('id')
            ->first();

        if (! $settings) {
            return null;
        }

        if ($settings->logoMedia) {
            $relative = $settings->logoMedia->diskPath();
            $disk = $settings->logoMedia->storage_disk ?: 'public';
            $path = $this->firstReadablePath([
                Storage::disk($disk)->path($relative),
                public_path('storage'.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relative)),
            ]);
            if ($path !== null) {
                return $path;
            }
        }

        // Legacy string column (e.g. /assets/logo.png under public/).
        $legacy = trim((string) ($settings->logo ?? ''));
        if ($legacy === '') {
            return null;
        }

        $legacy = str_replace('\\', '/', $legacy);
        $legacy = ltrim($legacy, '/');

        return $this->firstReadablePath([
            public_path($legacy),
            public_path('storage'.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $legacy)),
            Storage::disk('public')->path($legacy),
        ]);
    }

    /**
     * @param  list<string>  $candidates
     */
    protected function firstReadablePath(array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (! is_string($candidate) || $candidate === '') {
                continue;
            }
            if (! is_file($candidate) || ! is_readable($candidate)) {
                continue;
            }
            $real = realpath($candidate);

            return $real !== false ? $real : $candidate;
        }

        return null;
    }
}
