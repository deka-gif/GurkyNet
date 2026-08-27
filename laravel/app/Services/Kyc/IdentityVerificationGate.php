<?php

namespace App\Services\Kyc;

use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * FR-KYC-01 / SRS Bagian 21 — Tier 1: phone OTP + email verification required
 * before identity-gated transactions. Does not block login/profile/help.
 */
class IdentityVerificationGate
{
    public function isPhoneVerified(User $user): bool
    {
        return $user->phone_verified_at !== null;
    }

    public function isEmailVerified(User $user): bool
    {
        return $user->email_verified_at !== null;
    }

    public function isTier1Complete(User $user): bool
    {
        return $this->isPhoneVerified($user) && $this->isEmailVerified($user);
    }

    /**
     * @throws ValidationException
     */
    public function assertTier1(User $user): void
    {
        $errors = [];

        if (! $this->isPhoneVerified($user)) {
            $errors['phone'] = ['Nomor HP belum diverifikasi (KYC Tier 1). Verifikasi HP terlebih dahulu.'];
        }

        if (! $this->isEmailVerified($user)) {
            $errors['email'] = ['Email belum diverifikasi (KYC Tier 1). Verifikasi email terlebih dahulu.'];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
