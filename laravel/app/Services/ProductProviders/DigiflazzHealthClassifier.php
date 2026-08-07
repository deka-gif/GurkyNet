<?php

namespace App\Services\ProductProviders;

/**
 * Official Digiflazz response-code → GurkyNet health status mapping.
 * RC is the primary classifier — never message substring matching.
 *
 * @see https://developer.digiflazz.com/
 */
final class DigiflazzHealthClassifier
{
    /**
     * Normalize Digiflazz RC to a comparable string ("40", "41", …).
     */
    public static function normalizeRc(mixed $rc): ?string
    {
        if ($rc === null || $rc === '') {
            return null;
        }

        if (is_int($rc) || is_float($rc)) {
            return (string) (int) $rc;
        }

        $raw = trim((string) $rc);
        if ($raw === '') {
            return null;
        }

        if (preg_match('/\d+/', $raw, $m)) {
            return (string) (int) $m[0];
        }

        return null;
    }

    /**
     * Map Digiflazz RC to an internal GurkyNet api_status, or null if RC is not a known error.
     */
    public static function statusForRc(?string $rc): ?string
    {
        return match ($rc) {
            '40' => ProviderHealthStatus::CONFIG_ERROR,
            '41', '42' => ProviderHealthStatus::AUTH_FAILED,
            '45' => ProviderHealthStatus::NETWORK_CONFIGURATION,
            default => null,
        };
    }

