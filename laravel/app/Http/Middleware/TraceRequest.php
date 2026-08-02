<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class TraceRequest
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 1. Resolve or Generate Correlation ID
        $correlationId = $request->header('X-Correlation-ID') ?: 'corr-' . bin2hex(random_bytes(8));
        
        // 2. Resolve or Generate Request ID
        $requestId = $request->header('X-Request-ID') ?: 'req-' . bin2hex(random_bytes(8));

        // 3. Keep in request attributes for easy retrieval downstream.
        //    Note: session()->put() is intentionally omitted here — API routes
        //    are stateless and do not start a session. The correlation ID is
        //    available via $request->attributes->get('correlation_id') anywhere
        //    in the request lifecycle without requiring session support.
        $request->attributes->set('correlation_id', $correlationId);
        $request->attributes->set('request_id', $requestId);

        // 4. Share with Laravel Log Context
        if (method_exists(Log::class, 'shareContext')) {
            Log::shareContext([
                'correlation_id' => $correlationId,
                'request_id' => $requestId,
            ]);
        } elseif (method_exists(Log::class, 'withContext')) {
            Log::withContext([
                'correlation_id' => $correlationId,
                'request_id' => $requestId,
            ]);
        }

        // 5. Log incoming request as Structured JSON
        Log::info(json_encode([
            'message' => 'Incoming HTTP Request',
            'type' => 'request_start',
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'correlation_id' => $correlationId,
            'request_id' => $requestId,
            'timestamp' => now()->toIso8601String(),
        ]));

        // Record start time
        $startTime = microtime(true);

        // 6. Proceed to next request handler
        $response = $next($request);

        // Calculate duration
        $duration = round((microtime(true) - $startTime) * 1000, 2);

        // 7. Inject response headers
        $response->headers->set('X-Correlation-ID', $correlationId);
        $response->headers->set('X-Request-ID', $requestId);

        // 8. Log outgoing response as Structured JSON
        Log::info(json_encode([
            'message' => 'Outgoing HTTP Response',
            'type' => 'request_end',
            'status' => $response->getStatusCode(),
            'duration_ms' => $duration,
            'correlation_id' => $correlationId,
            'request_id' => $requestId,
            'timestamp' => now()->toIso8601String(),
        ]));

        return $response;
    }
}
