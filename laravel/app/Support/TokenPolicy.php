<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\User;
use Carbon\Carbon;

/**
 * SRS Bagian 8.1 (Keamanan) — Sprint 2 (Authentication & RBAC), keputusan #3.
 *
 * Kebijakan masa berlaku token Sanctum:
 *  - Staf (role != user): idle timeout 30 menit. Diimplementasikan sebagai
 *    expires_at yang di-set 30 menit ke depan setiap kali token dibuat, dan
 *    "diperpanjang" (sliding) pada setiap request aktif oleh middleware
 *    RenewTokenExpiration — sehingga staf yang aktif tidak ter-logout, tapi
 *    staf yang idle >30 menit tokennya kedaluwarsa (Sanctum Guard menolak
 *    otomatis via kolom expires_at bawaan personal_access_tokens).
 *  - Customer/User (role == user): token berlaku 30 hari, dengan refresh
 *    otomatis (perpanjang expires_at) setiap kali token dipakai secara aktif
 *    — BUKAN idle timeout 30 menit (jangan disamakan dengan staf).
 *
 * Tidak memerlukan migration baru — kolom `personal_access_tokens.expires_at`
 * sudah ada dari paket Laravel Sanctum (Sprint 0).
 */
class TokenPolicy
{
    public const STAFF_IDLE_TIMEOUT_MINUTES = 30;
    public const CUSTOMER_TOKEN_LIFETIME_DAYS = 30;

    /**
     * Staf = punya role selain `user` (owner, finance, operations, marketing,
     * customer_support, super_admin). Customer/agen = role `user`.
     */
    public static function isStaff(User $user): bool
    {
        $role = $user->role instanceof UserRole
            ? $user->role
            : UserRole::tryFrom((string) $user->role);

        return $role !== null && $role !== UserRole::USER;
    }

    /**
     * Tentukan `expires_at` yang tepat untuk token baru/diperpanjang milik user ini.
     */
    public static function expiresAtFor(User $user): Carbon
    {
        return static::isStaff($user)
            ? now()->addMinutes(self::STAFF_IDLE_TIMEOUT_MINUTES)
            : now()->addDays(self::CUSTOMER_TOKEN_LIFETIME_DAYS);
    }
}
