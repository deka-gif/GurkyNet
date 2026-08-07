<?php

namespace App\Services\ProductProviders;

/**
 * Canonical health-probe payload shared by every product-provider adapter.
 * Control Center / Dashboard must only render these fields — never classify provider responses.
 *
 * @phpstan-type IndicatorValue 'ok'|'failed'|'timeout'|'slow'|'unknown'
 * @phpstan-type HealthStatus string
 */
final class ProviderHealthProbeResult
{
    /**
     * @param  array{
     *   connection?:string,
     *   authentication?:string,
     *   balance?:string,
     *   service?:string,
     *   status:string,
     *   provider_code?:string|null,
     *   provider_message?:string|null,
     *   http_status?:int|null,
     *   latency_ms?:int|null,
     *   balance_value?:float|null,
     *   configured?:bool,
     *   raw?:mixed
     * }  $data
     * @return array<string, mixed>
     */
    public static function make(array $data): array
    {
        $connection = strtolower((string) ($data['connection'] ?? 'unknown'));
        $authentication = strtolower((string) ($data['authentication'] ?? 'unknown'));
        $balance = strtolower((string) ($data['balance'] ?? 'unknown'));
        $service = strtolower((string) ($data['service'] ?? 'ok'));
        $status = strtolower((string) ($data['status'] ?? ''));
        $message = isset($data['provider_message']) ? trim((string) $data['provider_message']) : null;
        if ($message === '') {
            $message = null;
        }
        $code = isset($data['provider_code']) ? trim((string) $data['provider_code']) : null;
        if ($code === '') {
            $code = null;
        }

        $balanceValue = array_key_exists('balance_value', $data) ? $data['balance_value'] : null;
        if ($balanceValue !== null) {
            $balanceValue = (float) $balanceValue;
        }

        return [
            // Standard flat contract (UI / HealthService).
            'connection' => $connection,
            'authentication' => $authentication,
            'balance' => $balance,
            'service' => $service,
            'status' => $status,
            'provider_code' => $code,
            'provider_message' => $message,
            'http_status' => $data['http_status'] ?? null,
            'latency_ms' => $data['latency_ms'] ?? null,
            'balance_value' => $balanceValue,
            'configured' => (bool) ($data['configured'] ?? true),

            // Compatibility with existing HealthService persist paths.
            'message' => $message,
            'reachable' => in_array($connection, ['ok', 'slow'], true),
            'authenticated' => $authentication === 'ok',
            // Numeric balance for DB column — never confuse with balance indicator.
            'balance_amount' => $balanceValue,
            'indicators' => [
                'connection' => $connection,
                'authentication' => $authentication,
                'balance' => $balance,
                'service' => $service,
                'status' => $status,
                'provider_code' => $code,
            ],
            'raw' => $data['raw'] ?? null,
        ];
    }
}
