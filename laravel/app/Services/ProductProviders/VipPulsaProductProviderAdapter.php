<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;
use App\Models\Transaction;
use App\Services\VipService;
use Illuminate\Support\Facades\Log;

/**
 * VIPAYMENT product-provider adapter (VIP Reseller API).
 */
class VipPulsaProductProviderAdapter implements ProductProviderAdapterInterface
{
    public function __construct(
        protected VipService $vip,
        protected ProviderFailoverPolicy $failoverPolicy,
    ) {}

    public function code(): string
    {
        return ProductProvider::CODE_VIP;
    }

    public function isConfigured(): bool
    {
        return $this->vip->isConfigured();
    }

    public function fulfill(
        Transaction $transaction,
        string $providerSku,
        string $customerNo,
        string $refId
    ): ProviderFulfillmentResult {
        $started = microtime(true);

        if (!$this->isConfigured()) {
            $cred = $this->vip->credentialStatus();

            return ProviderFulfillmentResult::error(
                (int) ((microtime(true) - $started) * 1000),
                'provider_not_configured',
                true,
                $cred['message'] ?? (ProductProvider::vipDisplayName() . ' credentials are not configured.')
            );
        }

        try {
            $response = $this->vip->orderPrepaid($providerSku, $customerNo, $refId);
            $ms = (int) ($response['latency_ms'] ?? ((microtime(true) - $started) * 1000));

            if (!$response['success']) {
                $status = (string) ($response['api_status'] ?? 'provider_error');
                $message = (string) ($response['message'] ?? 'VIP order failed');
                $failover = $this->failoverPolicy->shouldFailover($status, $message);

                return ProviderFulfillmentResult::failed(
                    $ms,
                    $status,
                    $failover,
                    $message,
                    $response['raw'] ?? []
                );
            }

            $data = $response['raw']['data'] ?? [];
            $orderStatus = strtolower((string) ($data['status'] ?? 'pending'));
            $sn = isset($data['sn']) ? (string) $data['sn'] : (isset($data['note']) ? (string) $data['note'] : null);
            $message = (string) ($response['message'] ?? '');

            if (in_array($orderStatus, ['success', 'sukses', 'ok'], true)) {
                return ProviderFulfillmentResult::success($ms, $sn, $response['raw'] ?? [], $message ?: 'OK');
            }

            if (in_array($orderStatus, ['error', 'failed', 'gagal'], true)) {
                $reason = $this->failoverPolicy->messageLooksCustomer($message)
                    ? 'customer_validation'
                    : 'provider_rejected';
                $failover = $this->failoverPolicy->shouldFailover($reason, $message);

                return ProviderFulfillmentResult::failed(
                    $ms,
                    $reason,
                    $failover,
                    $message ?: 'VIP reported failed',
                    $response['raw'] ?? []
                );
            }

            return ProviderFulfillmentResult::pending($ms, $response['raw'] ?? [], $message ?: 'Processing');
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

    /**
     * @return array{
     *   reachable:bool,
     *   authenticated:bool,
     *   balance:?float,
     *   latency_ms:?int,
     *   message:?string,
     *   api_status:string,
     *   health_color:string,
     *   http_status:?int
     * }
     */
    public function healthCheck(): array
    {
        Log::info('EXEC TRACE — ENTER Vip adapter');

        $result = $this->vip->profile();

        $apiStatus = (string) ($result['api_status'] ?? 'offline');
        $success = (bool) ($result['success'] ?? false);

        Log::info('VIP ADAPTER — profile() result for health', [
            'success' => $success,
            'api_status' => $apiStatus,
            'health_color' => $result['health_color'] ?? null,
            'http_status' => $result['http_status'] ?? null,
            'latency_ms' => $result['latency_ms'] ?? null,
            'message' => $result['message'] ?? null,
        ]);

        return [
            'reachable' => $success || in_array($apiStatus, ['online', 'degraded'], true),
            'authenticated' => $success && $apiStatus === 'online',
            'balance' => $result['balance'] ?? null,
            'latency_ms' => $result['latency_ms'] ?? null,
            'message' => $result['message'] ?? null,
            'api_status' => $apiStatus,
            'health_color' => (string) ($result['health_color'] ?? 'red'),
            'http_status' => $result['http_status'] ?? null,
            'success' => $success,
            'raw' => $result['raw'] ?? [],
        ];
    }
}
