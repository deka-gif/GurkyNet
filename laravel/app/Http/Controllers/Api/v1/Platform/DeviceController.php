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
            'push_token' => 'nullable|string|max:1024',
            'push_provider' => 'nullable|string|in:fcm,apns,webpush,expo',
            'app_version' => 'nullable|string|max:64',
            'app_build' => 'nullable|integer|min:1',
            'device_model' => 'nullable|string|max:128',
            'os_version' => 'nullable|string|max:64',
        ]);

        $authUserId = optional(auth('sanctum')->user())->id ?? optional($request->user())->id;

        $update = [
            'user_id' => $authUserId,
            'app_version' => $data['app_version'] ?? null,
            'app_build' => $data['app_build'] ?? null,
            'device_model' => $data['device_model'] ?? null,
            'os_version' => $data['os_version'] ?? null,
            'user_agent' => substr((string) $request->userAgent(), 0, 512),
            'is_active' => true,
            'last_seen_at' => now(),
        ];

        // Do not wipe an existing push_token when register is called without one
        // (mobile syncDeviceRegistration often omits token).
        if (array_key_exists('push_token', $data) && is_string($data['push_token']) && $data['push_token'] !== '') {
            $update['push_token'] = $data['push_token'];
        }
        if (! empty($data['push_provider'])) {
            $update['push_provider'] = $data['push_provider'];
        }

        $device = UserDevice::updateOrCreate(
            [
                'device_uuid' => $data['device_uuid'],
                'platform' => strtolower($data['platform']),
            ],
            $update
        );

        if ($authUserId && (int) $device->user_id !== (int) $authUserId) {
            $device->user_id = $authUserId;
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
            'push_token' => 'required|string|max:1024',
            'push_provider' => 'nullable|string|in:fcm,apns,webpush,expo',
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

        $provider = $data['push_provider']
            ?? $device->push_provider
            ?? (str_starts_with($data['push_token'], 'ExponentPushToken')
                || str_starts_with($data['push_token'], 'ExpoPushToken')
                    ? 'expo'
                    : 'fcm');

        $device->fill([
            'push_token' => $data['push_token'],
            'push_provider' => $provider,
            'is_active' => true,
            'last_seen_at' => now(),
            'user_agent' => substr((string) $request->userAgent(), 0, 512),
        ])->save();

        return $this->successResponse('Push token berhasil diperbarui.', $this->mapDevice($device));
    }

    /**
     * Disassociate push token from the current user (logout / account switch).
     * Keeps device_uuid row but clears ownership + token so User A cannot receive on User B's session.
     * POST /api/v1/devices/disassociate
     */
    public function disassociate(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return $this->errorResponse('Autentikasi diperlukan.', 401);
        }

        $data = $request->validate([
            'device_uuid' => 'required|string|max:191',
            'platform' => 'required|string|in:android,ios,web,pwa',
        ]);

        $device = UserDevice::where('device_uuid', $data['device_uuid'])
            ->where('platform', strtolower($data['platform']))
            ->where('user_id', $user->id)
            ->first();

        if (! $device) {
            return $this->successResponse('Perangkat sudah tidak terasosiasi.');
        }

        $device->update([
            'user_id' => null,
            'push_token' => null,
            'is_active' => false,
            'last_seen_at' => now(),
        ]);

        return $this->successResponse('Perangkat berhasil diputus dari akun.');
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
