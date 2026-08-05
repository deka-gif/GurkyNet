<?php

namespace App\Http\Controllers\Api\v1\Public;

use App\Http\Controllers\Controller;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Serves public-disk media under /api/v1/public/media/{path}.
 *
 * Needed when the SPA vhost catch-all returns index.html for /storage/*
 * while Laravel API routes under /api are correctly proxied.
 */
class PublicMediaController extends Controller
{
    public function show(Request $request, string $path): StreamedResponse
    {
        $relative = MediaUrl::toDiskRelativePath(rawurldecode($path));

        if ($relative === '' || str_contains($relative, '..')) {
            abort(404);
        }

        // Only allow safe relative segments (folder/file.ext)
        if (! preg_match('#^[A-Za-z0-9_./\-]+$#', $relative)) {
            abort(404);
        }

        $disk = Storage::disk('public');

        if (! $disk->exists($relative)) {
            abort(404);
        }

        $mime = $disk->mimeType($relative) ?: 'application/octet-stream';

        return $disk->response($relative, null, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }
}
