<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\ProfileRepositoryInterface;
use App\Models\User;
use App\Models\ActivityLog;
use App\Models\LoginLog;
use App\Models\UserDevice;
use Illuminate\Support\Facades\Hash;

class ProfileRepository implements ProfileRepositoryInterface
{
    /**
     * Get the profile data for the given user.
     */
    public function getProfileData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone_number' => $user->phone_number,
            'birth_date' => $user->birth_date,
            'gender' => $user->gender,
            'address' => $user->address,
            'role' => $user->role instanceof \App\Enums\UserRole ? $user->role->value : $user->role,
            'wallet' => $user->wallet ? [
                'wallet_number' => $user->gurky_pay_id ?: $user->wallet->wallet_number,
                'gurky_pay_id' => $user->gurky_pay_id ?: $user->wallet->wallet_number,
                'balance' => (float) $user->wallet->balance,
                'status' => $user->wallet->status,
            ] : null,
        ];
    }

    /**
     * Update the profile data for the given user.
     */
    public function updateProfile(User $user, array $data): User
    {
        $user->update($data);

        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => 'PROFILE_UPDATE',
            'payload' => $data,
        ]);

        return $user;
    }

    /**
     * Update the password for the given user.
     */
    public function updatePassword(User $user, string $currentPassword, string $newPassword): bool
    {
        if (!Hash::check($currentPassword, $user->password)) {
            return false;
        }

        $user->update([
            'password' => Hash::make($newPassword),
        ]);

        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => 'PASSWORD_UPDATE',
            'payload' => ['ip' => request()->ip()],
        ]);

        return true;
    }

    /**
     * Update the transaction PIN for the given user.
     */
    public function updatePin(User $user, string $currentPin, string $newPin): bool
    {
        if ($user->transaction_pin && !Hash::check($currentPin, $user->transaction_pin)) {
            return false;
        }

        $user->update([
            'transaction_pin' => Hash::make($newPin),
            'pin_updated_at' => now(),
        ]);

        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => 'PIN_UPDATE',
            'payload' => ['ip' => request()->ip()],
        ]);

        return true;
    }

    /**
     * Get the security overview for the given user.
     * Session display prefers UserDevice.device_model over raw HTTP User-Agent
     * (okhttp/axios must never be shown as the device name).
     */
    public function getSecurityOverview(User $user): array
    {
        // Last Login
        $lastLogin = LoginLog::where('user_id', $user->id)
            ->latest('logged_at')
            ->first();

        $devices = UserDevice::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->latest('last_seen_at')
            ->get();
        $devicesByUuid = $devices->keyBy('device_uuid');
        $currentUuid = (string) request()->header('X-Device-UUID', '');

        if ($devices->isNotEmpty()) {
            $registeredDevices = $devices->map(function (UserDevice $device) use ($currentUuid) {
                return [
                    'device_uuid' => $device->device_uuid,
                    'device_model' => $device->device_model,
                    'platform' => $device->platform,
                    'display_name' => $this->formatDeviceDisplayName(
                        $device->device_model,
                        $device->platform,
                        $device->user_agent
                    ),
                    'user_agent' => $device->user_agent,
                    'ip_address' => null,
                    'last_login_at' => $device->last_seen_at?->toDateTimeString(),
                    'is_current' => $currentUuid !== '' && hash_equals($currentUuid, (string) $device->device_uuid),
                ];
            })->values()->toArray();
        } else {
            // Fallback: login logs — never expose raw client library UAs as the label.
            $registeredDevices = [];
            $seenUserAgents = [];
            $loginLogs = LoginLog::where('user_id', $user->id)->get();
            foreach ($loginLogs as $log) {
                $ua = $log->user_agent ?: 'Unknown Device';
                if (!in_array($ua, $seenUserAgents, true)) {
                    $seenUserAgents[] = $ua;
                    $registeredDevices[] = [
                        'user_agent' => $ua,
                        'display_name' => $this->formatDeviceDisplayName(null, null, $ua),
                        'ip_address' => $log->ip_address,
                        'last_login_at' => $log->logged_at?->toDateTimeString(),
                        'is_current' => false,
                    ];
                }
            }
        }

        // Active Tokens — enrich Sanctum token name (platform|uuid) with device_model.
        $activeTokens = $user->tokens->map(function ($token) use ($devicesByUuid, $currentUuid) {
            $rawName = (string) $token->name;
            $parts = explode('|', $rawName, 2);
            $platform = isset($parts[1]) ? strtolower((string) $parts[0]) : null;
            $uuid = isset($parts[1]) ? (string) $parts[1] : null;
            $device = ($uuid && $devicesByUuid->has($uuid)) ? $devicesByUuid->get($uuid) : null;

            $displayName = $this->formatDeviceDisplayName(
                $device?->device_model,
                $device?->platform ?? $platform,
                $device?->user_agent ?? $rawName
            );

            return [
                'id' => $token->id,
                'name' => $displayName,
                'token_name' => $rawName,
                'device_model' => $device?->device_model,
                'platform' => $device?->platform ?? $platform,
                'device_uuid' => $uuid,
                'is_current' => $uuid && $currentUuid !== '' && hash_equals($currentUuid, $uuid),
                'last_used_at' => $token->last_used_at?->toDateTimeString(),
                'created_at' => $token->created_at?->toDateTimeString(),
            ];
        })->toArray();

        return [
            'last_login' => $lastLogin ? [
                'ip_address' => $lastLogin->ip_address,
                'user_agent' => $lastLogin->user_agent,
                'display_name' => $this->formatDeviceDisplayName(null, null, $lastLogin->user_agent),
                'logged_at' => $lastLogin->logged_at?->toDateTimeString(),
            ] : null,
            'registered_devices' => $registeredDevices,
            'active_tokens' => $activeTokens,
            'has_pin' => $user->hasPin(),
            'pin_updated_at' => $user->pin_updated_at?->toIso8601String(),
            'two_factor_status' => false,
        ];
    }

    /**
     * Human-readable device label — never show HTTP client libraries (okhttp, axios, …).
     */
    protected function formatDeviceDisplayName(?string $deviceModel, ?string $platform, ?string $userAgent): string
    {
        $model = trim((string) $deviceModel);
        if ($model !== '' && !preg_match('/okhttp|axios|curl|python-requests|postman/i', $model)) {
            return $model;
        }

        $plat = strtolower(trim((string) $platform));
        if (in_array($plat, ['android', 'ios', 'web', 'pwa'], true)) {
            return match ($plat) {
                'android' => 'Perangkat Android',
                'ios' => 'Perangkat iOS',
                'pwa' => 'Aplikasi Web',
                default => 'Browser Web',
            };
        }

        $ua = (string) $userAgent;
        if ($ua === '' || preg_match('/okhttp|axios|curl|python-requests|postman/i', $ua)) {
            return 'Perangkat tidak dikenal';
        }
        if (preg_match('/android/i', $ua)) {
            return 'Perangkat Android';
        }
        if (preg_match('/iphone|ipad|ios/i', $ua)) {
            return 'Perangkat iOS';
        }
        if (preg_match('/mozilla|chrome|safari|firefox|edg/i', $ua)) {
            return 'Browser Web';
        }

        return 'Perangkat tidak dikenal';
    }

    /**
     * Revoke a specific token/session.
     */
    public function revokeSession(User $user, int $tokenId): bool
    {
        $deleted = $user->tokens()->where('id', $tokenId)->delete();

        if ($deleted) {
            ActivityLog::create([
                'user_id' => $user->id,
                'activity' => 'SESSION_REVOKE_SINGLE',
                'payload' => ['token_id' => $tokenId, 'ip' => request()->ip()],
            ]);
            return true;
        }

        return false;
    }

    /**
     * Revoke all sessions except the current one.
     */
    public function revokeOtherSessions(User $user, string $currentTokenId): bool
    {
        $user->tokens()->where('id', '!=', $currentTokenId)->delete();
        UserDevice::query()
            ->where('user_id', $user->id)
            ->where('device_uuid', '!=', request()->header('X-Device-UUID'))
            ->update(['is_active' => false]);

        ActivityLog::create([
            'user_id' => $user->id,
            'activity' => 'SESSION_REVOKE_ALL_EXCEPT_CURRENT',
            'payload' => ['current_token_id' => $currentTokenId, 'ip' => request()->ip()],
        ]);

        return true;
    }
}
