<?php

namespace App\Services\Security;

use App\Models\OnboardingAttempt;
use Illuminate\Validation\ValidationException;

/**
 * P0 — capability token for POST /auth/register/finalize.
 * Plaintext shown once after OTP verify; only SHA-256 hash stored.
 */
class OnboardingFinalizeTokenService
{
    public function ttlMinutes(): int
    {
        return max(1, (int) config('auth.onboarding.finalize_token_ttl_minutes', 30));
    }

    public function hash(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }

    /**
     * Issue a new finalize capability for a verified onboarding attempt.
     * Returns plaintext once; never log the return value.
     */
    public function issue(OnboardingAttempt $attempt): string
    {
        $plain = bin2hex(random_bytes(32));

        $attempt->forceFill([
            'finalize_token_hash' => $this->hash($plain),
            'finalize_token_expires_at' => now()->addMinutes($this->ttlMinutes()),
            'finalize_token_consumed_at' => null,
        ])->save();

        return $plain;
    }

    /**
     * Clear any outstanding finalize capability (e.g. re-register / reset attempt).
     */
    public function clear(OnboardingAttempt $attempt): void
    {
        $attempt->forceFill([
            'finalize_token_hash' => null,
            'finalize_token_expires_at' => null,
            'finalize_token_consumed_at' => null,
        ])->save();
    }

    /**
     * Validate token against a locked attempt row. Does not consume.
     *
     * @throws ValidationException
     */
    public function assertUsable(OnboardingAttempt $attempt, string $plainToken): void
    {
        if ($attempt->finalize_token_consumed_at !== null) {
            throw ValidationException::withMessages([
                'finalize_token' => ['Token finalisasi sudah digunakan.'],
            ]);
        }

        if (!$attempt->finalize_token_hash || !$attempt->finalize_token_expires_at) {
            throw ValidationException::withMessages([
                'finalize_token' => ['Token finalisasi tidak tersedia. Verifikasi OTP terlebih dahulu.'],
            ]);
        }

        if ($attempt->finalize_token_expires_at->isPast()) {
            throw ValidationException::withMessages([
                'finalize_token' => ['Token finalisasi sudah kedaluwarsa. Mulai registrasi ulang.'],
            ]);
        }

        if (!hash_equals((string) $attempt->finalize_token_hash, $this->hash($plainToken))) {
            throw ValidationException::withMessages([
                'finalize_token' => ['Token finalisasi tidak valid.'],
            ]);
        }
    }

    /**
     * Mark token consumed. Call inside the same DB transaction as account creation,
     * after assertUsable() and lockForUpdate().
     */
    public function consume(OnboardingAttempt $attempt): void
    {
        $attempt->forceFill([
            'finalize_token_consumed_at' => now(),
        ])->save();
    }
}
