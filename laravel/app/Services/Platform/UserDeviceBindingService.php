<?php

namespace App\Services\Platform;

use App\Models\UserDevice;

/**
 * P0 #4 — device_uuid is a locator, never proof of ownership.
 * Binding/push updates only for the authenticated user (or unbound rows).
 */
class UserDeviceBindingService
{
    /**
     * Create or update a device row for $userId.
     * Refuses to mutate a row owned by another user.
     *
     * @param  array<string, mixed>  $attributes  Must not include user_id from client; this method sets it.
     * @return array{ok: true, device: UserDevice}|array{ok: false, reason: string}
     */
    public function claimOrUpdate(int $userId, string $deviceUuid, string $platform, array $attributes): array
    {
        $platform = strtolower($platform);
        unset($attributes['user_id'], $attributes['owner_id']);

        $existing = UserDevice::query()
            ->where('device_uuid', $deviceUuid)
            ->where('platform', $platform)
            ->first();

        if ($existing && $existing->user_id !== null && (int) $existing->user_id !== $userId) {
            return ['ok' => false, 'reason' => 'owned_by_other'];
        }

        $payload = array_merge($attributes, [
            'user_id' => $userId,
            'is_active' => array_key_exists('is_active', $attributes)
                ? (bool) $attributes['is_active']
                : true,
            'last_seen_at' => $attributes['last_seen_at'] ?? now(),
        ]);

        $device = UserDevice::updateOrCreate(
            [
                'device_uuid' => $deviceUuid,
                'platform' => $platform,
            ],
            $payload
        );

        return ['ok' => true, 'device' => $device->fresh()];
    }

    /**
     * Update push token only for a device owned by $userId.
     *
     * @param  array<string, mixed>  $attributes
     * @return array{ok: true, device: UserDevice}|array{ok: false, reason: string}
     */
    public function updatePushTokenForOwner(
        int $userId,
        string $deviceUuid,
        string $platform,
        string $pushToken,
        array $attributes = []
    ): array {
        $platform = strtolower($platform);
        unset($attributes['user_id'], $attributes['owner_id']);

        $device = UserDevice::query()
            ->where('device_uuid', $deviceUuid)
            ->where('platform', $platform)
            ->where('user_id', $userId)
            ->first();

        if (! $device) {
            return ['ok' => false, 'reason' => 'not_found'];
        }

        $provider = $attributes['push_provider']
            ?? $device->push_provider
            ?? (str_starts_with($pushToken, 'ExponentPushToken')
                || str_starts_with($pushToken, 'ExpoPushToken')
                    ? 'expo'
                    : 'fcm');

        $device->fill([
            'push_token' => $pushToken,
            'push_provider' => $provider,
            'user_id' => $userId,
            'is_active' => true,
            'last_seen_at' => now(),
            'user_agent' => $attributes['user_agent'] ?? $device->user_agent,
        ])->save();

        return ['ok' => true, 'device' => $device->fresh()];
    }
}
