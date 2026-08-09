<?php

namespace App\Http\Middleware;

use App\Support\TokenPolicy;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * SRS Bagian 8.1 — Sprint 2 (Authentication & RBAC), keputusan #3.
 *
 * Menegakkan "idle timeout" staf (30 menit) dan "refresh otomatis saat
 * dipakai aktif" untuk customer (30 hari) dengan cara memperpanjang
 * `expires_at` token yang sedang dipakai pada SETIAP request terautentikasi.
 * Ini adalah mekanisme sliding-expiration di atas kolom `expires_at` bawaan
 * Sanctum (tidak perlu tabel/kolom baru).
 *
 * Dipasang setelah `auth:sanctum` pada grup route terproteksi di routes/api.php.
 */
class RenewTokenExpiration
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();
        $token = $user?->currentAccessToken();

        // `exists` memastikan token benar-benar baris tersimpan di DB (bukan
        // TransientToken/mock, misal dari Sanctum::actingAs() di test suite —
        // objek tersebut TIDAK boleh disave ke DB).
        if ($user && $token instanceof PersonalAccessToken && $token->exists) {
            $token->forceFill([
                'expires_at' => TokenPolicy::expiresAtFor($user),
            ])->save();
        }

        return $response;
    }
}
