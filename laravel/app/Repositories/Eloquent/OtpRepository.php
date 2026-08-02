<?php

namespace App\Repositories\Eloquent;

use App\Models\OtpCode;
use App\Repositories\Contracts\OtpRepositoryInterface;

class OtpRepository implements OtpRepositoryInterface
{
    public function create(string $phoneNumber, string $code, string $action, int $expiryMinutes = 5): OtpCode
    {
        // Invalidate any existing unused OTPs for this phone and action to prevent reuse attacks
        OtpCode::where('phone_number', $phoneNumber)
            ->where('action', $action)
            ->where('is_used', false)
            ->update(['is_used' => true]);

        return OtpCode::create([
            'phone_number' => $phoneNumber,
            'code' => $code,
            'action' => $action,
            'is_used' => false,
            'expires_at' => now()->addMinutes($expiryMinutes),
        ]);
    }

    public function findLatestActive(string $phoneNumber, string $code, string $action): ?OtpCode
    {
        return OtpCode::where('phone_number', $phoneNumber)
            ->where('code', $code)
            ->where('action', $action)
            ->where('is_used', false)
            ->where('expires_at', '>', now())
            ->latest()
            ->first();
    }

    public function markAsUsed(OtpCode $otp): bool
    {
        return $otp->update(['is_used' => true]);
    }
}
