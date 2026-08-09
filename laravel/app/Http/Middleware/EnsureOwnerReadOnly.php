<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SRS Bagian 5 (Matriks Hak Akses) — Sprint 2 (Authentication & RBAC), keputusan #1.
 *
 * Owner bersifat "Lihat" (read-only) pada modul Finance/Operations/Marketing/
 * Customer Support — hanya "Penuh" pada Executive/Owner, Audit Log, dan
 * approval/override yang memang ditentukan SRS (FR-OWN-04).
 *
 * Middleware ini dipasang BERSAMA EnsureRole pada grup route milik divisi
 * (bukan menggantikannya): EnsureRole tetap memvalidasi keanggotaan role,
 * middleware ini menolak method non-safe (POST/PUT/PATCH/DELETE) khusus
 * untuk role Owner pada grup tersebut. Role pemilik modul (finance,
 * operations, marketing, customer_support) tidak terpengaruh sama sekali.
 * Super Admin TIDAK terpengaruh (bypass EnsureRole terpisah, dan role Owner
 * di sini dicek secara literal, bukan "termasuk yang di-bypass").
 */
class EnsureOwnerReadOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $roleValue = $user?->role instanceof UserRole ? $user->role->value : (string) $user?->role;
        $isOwner = strtolower(str_replace(' ', '_', (string) $roleValue)) === UserRole::OWNER->value;

        if ($isOwner && !$request->isMethodSafe()) {
            return response()->json([
                'success' => false,
                'message' => 'Owner memiliki akses lihat-saja (read-only) pada modul ini. Aksi ini hanya dapat dilakukan oleh divisi terkait.',
                'data' => null,
                'meta' => null,
                'errors' => null,
            ], 403);
        }

        return $next($request);
    }
}