    /**
     * Classify a Digiflazz cek-saldo / health transport response into a standard probe result.
     *
     * Priority:
     * 1) Transport / HTTP offline signals
     * 2) Official Digiflazz RC
     * 3) HTTP 401/403
     * 4) Auth OK → balance OK/PARTIAL
     *
     * @param  array{http_status:?int, body:array, latency_ms:int, connection_error:bool, error_message:?string}  $transport
     * @return array<string, mixed>
     */
    public static function classify(array $transport, bool $configured = true): array
    {
        if (! $configured) {
            return ProviderHealthProbeResult::make([
                'configured' => false,
                'connection' => 'failed',
                'authentication' => 'failed',
                'balance' => 'unknown',
                'service' => 'failed',
                'status' => ProviderHealthStatus::NOT_CONFIGURED,
                'provider_code' => null,
                'provider_message' => 'Credentials not configured',
                'http_status' => null,
                'latency_ms' => null,
                'balance_value' => null,
            ]);
        }

        $ms = (int) ($transport['latency_ms'] ?? 0);
        $http = $transport['http_status'] ?? null;
        $body = is_array($transport['body'] ?? null) ? $transport['body'] : [];
        $message = trim((string) ($body['data']['message'] ?? $body['message'] ?? $transport['error_message'] ?? ''));
        $rc = self::normalizeRc($body['data']['rc'] ?? $body['rc'] ?? null);
        $deposit = $body['data']['deposit'] ?? null;
        $connectionOk = ($ms > 3000) ? 'slow' : 'ok';

        // STEP 1 — connection / transport / 5xx
        if (! empty($transport['connection_error'])) {
            $err = strtolower((string) ($transport['error_message'] ?? ''));
            $isTimeout = str_contains($err, 'timeout')
                || str_contains($err, 'timed out')
                || str_contains($err, 'could not resolve')
                || str_contains($err, 'nameresolution')
                || str_contains($err, 'dns');

            return ProviderHealthProbeResult::make([
                'configured' => true,
                'connection' => $isTimeout ? 'timeout' : 'failed',
                'authentication' => 'unknown',
                'balance' => 'unknown',
                'service' => 'failed',
                'status' => ProviderHealthStatus::OFFLINE,
                'provider_code' => $rc,
                'provider_message' => $message !== '' ? $message : (string) ($transport['error_message'] ?? 'Connection failed'),
                'http_status' => $http,
                'latency_ms' => $ms,
                'balance_value' => null,
                'raw' => $body,
            ]);
        }

        if ($http !== null && in_array((int) $http, [500, 502, 503, 504], true)) {
            return ProviderHealthProbeResult::make([
                'configured' => true,
                'connection' => 'failed',
                'authentication' => 'unknown',
                'balance' => 'unknown',
                'service' => 'failed',
                'status' => ProviderHealthStatus::OFFLINE,
                'provider_code' => $rc,
                'provider_message' => $message !== '' ? $message : 'HTTP '.$http,
                'http_status' => $http,
                'latency_ms' => $ms,
                'balance_value' => null,
                'raw' => $body,
            ]);
        }

        // STEP 2 — official Digiflazz RC (never deposit-first)
        $rcStatus = self::statusForRc($rc);
        if ($rcStatus !== null) {
            return self::fromMappedStatus(
                $rcStatus,
                $rc,
                $message,
                $http,
                $ms,
                $connectionOk,
                $body
            );
        }

        // STEP 2b — HTTP auth without RC
        if ($http !== null && in_array((int) $http, [401, 403], true)) {
            return ProviderHealthProbeResult::make([
                'configured' => true,
                'connection' => 'ok',
                'authentication' => 'failed',
                'balance' => 'unknown',
                'service' => 'ok',
                'status' => ProviderHealthStatus::AUTH_FAILED,
                'provider_code' => $rc,
                'provider_message' => $message !== '' ? $message : 'HTTP '.$http,
                'http_status' => $http,
                'latency_ms' => $ms,
                'balance_value' => null,
                'raw' => $body,
            ]);
        }

        // Other 4xx without mapped RC → configuration / payload issue (not auth by guesswork)
        if ($http !== null && (int) $http >= 400 && (int) $http < 500) {
            return ProviderHealthProbeResult::make([
                'configured' => true,
                'connection' => 'ok',
                'authentication' => 'unknown',
                'balance' => 'unknown',
                'service' => 'ok',
                'status' => ProviderHealthStatus::CONFIG_ERROR,
                'provider_code' => $rc,
                'provider_message' => $message !== '' ? $message : 'HTTP '.$http,
                'http_status' => $http,
                'latency_ms' => $ms,
                'balance_value' => null,
                'raw' => $body,
            ]);
        }

        // STEP 3–4 — reachable + no auth/config RC → evaluate balance (deposit is secondary)
        if ($deposit !== null && $deposit !== '') {
            return ProviderHealthProbeResult::make([
                'configured' => true,
                'connection' => $connectionOk,
                'authentication' => 'ok',
                'balance' => 'ok',
                'service' => 'ok',
                'status' => ProviderHealthStatus::ONLINE,
                'provider_code' => $rc,
                'provider_message' => $message !== '' ? $message : 'OK',
                'http_status' => $http,
                'latency_ms' => $ms,
                'balance_value' => (float) $deposit,
                'raw' => $body,
            ]);
        }

        return ProviderHealthProbeResult::make([
            'configured' => true,
            'connection' => $connectionOk,
            'authentication' => 'ok',
            'balance' => 'failed',
            'service' => 'ok',
            'status' => ProviderHealthStatus::PARTIAL,
            'provider_code' => $rc,
            'provider_message' => $message !== '' ? $message : 'Balance unavailable',
            'http_status' => $http,
            'latency_ms' => $ms,
            'balance_value' => null,
            'raw' => $body,
        ]);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    protected static function fromMappedStatus(
        string $status,
        ?string $rc,
        string $message,
        mixed $http,
        int $ms,
        string $connection,
        array $body
    ): array {
        $auth = match ($status) {
            ProviderHealthStatus::AUTH_FAILED => 'failed',
            ProviderHealthStatus::CONFIG_ERROR,
            ProviderHealthStatus::NETWORK_CONFIGURATION => 'unknown',
            default => 'unknown',
        };

        return ProviderHealthProbeResult::make([
            'configured' => true,
            'connection' => $connection,
            'authentication' => $auth,
            'balance' => 'unknown',
            'service' => 'ok',
            'status' => $status,
            'provider_code' => $rc,
            'provider_message' => $message !== '' ? $message : ('RC '.$rc),
            'http_status' => $http,
            'latency_ms' => $ms,
            'balance_value' => null,
            'raw' => $body,
        ]);
    }
}
