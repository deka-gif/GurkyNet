<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;
use App\Models\Transaction;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * VipPulsa (brand-configurable) product-provider adapter.
 * Uses VIP_* env credentials when present; otherwise reports not configured
 * so router can skip / failover cleanly without user-facing provider errors.
 */
class VipPulsaProductProviderAdapter implements ProductProviderAdapterInterface
{
    protected string $baseUrl;
    protected string $apiKey;
    protected string $apiUser;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) (config('services.vip.base_url') ?: env('VIP_BASE_URL', '')), '/');
        $this->apiKey = (string) (config('services.vip.api_key') ?: env('VIP_API_KEY', ''));
        $this->apiUser = (string) (config('services.vip.username') ?: env('VIP_USERNAME', ''));
    }

    public function code(): string
    {
        return ProductProvider::CODE_VIP;
    }

    public function isConfigured(): bool
    {
        return $this->baseUrl !== ''
            && $this->apiKey !== ''
            && $this->apiUser !== ''
            && !in_array($this->apiKey, ['dummy', 'dummy_api_key'], true);
    }

    public function fulfill(
        Transaction $transaction,
        string $providerSku,
        string $customerNo,
        string $refId
    ): ProviderFulfillmentResult {
        $started = microtime(true);

        if (!$this->isConfigured()) {
            return ProviderFulfillmentResult::error(
                (int) ((microtime(true) - $started) * 1000),
                'provider_not_configured',
                true,
                ProductProvider::vipDisplayName() . ' credentials are not configured.'
            );
        }

        try {
            $timeout = app()->environment('testing') ? 5 : 30;
            $response = Http::timeout($timeout)
                ->connectTimeout(app()->environment('testing') ? 2 : 10)
                ->acceptJson()
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'X-Api-User' => $this->apiUser,
                ])
                ->post($this->baseUrl . '/transaction', [
                    'sku' => $providerSku,
                    'customer_no' => $customerNo,
                    'ref_id' => $refId,
                ]);

            $ms = (int) ((microtime(true) - $started) * 1000);
            $body = $response->json() ?? [];

            if ($response->serverError()) {
                return ProviderFulfillmentResult::failed(
                    $ms,
                    'http_5xx',
                    true,
                    'VIP HTTP ' . $response->status(),
                    $body
                );
            }

            if (!$response->successful()) {
                return ProviderFulfillmentResult::failed(
                    $ms,
                    'http_error',
                    true,
                    'VIP HTTP ' . $response->status(),
                    $body
                );
            }

            $status = strtolower((string) ($body['status'] ?? $body['data']['status'] ?? 'pending'));
            $sn = $body['sn'] ?? $body['data']['sn'] ?? null;
            $message = (string) ($body['message'] ?? $body['data']['message'] ?? '');

            if (in_array($status, ['success', 'sukses', 'ok'], true)) {
                return ProviderFulfillmentResult::success($ms, $sn ? (string) $sn : null, $body, $message ?: 'OK');
            }

            if (in_array($status, ['failed', 'gagal', 'error'], true)) {
                return ProviderFulfillmentResult::failed(
                    $ms,
                    'provider_rejected',
                    $this->shouldFailover($message),
                    $message ?: 'VIP reported failed.',
                    $body
                );
            }

            return ProviderFulfillmentResult::pending($ms, $body, $message ?: 'Processing');
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return ProviderFulfillmentResult::error(
                (int) ((microtime(true) - $started) * 1000),
                'timeout',
                true,
                $e->getMessage()
            );
        } catch (\Throwable $e) {
            Log::warning('VIP adapter fulfill error', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            return ProviderFulfillmentResult::error(
                (int) ((microtime(true) - $started) * 1000),
                'provider_exception',
                true,
                $e->getMessage()
            );
        }
    }

    public function healthCheck(): array
    {
        $started = microtime(true);

        if (!$this->isConfigured()) {
            return [
                'reachable' => false,
                'authenticated' => false,
                'balance' => null,
                'latency_ms' => null,
                'message' => 'Credentials not configured',
            ];
        }

        try {
            $response = Http::timeout(10)
                ->acceptJson()
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'X-Api-User' => $this->apiUser,
                ])
                ->get($this->baseUrl . '/balance');

            $ms = (int) ((microtime(true) - $started) * 1000);
            $ok = $response->successful();
            $balance = $ok ? (float) ($response->json('balance') ?? $response->json('data.balance') ?? 0) : null;

            return [
                'reachable' => $ok,
                'authenticated' => $ok,
                'balance' => $balance,
                'latency_ms' => $ms,
                'message' => $ok ? 'OK' : ('HTTP ' . $response->status()),
            ];
        } catch (\Throwable $e) {
            return [
                'reachable' => false,
                'authenticated' => false,
                'balance' => null,
                'latency_ms' => (int) ((microtime(true) - $started) * 1000),
                'message' => $e->getMessage(),
            ];
        }
    }

    protected function shouldFailover(string $message): bool
    {
        $m = strtolower($message);
        foreach (['saldo', 'balance', 'maintenance', 'timeout', 'gangguan', 'offline', 'server'] as $needle) {
            if (str_contains($m, $needle)) {
                return true;
            }
        }

        return true;
    }
}
