<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\MediaResource;
use App\Models\Media;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    use ApiResponseTrait;

    /**
     * GET /api/v1/admin/media
     * List semua media dengan filter opsional.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Media::query()->latest();

        if ($request->filled('folder')) {
            $query->where('folder', $request->input('folder'));
        }

        if ($request->filled('mime_type')) {
            $query->where('mime_type', 'like', $request->input('mime_type') . '%');
        }

        if ($request->filled('keyword')) {
            $keyword = $request->input('keyword');
            $query->where(function ($q) use ($keyword) {
                $q->where('original_name', 'like', "%{$keyword}%")
                  ->orWhere('alt_text', 'like', "%{$keyword}%");
            });
        }

        $perPage = (int) $request->input('per_page', 50);
        $paginated = $query->paginate($perPage);

        return $this->paginatedResponse(
            'Daftar media berhasil dimuat.',
            MediaResource::collection($paginated->items()),
            $paginated
        );
    }

    /**
     * POST /api/v1/admin/media
     * Upload file baru ke storage.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file'     => 'required|file|mimetypes:image/jpeg,image/png,image/webp,image/x-icon,image/vnd.microsoft.icon|max:5120',
            'folder'   => ['nullable', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_\\/\\-]+$/'],
            'alt_text' => 'nullable|string|max:255',
        ]);

        $file     = $request->file('file');
        $folder   = trim(str_replace(['..', '\\'], '', (string) $request->input('folder', 'media')), '/');
        if ($folder === '' || str_contains($folder, '..')) {
            $folder = 'media';
        }
        $altText  = $request->input('alt_text', '');

        // Generate unique filename (never trust client extension alone)
        $extension    = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension() ?: 'bin');
        $allowedExt   = ['jpg', 'jpeg', 'png', 'webp', 'ico'];
        if (!in_array($extension, $allowedExt, true)) {
            return $this->errorResponse('Tipe file tidak diizinkan.', 422);
        }
        $filename     = Str::uuid() . '.' . $extension;
        $storagePath  = $folder . '/' . $filename;

        // Store the file in public disk
        Storage::disk('public')->putFileAs($folder, $file, $filename);

        // Get image dimensions if applicable
        $width  = null;
        $height = null;
        $mime   = $file->getMimeType();
        if (in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])) {
            try {
                [$width, $height] = getimagesize($file->getRealPath());
            } catch (\Throwable) {
                // Not an image or getimagesize not supported
            }
        }

        // Store disk-relative path only — never bake APP_URL into the database.
        // Absolute / CDN URLs are resolved at read time via MediaUrl / MediaResource.
        $media = Media::create([
            'filename'      => $filename,
            'original_name' => $file->getClientOriginalName(),
            'mime_type'     => $mime,
            'extension'     => strtolower($extension),
            'size'          => $file->getSize(),
            'width'         => $width,
            'height'        => $height,
            'alt_text'      => $altText,
            'folder'        => $folder,
            'storage_disk'  => 'public',
            'url'           => $storagePath,
            'uploaded_by'   => Auth::user()?->name ?? 'system',
        ]);

        return $this->successResponse('File berhasil diunggah.', new MediaResource($media), 201);
    }

    /**
     * GET /api/v1/admin/media/{id}
     * Detail satu file media.
     */
    public function show(int $id): JsonResponse
    {
        $media = Media::find($id);

        if (!$media) {
            return $this->errorResponse('Media tidak ditemukan.', 404);
        }

        return $this->successResponse('Detail media berhasil dimuat.', new MediaResource($media));
    }

    /**
     * PUT /api/v1/admin/media/{id}
     * Update metadata (alt_text, folder) tanpa mengganti file fisik.
     */
    public function update(int $id, Request $request): JsonResponse
    {
        $media = Media::find($id);

        if (!$media) {
            return $this->errorResponse('Media tidak ditemukan.', 404);
        }

        $request->validate([
            'alt_text' => 'nullable|string|max:255',
            'folder'   => 'nullable|string|max:100',
        ]);

        $media->update($request->only(['alt_text', 'folder']));

        return $this->successResponse('Media berhasil diperbarui.', new MediaResource($media));
    }

    /**
     * DELETE /api/v1/admin/media/{id}
     * Hapus file dari storage dan database.
     */
    public function destroy(int $id): JsonResponse
    {
        $media = Media::find($id);

        if (!$media) {
            return $this->errorResponse('Media tidak ditemukan.', 404);
        }

        // Remove the physical file from storage
        $relativePath = $media->diskPath();
        if ($relativePath !== '' && Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }

        $media->delete();

        return $this->successResponse('Media berhasil dihapus.');
    }
}
