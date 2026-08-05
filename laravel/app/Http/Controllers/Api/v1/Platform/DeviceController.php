<?php

namespace App\Http\Controllers\Api\v1\Platform;

use App\Http\Controllers\Controller;
use App\Models\UserDevice;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    use ApiResponseTrait;

    /**
     * Register or upsert a client device.
     * POST /api/v1/devices/register
     * Auth optional — attaches user when Sanctum token is present.
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_uuid' => 'required|string|max:191',
            'platform' => 'required|string|in:android,ios,web,pwa',
            'push_token' => 'nullable|string|max:512',
            'push_provider' => 'nullable|string|in:fcm,apns,webpush',
            'app_version' => 'nullable|string|max:64',
            'app_build' => 'nullable|integer|min:1',
            'device_model' => 'nullable|string|max:128',
            'os_version' => 'nullable|string|max:64',
        ]);

        $device = UserDevice::updateOrCreate(
            [
                'device_uuid' => $data['device_uuid'],
                'platform' => strtolower($data['platform']),
            ],
            [
                'user_id' => optional(auth('sanctum')->user())->id ?? optional($request->user())->id,
                'push_token' => $data['push_token'] ?? null,
                'push_provider' => $data['push_provider'] ?? null,
                'app_version' => $data['app_version'] ?? null,
                'app_build' => $data['app_build'] ?? null,
                'device_model' => $data['device_model'] ?? null,
                'os_version' => $data['os_version'] ?? null,
                'user_agent' => substr((string) $request->userAgent(), 0, 512),
                'is_active' => true,
                'last_seen_at' => now(),
            ]
        );

        $authUser = auth('sanctum')->user() ?? $request->user();
        if ($authUser && !$device->user_id) {
            $device->user_id = $authUser->id;
            $device->save();
        }

        return $this->successResponse('Perangkat berhasil didaftarkan.', $this->mapDevice($device), 201);
    }

    /**
     * Update push token for a registered device.
     * POST /api/v1/devices/push-token
     */
    public function updatePushToken(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_uuid' => 'required|string|max:191',
            'platform' => 'required|string|in:android,ios,web,pwa',
            'push_token' => 'required|string|max:512',
            'push_provider' => 'nullable|string|in:fcm,apns,webpush',
        ]);

        $device = UserDevice::where('device_uuid', $data['device_uuid'])
            ->where('platform', strtolower($data['platform']))
            ->first();

        if (!$device) {
            return $this->errorResponse('Perangkat belum terdaftar. Panggil /devices/register terlebih dahulu.', 404);
        }

        if ($request->user() || auth('sanctum')->user()) {
            $device->user_id = optional($request->user() ?? auth('sanctum')->user())->id;
        }

        $device->fill([
            'push_token' => $data['push_token'],
            'push_provider' => $data['push_provider'] ?? $device->push_provider ?? 'fcm',
            'is_active' => true,
            'last_seen_at' => now(),
            'user_agent' => substr((string) $request->userAgent(), 0, 512),
        ])->save();

        return $this->successResponse('Push token berhasil diperbarui.', $this->mapDevice($device));
    }

    /**
     * List devices for the authenticated user.
     * GET /api/v1/devices
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Autentikasi diperlukan.', 401);
        }

        $devices = UserDevice::where('user_id', $user->id)
            ->where('is_active', true)
            ->latest('last_seen_at')
            ->get()
            ->map(fn (UserDevice $d) => $this->mapDevice($d));

        return $this->successResponse('Daftar perangkat berhasil dimuat.', $devices);
    }

    /**
     * Deactivate a device.
     * DELETE /api/v1/devices/{deviceUuid}
     */
    public function destroy(Request $request, string $deviceUuid): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return $this->errorResponse('Autentikasi diperlukan.', 401);
        }

        $device = UserDevice::where('user_id', $user->id)
            ->where('device_uuid', $deviceUuid)
            ->first();

        if (!$device) {
            return $this->errorResponse('Perangkat tidak ditemukan.', 404);
        }

        $device->update([
            'is_active' => false,
            'push_token' => null,
            'last_seen_at' => now(),
        ]);

        return $this->successResponse('Perangkat berhasil dinonaktifkan.');
    }

    protected function mapDevice(UserDevice $device): array
    {
        return [
            'id' => $device->id,
            'device_uuid' => $device->device_uuid,
            'platform' => $device->platform,
            'push_token_registered' => !empty($device->push_token),
            'push_provider' => $device->push_provider,
            'app_version' => $device->app_version,
            'app_build' => $device->app_build,
            'device_model' => $device->device_model,
            'os_version' => $device->os_version,
            'is_active' => (bool) $device->is_active,
            'last_seen_at' => optional($device->last_seen_at)?->toIso8601String(),
        ];
    }
}
