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
     */
    public function getSecurityOverview(User $user): array
    {
        // Last Login
        $lastLogin = LoginLog::where('user_id', $user->id)
            ->latest('logged_at')
            ->first();

        // Registered Devices from login logs
        $loginLogs = LoginLog::where('user_id', $user->id)
            ->get();

        $registeredDevices = [];
        $seenUserAgents = [];
        foreach ($loginLogs as $log) {
            $ua = $log->user_agent ?: 'Unknown Device';
            if (!in_array($ua, $seenUserAgents)) {
                $seenUserAgents[] = $ua;
                $registeredDevices[] = [
                    'user_agent' => $ua,
                    'ip_address' => $log->ip_address,
                    'last_login_at' => $log->logged_at?->toDateTimeString(),
                ];
            }
        }

        // Active Tokens
        $activeTokens = $user->tokens->map(function ($token) {
            return [
                'id' => $token->id,
                'name' => $token->name,
                'last_used_at' => $token->last_used_at?->toDateTimeString(),
                'created_at' => $token->created_at?->toDateTimeString(),
            ];
        })->toArray();

        return [
            'last_login' => $lastLogin ? [
                'ip_address' => $lastLogin->ip_address,
                'user_agent' => $lastLogin->user_agent,
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
