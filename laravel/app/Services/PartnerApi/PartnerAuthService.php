<?php

namespace App\Services\PartnerApi;

use App\Models\ApiPartner;
use App\Models\PartnerAbuseFlag;
use Illuminate\Support\Facades\Cache;

/**
 * FR-API-03 — HMAC-SHA256(body, secret) + 5m timestamp + replay protection.
 * Abuse: flag only (no auto-suspend) — locked Sprint 17 decision.
 */
class PartnerAuthService
{
    public function sign(string $body, string $secret): string
    {
        return hash_hmac('sha256', $body, $secret);
    }

    public function verifySignature(string $body, string $secret, string $provided): bool
    {
        $expected = $this->sign($body, $secret);

        return hash_equals($expected, strtolower(trim($provided)))
            || hash_equals($expected, trim($provided));
    }

    public function timestampWithinSkew(?string $timestampHeader): bool
    {
        if ($timestampHeader === null || $timestampHeader === '') {
            return false;
        }
        if (! ctype_digit((string) $timestampHeader)) {
            return false;
        }
        $ts = (int) $timestampHeader;
        $skew = (int) config('partner_api.timestamp_skew_seconds', 300);

        return abs(now()->timestamp - $ts) <= $skew;
    }

    /**
     * Replay: same api_key + timestamp + body hash within skew window.
     */
    public function assertNotReplay(string $apiKey, string $timestamp, string $body): bool
    {
        $hash = hash('sha256', $body);
        $cacheKey = 'partner_api:replay:'.$apiKey.':'.$timestamp.':'.$hash;
        $ttl = (int) config('partner_api.timestamp_skew_seconds', 300);

        if (Cache::has($cacheKey)) {
            return false;
        }
        Cache::put($cacheKey, 1, $ttl);

        return true;
    }

    public function flagAbuse(?int $partnerId, string $signal, array $evidence = []): PartnerAbuseFlag
    {
        return PartnerAbuseFlag::create([
            'partner_id' => $partnerId,
            'signal' => $signal,
            'evidence' => $evidence,
            'status' => PartnerAbuseFlag::STATUS_FLAGGED,
            'detected_at' => now(),
        ]);
    }

    public function partnerApiEnabled(): bool
    {
        return (bool) config('features.partner_api_enabled', false);
    }

    public function sandboxEnabled(): bool
    {
        return (bool) config('features.partner_api_sandbox_enabled', true);
    }
}
