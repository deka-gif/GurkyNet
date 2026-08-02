<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Enums\UserRole;

class EnsureRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string  ...$roles
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi otentikasi tidak valid.',
                'data' => null,
                'meta' => null,
                'errors' => null,
            ], 401);
        }

        $userRoleValue = $user->role instanceof UserRole ? $user->role->value : (string) $user->role;

        // Super Admin bypasses role checks
        if ($userRoleValue === UserRole::SUPER_ADMIN->value || strtolower($userRoleValue) === 'super_admin' || strtolower($userRoleValue) === 'super admin') {
            return $next($request);
        }

        $normalizedUserRole = strtolower(str_replace(' ', '_', $userRoleValue));
        $normalizedAllowedRoles = array_map(fn($r) => strtolower(str_replace(' ', '_', $r)), $roles);

        // Check matching roles
        if (in_array($normalizedUserRole, $normalizedAllowedRoles, true)) {
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'Akses ditolak. Peran Anda tidak memiliki wewenang untuk modul ini.',
            'data' => null,
            'meta' => null,
            'errors' => null,
        ], 403);
    }
}
