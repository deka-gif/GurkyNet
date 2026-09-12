<?php

namespace App\Http\Middleware;

use App\Exceptions\AccountDeletionException;
use App\Services\AccountDeletion\AccountDeletionGate;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Block money-moving customer routes while account is pending_deletion.
 */
class EnsureAccountNotPendingDeletion
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user) {
            try {
                app(AccountDeletionGate::class)->assertNotPendingDeletion($user);
            } catch (AccountDeletionException $e) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'code' => $e->errorCode,
                    'data' => null,
                    'meta' => null,
                    'errors' => $e->errors ?: null,
                ], $e->statusCode);
            }
        }

        return $next($request);
    }
}
