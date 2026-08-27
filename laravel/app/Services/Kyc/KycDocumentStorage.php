<?php

namespace App\Services\Kyc;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * FR-KYC-02 / SRS Bagian 21 — private-disk KYC document storage.
 * Never uses the public disk; never returns public URLs.
 */
class KycDocumentStorage
{
    public const DISK = 'local';

    public const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

    /** @var list<string> */
    public const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

    /** @var list<string> */
    public const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

    public function store(UploadedFile $file, int $userId, string $kind): string
    {
        $this->assertSafeUpload($file);

        $ext = strtolower((string) $file->getClientOriginalExtension());
        if (! in_array($ext, self::ALLOWED_EXTENSIONS, true)) {
            $ext = match ($file->getMimeType()) {
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => 'jpg',
            };
        }

        $safeName = sprintf(
            '%s_%s_%s.%s',
            $kind,
            now()->format('YmdHis'),
            Str::lower(Str::random(12)),
            $ext
        );

        $directory = 'kyc/'.$userId;
        $path = $file->storeAs($directory, $safeName, self::DISK);

        if (! is_string($path) || $path === '') {
            throw ValidationException::withMessages([
                $kind => ['Gagal menyimpan dokumen KYC.'],
            ]);
        }

        return $path;
    }

    public function assertSafeUpload(UploadedFile $file): void
    {
        if (! $file->isValid()) {
            throw ValidationException::withMessages([
                'document' => ['File unggahan tidak valid.'],
            ]);
        }

        if ($file->getSize() > self::MAX_BYTES) {
            throw ValidationException::withMessages([
                'document' => ['Ukuran file melebihi batas 5 MB.'],
            ]);
        }

        $mime = (string) $file->getMimeType();
        if (! in_array($mime, self::ALLOWED_MIMES, true)) {
            throw ValidationException::withMessages([
                'document' => ['Tipe file tidak diizinkan. Gunakan JPEG, PNG, atau WebP.'],
            ]);
        }

        $ext = strtolower((string) $file->getClientOriginalExtension());
        if ($ext !== '' && ! in_array($ext, self::ALLOWED_EXTENSIONS, true)) {
            throw ValidationException::withMessages([
                'document' => ['Ekstensi file tidak diizinkan.'],
            ]);
        }

        $original = (string) $file->getClientOriginalName();
        if (str_contains($original, '..') || str_contains($original, '/') || str_contains($original, '\\')) {
            throw ValidationException::withMessages([
                'document' => ['Nama file tidak aman.'],
            ]);
        }
    }

    public function exists(string $path): bool
    {
        return $path !== '' && Storage::disk(self::DISK)->exists($path);
    }

    public function getAbsolutePath(string $path): string
    {
        return Storage::disk(self::DISK)->path($path);
    }

    public function deleteQuietly(?string $path): void
    {
        if (! $path) {
            return;
        }

        try {
            Storage::disk(self::DISK)->delete($path);
        } catch (\Throwable) {
            // Keep historical row even if file already gone.
        }
    }
}
