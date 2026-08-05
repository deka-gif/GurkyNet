<?php

namespace App\Http\Controllers\Api\v1\Public;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Serves public-disk media under /api/v1/public/media/{path}.
 */
class PublicMediaController extends Controller
{
    public function show(string $path): BinaryFileResponse
    {
        $relative = $this->sanitizeRelativePath($path);

        if ($relative === null) {
            abort(404, 'Media not found.');
        }

        $absolute = $this->resolveAbsolutePath($relative);

        if ($absolute === null) {
            abort(404, 'Media not found.');
        }

        return response()->file($absolute, [
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }

    /**
     * Normalize route {path} into a public-disk relative path (folder/file.ext).
     */
    private function sanitizeRelativePath(string $path): ?string
    {
        $path = rawurldecode($path);
        $path = str_replace('\\', '/', trim($path));
        $path = ltrim($path, '/');

        // Strip accidental full delivery / storage prefixes if present in {path}.
        if (preg_match('#(?:^|/)api/v\d+/public/media/(.+)$#i', $path, $matches)) {
            $path = $matches[1];
        }
        if (str_starts_with($path, 'storage/')) {
            $path = substr($path, strlen('storage/'));
        }

        if ($path === '' || str_contains($path, '..') || str_contains($path, "\0")) {
            return null;
        }

        if (! preg_match('#^[A-Za-z0-9_./\-]+$#', $path)) {
            return null;
        }

        return $path;
    }

    /**
     * Resolve a readable absolute file path for the relative media path.
     *
     * Uses PHP is_file() on both the public disk root and public/storage
     * (storage:link). Flysystem exists() alone is not trusted here — it is
     * what produced false 404s while the physical file was present.
     */
    private function resolveAbsolutePath(string $relative): ?string
    {
        $candidates = array_unique([
            Storage::disk('public')->path($relative),
            public_path('storage' . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative)),
        ]);

        foreach ($candidates as $candidate) {
            if (! is_file($candidate) || ! is_readable($candidate)) {
                continue;
            }

            $real = realpath($candidate);

            return $real !== false ? $real : $candidate;
        }

        return null;
    }
}
