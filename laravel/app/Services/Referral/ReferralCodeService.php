<?php

namespace App\Services\Referral;

use App\Models\ReferralCode;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** FR-REF-01 — unique referral codes (auto + optional custom). */
class ReferralCodeService
{
    public function ensureForUser(User $user): ReferralCode
    {
        $existing = ReferralCode::query()->where('user_id', $user->id)->first();
        if ($existing) {
            return $existing;
        }

        return ReferralCode::query()->create([
            'user_id' => $user->id,
            'code' => $this->generateUniqueCode(),
            'is_custom' => false,
        ]);
    }

    public function setCustomCode(User $user, string $code): ReferralCode
    {
        $normalized = $this->normalizeAndValidate($code);

        $owned = ReferralCode::query()->where('user_id', $user->id)->first();
        $conflict = ReferralCode::query()
            ->where('code', $normalized)
            ->when($owned, fn ($q) => $q->where('id', '!=', $owned->id))
            ->exists();
        if ($conflict) {
            throw ValidationException::withMessages([
                'code' => ['Kode referral sudah digunakan.'],
            ]);
        }

        if ($owned) {
            $owned->update(['code' => $normalized, 'is_custom' => true]);

            return $owned->fresh();
        }

        return ReferralCode::query()->create([
            'user_id' => $user->id,
            'code' => $normalized,
            'is_custom' => true,
        ]);
    }

    public function findUserByCode(string $code): ?User
    {
        $normalized = strtoupper(trim($code));
        $row = ReferralCode::query()->where('code', $normalized)->first();

        return $row?->user;
    }

    public function normalizeAndValidate(string $code): string
    {
        $normalized = strtoupper(trim($code));
        $len = strlen($normalized);
        if ($len < 6 || $len > 20) {
            throw ValidationException::withMessages([
                'referral_code' => ['Kode referral harus 6–20 karakter.'],
            ]);
        }
        if (! preg_match('/^[A-Z0-9]+$/', $normalized)) {
            throw ValidationException::withMessages([
                'referral_code' => ['Kode referral hanya boleh alphanumeric.'],
            ]);
        }

        return $normalized;
    }

    public function generateUniqueCode(): string
    {
        for ($i = 0; $i < 20; $i++) {
            $candidate = strtoupper(Str::random(8));
            if (! ReferralCode::query()->where('code', $candidate)->exists()) {
                return $candidate;
            }
        }

        throw new \RuntimeException('Gagal generate kode referral unik.');
    }
}
