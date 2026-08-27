<?php

namespace App\Http\Middleware;

use App\Models\ApiPartner;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/** FR-API-08 — per-partner configurable RPM (default 60). */
class PartnerApiRateLimit
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var ApiPartner|null $partner */
        $partner = $request->attributes->get('api_partner');
        if (! $partner) {
            return $next($request);
        }

        $limit = (int) ($partner->rate_limit_per_minute
            ?: config('partner_api.default_rate_limit_per_minute', 60));

        $key = 'partner_api:rpm:'.$partner->id;
        if (RateLimiter::tooManyAttempts($key, $limit)) {
            return response()->json([
                'success' => false,
                'message' => 'Too Many Requests',
            ], 429);
        }

        RateLimiter::hit($key, 60);

        return $next($request);
    }
}
