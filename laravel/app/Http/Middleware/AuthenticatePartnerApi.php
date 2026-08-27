<?php

namespace App\Http\Middleware;

use App\Models\ApiCredential;
use App\Models\ApiRequestLog;
use App\Services\PartnerApi\PartnerAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * FR-API-03 — X-API-Key + X-Signature + X-Timestamp (5m) + replay protection.
 */
class AuthenticatePartnerApi
{
    public function __construct(protected PartnerAuthService $auth) {}

    public function handle(Request $request, Closure $next): Response
    {
        $started = microtime(true);
        $apiKey = (string) $request->header('X-API-Key', '');
        $signature = (string) $request->header('X-Signature', '');
        $timestamp = (string) $request->header('X-Timestamp', '');
        $body = $request->getContent() ?: '';

        $credential = ApiCredential::query()
            ->where('api_key', $apiKey)
            ->with('partner')
            ->first();

        if (! $credential || ! $credential->isUsable()) {
            $this->auth->flagAbuse(null, 'invalid_api_key', ['api_key_prefix' => substr($apiKey, 0, 12)]);
            $this->log(null, $request, 401, $started, 'invalid_api_key');

            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $partner = $credential->partner;
        if (! $partner || ! $partner->isApproved()) {
            $this->log($partner?->id, $request, 403, $started, 'partner_not_approved');

            return response()->json(['success' => false, 'message' => 'Partner not approved'], 403);
        }

        if (! $this->auth->timestampWithinSkew($timestamp)) {
            $this->auth->flagAbuse($partner->id, 'timestamp_skew', ['timestamp' => $timestamp]);
            $this->log($partner->id, $request, 401, $started, 'timestamp_skew', (bool) $credential->is_sandbox);

            return response()->json(['success' => false, 'message' => 'Timestamp out of range'], 401);
        }

        if (! $this->auth->verifySignature($body, $credential->plainSecret(), $signature)) {
            $this->auth->flagAbuse($partner->id, 'invalid_signature', [
                'endpoint' => $request->path(),
            ]);
            $this->log($partner->id, $request, 401, $started, 'invalid_signature', (bool) $credential->is_sandbox);

            return response()->json(['success' => false, 'message' => 'Invalid signature'], 401);
        }

        if (! $this->auth->assertNotReplay($apiKey, $timestamp, $body)) {
            $this->auth->flagAbuse($partner->id, 'replay_attempt', [
                'timestamp' => $timestamp,
            ]);
            $this->log($partner->id, $request, 401, $started, 'replay', (bool) $credential->is_sandbox);

            return response()->json(['success' => false, 'message' => 'Replay rejected'], 401);
        }

        // Optional IP whitelist — only enforce when configured (do not block basic API).
        $whitelist = $partner->ip_whitelist;
        if (is_array($whitelist) && count($whitelist) > 0) {
            $ip = $request->ip();
            if (! in_array($ip, $whitelist, true)) {
                $this->log($partner->id, $request, 403, $started, 'ip_not_whitelisted', (bool) $credential->is_sandbox);

                return response()->json(['success' => false, 'message' => 'IP not allowed'], 403);
            }
        }

        $request->attributes->set('api_partner', $partner);
        $request->attributes->set('api_credential', $credential);

        /** @var Response $response */
        $response = $next($request);

        $this->log(
            $partner->id,
            $request,
            $response->getStatusCode(),
            $started,
            null,
            (bool) $credential->is_sandbox,
            $request->header('Idempotency-Key') ?: $request->input('idempotency_key')
        );

        return $response;
    }

    protected function log(
        ?int $partnerId,
        Request $request,
        int $status,
        float $started,
        ?string $errorClass = null,
        bool $sandbox = false,
        ?string $idem = null
    ): void {
        try {
            ApiRequestLog::create([
                'partner_id' => $partnerId,
                'endpoint' => '/'.$request->path(),
                'method' => $request->method(),
                'request_hash' => hash('sha256', $request->getContent() ?: ''),
                'idempotency_key' => $idem,
                'response_status' => $status,
                'latency_ms' => (int) round((microtime(true) - $started) * 1000),
                'error_class' => $errorClass,
                'sandbox' => $sandbox,
            ]);
        } catch (\Throwable) {
            // never break API on logging
        }
    }
}
