<?php

namespace App\Http\Controllers\Api\v1\Platform;

use App\Http\Controllers\Controller;
use App\Models\ApkVersion;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Platform versioning endpoints shared by Website, Android, iOS, and PWA.
 */
class PlatformVersionController extends Controller
{
    use ApiResponseTrait;

    /**
     * GET /api/v1/platform/api-version
     */
    public function apiVersion(): JsonResponse
    {
        return $this->successResponse('Versi API berhasil dimuat.', [
            'api_version' => 'v1',
            'api_version_number' => '1.0.0',
            'min_supported_api_version' => 'v1',
            'deprecated' => false,
            'docs' => url('/api/documentation'),
        ]);
    }

    /**
     * GET /api/v1/platform/app-version?platform=android
     */
    public function appVersion(Request $request): JsonResponse
    {
        $platform = strtolower((string) $request->query('platform', 'android'));
        $latest = $this->latestVersion($platform);

        if (!$latest) {
            return $this->successResponse('Belum ada versi aplikasi terpublikasi.', [
                'platform' => $platform,
                'latest' => null,
                'min_supported_version_code' => null,
            ]);
        }

        return $this->successResponse('Versi aplikasi berhasil dimuat.', [
            'platform' => $platform,
            'latest' => $this->mapVersion($latest),
            'min_supported_version_code' => $latest->min_supported_version_code ?? $latest->version_code,
        ]);
    }

    /**
     * GET /api/v1/platform/force-update?platform=android&version_code=12
     */
    public function forceUpdate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'platform' => 'nullable|string|in:android,ios,web,pwa',
            'version_code' => 'required|integer|min:1',
            'version_name' => 'nullable|string|max:64',
        ]);

        $platform = strtolower($data['platform'] ?? 'android');
        $clientCode = (int) $data['version_code'];
        $latest = $this->latestVersion($platform);

        if (!$latest) {
            return $this->successResponse('Tidak ada kebijakan update aktif.', [
                'platform' => $platform,
                'update_required' => false,
                'force_update' => false,
                'latest' => null,
            ]);
        }

        $minSupported = (int) ($latest->min_supported_version_code ?? $latest->version_code);
        $updateRequired = $clientCode < (int) $latest->version_code;
        $forceUpdate = $clientCode < $minSupported || ($updateRequired && (bool) $latest->is_force_update);

        return $this->successResponse('Status update aplikasi berhasil dievaluasi.', [
            'platform' => $platform,
            'client_version_code' => $clientCode,
            'update_required' => $updateRequired,
            'force_update' => $forceUpdate,
            'min_supported_version_code' => $minSupported,
            'latest' => $this->mapVersion($latest),
            'download_url' => \App\Support\MediaUrl::absolute($latest->download_url),
        ]);
    }

    /**
     * GET /api/v1/platform/minimum-supported-version?platform=android
     */
    public function minimumSupportedVersion(Request $request): JsonResponse
    {
        $platform = strtolower((string) $request->query('platform', 'android'));
        $latest = $this->latestVersion($platform);

        return $this->successResponse('Minimum supported version berhasil dimuat.', [
            'platform' => $platform,
            'min_supported_version_code' => $latest?->min_supported_version_code ?? $latest?->version_code,
            'min_supported_version_name' => $latest?->version_name,
            'latest' => $latest ? $this->mapVersion($latest) : null,
        ]);
    }

    protected function latestVersion(string $platform): ?ApkVersion
    {
        return ApkVersion::query()
            ->when(
                \Illuminate\Support\Facades\Schema::hasColumn('apk_versions', 'platform'),
                fn ($q) => $q->where('platform', $platform)
            )
            ->when(
                \Illuminate\Support\Facades\Schema::hasColumn('apk_versions', 'is_active'),
                fn ($q) => $q->where('is_active', true)
            )
            ->orderByDesc('version_code')
            ->first();
    }

    protected function mapVersion(ApkVersion $version): array
    {
        return [
            'id' => $version->id,
            'platform' => $version->platform ?? 'android',
            'version_code' => (int) $version->version_code,
            'version_name' => $version->version_name,
            'min_supported_version_code' => $version->min_supported_version_code !== null
                ? (int) $version->min_supported_version_code
                : (int) $version->version_code,
            'download_url' => \App\Support\MediaUrl::absolute($version->download_url),
            'is_force_update' => (bool) $version->is_force_update,
            'release_notes' => $version->release_notes,
            'published_at' => optional($version->updated_at)?->toIso8601String(),
        ];
    }
}
