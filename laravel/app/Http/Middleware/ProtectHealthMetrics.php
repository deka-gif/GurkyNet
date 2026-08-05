<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Protects /status and /metrics from public exposure.
 * Requires header X-Health-Token matching HEALTH_METRICS_TOKEN,
 * or allows in local/testing when token is empty.
 */
class ProtectHealthMetrics
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.health.metrics_token', env('HEALTH_METRICS_TOKEN', ''));

        if ($expected === '') {
            if (app()->environment('local', 'testing')) {
                return $next($request);
            }

            return response()->json([
                'success' => false,
                'message' => 'Metrics endpoint is not configured for public access.',
                'data' => null,
                'errors' => null,
            ], 403);
        }

        $provided = (string) $request->header('X-Health-Token', '');
        if (!hash_equals($expected, $provided)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized metrics access.',
                'data' => null,
                'errors' => null,
            ], 401);
        }

        return $next($request);
    }
}
