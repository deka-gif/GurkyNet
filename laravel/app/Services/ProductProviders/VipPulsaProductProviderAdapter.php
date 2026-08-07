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
            Log::info('CREATE ORDER', [
                'transaction_id' => $transaction->id,
                'invoice' => $refId,
                'provider_sku' => $providerSku,
                'target' => $customerNo,
            ]);

            $response = $this->vip->orderPrepaid($providerSku, $customerNo, $refId);
            $ms = (int) ($response['latency_ms'] ?? ((microtime(true) - $started) * 1000));
            $raw = $response['raw'] ?? [];
            $extracted = VipOrderPayload::extract(is_array($raw) ? $raw : []);

            Log::info('CREATE RESPONSE', [
                'transaction_id' => $transaction->id,
                'success' => (bool) ($response['success'] ?? false),
                'trxid' => $extracted['trxid'],
                'normalized_status' => $extracted['status'],
                'message' => $response['message'] ?? null,
            ]);

            // Persist VIP Transaction ID immediately — status polling depends on it.
            $this->persistProviderContext($transaction, $extracted, $providerSku, is_array($raw) ? $raw : []);

            if (!$response['success']) {
                $status = (string) ($response['api_status'] ?? 'provider_error');
                $message = (string) ($response['message'] ?? 'VIP order failed');
                $failover = $this->failoverPolicy->shouldFailover($status, $message);

                return ProviderFulfillmentResult::failed(
                    $ms,
                    $status,
                    $failover,
                    $message,
                    $raw
                );
            }

            $message = (string) ($response['message'] ?? $extracted['note'] ?? '');

            if ($extracted['status'] === 'success') {
                return ProviderFulfillmentResult::success($ms, $extracted['sn'], $raw, $message ?: 'OK');
            }

            if ($extracted['status'] === 'failed') {
                $reason = $this->failoverPolicy->messageLooksCustomer($message)
                    ? 'customer_validation'
                    : 'provider_rejected';
                $failover = $this->failoverPolicy->shouldFailover($reason, $message);

                return ProviderFulfillmentResult::failed(
                    $ms,
                    $reason,
                    $failover,
                    $message ?: 'VIP reported failed',
                    $raw
                );
            }

            // waiting / processing — order accepted; timeout engine will poll with provider_ref
            return ProviderFulfillmentResult::pending($ms, $raw, $message ?: 'Processing');
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

    public function checkStatus(
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
                false,
                ProductProvider::vipDisplayName() . ' credentials are not configured.'
            );
        }

        try {
            $trxId = $transaction->provider_ref ?: null;

            Log::info('CHECK STATUS', [
                'transaction_id' => $transaction->id,
                'provider_ref' => $trxId,
                'invoice' => $refId,
                'provider_sku' => $providerSku,
            ]);

            if (!$trxId) {
                Log::error('CHECK STATUS — missing provider_ref; cannot query VIP accurately', [
                    'transaction_id' => $transaction->id,
                    'invoice' => $refId,
                ]);
            }

            $response = $this->vip->checkPrepaidStatus($trxId, $refId);
            $ms = (int) ($response['latency_ms'] ?? ((microtime(true) - $started) * 1000));
            $raw = $response['raw'] ?? [];
            $extracted = VipOrderPayload::extract(is_array($raw) ? $raw : [], $trxId);

            // Backfill trxid if we discovered it during polling.
            if (!$trxId && $extracted['trxid']) {
                $this->persistProviderContext($transaction, $extracted, $providerSku, is_array($raw) ? $raw : []);
                $trxId = $extracted['trxid'];
            } elseif ($trxId) {
                // Refresh last provider response on every poll.
                $transaction->forceFill([
                    'provider_response' => is_array($raw) ? $raw : ['raw' => $raw],
                    'provider_last_status' => $extracted['status'],
                    'provider_checked_at' => now(),
                ])->save();
            }

            $status = (string) ($response['normalized_status'] ?? $extracted['status']);
            $sn = $response['sn'] ?? $extracted['sn'];
            $message = (string) ($response['message'] ?? $extracted['note'] ?? '');

            Log::info('CHECK RESPONSE', [
                'transaction_id' => $transaction->id,
                'provider_ref' => $trxId,
                'normalized_status' => $status,
                'sn' => $sn,
                'message' => $message,
            ]);

            if ($status === 'success') {
                return ProviderFulfillmentResult::success($ms, $sn ? (string) $sn : null, $raw, $message ?: 'OK');
            }

            if ($status === 'failed') {
                return ProviderFulfillmentResult::failed(
                    $ms,
                    'provider_rejected',
                    false,
                    $message ?: 'VIP reported failed',
                    $raw
                );
            }

            return ProviderFulfillmentResult::pending($ms, $raw, $message ?: 'Still processing');
        } catch (\Throwable $e) {
            Log::error('VIP CHECK STATUS — exception', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            return ProviderFulfillmentResult::pending(
                (int) ((microtime(true) - $started) * 1000),
                ['error' => $e->getMessage()],
                'VIP status check error: ' . $e->getMessage()
            );
        }
    }

    /**
     * Persist VIP order context so WatchPendingTransactionJob can poll accurately.
     *
     * @param  array{trxid:?string,status:string,sn:?string,note:?string,provider_time:?string,row:array<string,mixed>}  $extracted
     * @param  array<string, mixed>  $raw
     */
    protected function persistProviderContext(
        Transaction $transaction,
        array $extracted,
        string $providerSku,
        array $raw
    ): void {
        $trxid = $extracted['trxid'] ?? null;
        if (!$trxid) {
            Log::error('STORE PROVIDER REF — trxid missing from payload', [
                'transaction_id' => $transaction->id,
                'raw_keys' => array_keys($raw),
            ]);

            return;
        }

        $providerTime = null;
        if (!empty($extracted['provider_time'])) {
            try {
                $providerTime = \Carbon\Carbon::parse((string) $extracted['provider_time']);
            } catch (\Throwable) {
                $providerTime = now();
            }
        }

        $transaction->forceFill([
            'fulfillment_provider_code' => ProductProvider::CODE_VIP,
            'provider_sku_used' => $providerSku ?: $transaction->provider_sku_used,
            'provider_ref' => $trxid,
            'provider_response' => $raw,
            'provider_transaction_time' => $providerTime ?? $transaction->provider_transaction_time ?? now(),
            'provider_last_status' => $extracted['status'] ?? $transaction->provider_last_status,
        ])->save();

        Log::info('STORE PROVIDER REF', [
            'transaction_id' => $transaction->id,
            'provider_ref' => $trxid,
            'provider_code' => ProductProvider::CODE_VIP,
            'provider_sku' => $providerSku,
            'provider_transaction_time' => optional($transaction->provider_transaction_time)->toIso8601String(),
            'normalized_status' => $extracted['status'] ?? null,
        ]);
    }

    public function healthCheck(): array
    {
        Log::info('EXEC TRACE — ENTER Vip adapter');

        $result = $this->vip->profile();

        $apiStatus = (string) ($result['api_status'] ?? 'offline');
        $success = (bool) ($result['success'] ?? false);
        $balance = $result['balance'] ?? null;

        Log::info('VIP ADAPTER — profile() result for health', [
            'success' => $success,
            'api_status' => $apiStatus,
            'health_color' => $result['health_color'] ?? null,
            'http_status' => $result['http_status'] ?? null,
            'latency_ms' => $result['latency_ms'] ?? null,
            'message' => $result['message'] ?? null,
            'balance' => $balance,
        ]);

        $connection = 'failed';
        $authentication = 'unknown';
        $balanceStatus = 'failed';

        if ($apiStatus === 'not_configured') {
            $connection = 'failed';
            $authentication = 'failed';
        } elseif ($apiStatus === 'auth_failed') {
            $connection = 'ok';
            $authentication = 'failed';
        } elseif (in_array($apiStatus, ['timeout', 'offline'], true) && ! $success) {
            $connection = $apiStatus === 'timeout' ? 'timeout' : 'failed';
        } elseif ($success || in_array($apiStatus, ['online', 'degraded', 'partial'], true)) {
            $connection = (($result['latency_ms'] ?? 0) > 3000) ? 'slow' : 'ok';
            $authentication = 'ok';
            $balanceStatus = $balance !== null ? 'ok' : 'failed';
        }

        return [
            'reachable' => in_array($connection, ['ok', 'slow'], true),
            'authenticated' => $authentication === 'ok',
            'balance' => $balance,
            'latency_ms' => $result['latency_ms'] ?? null,
            'message' => $result['message'] ?? null,
            'http_status' => $result['http_status'] ?? null,
            'configured' => $apiStatus !== 'not_configured',
            // Do not force api_status from VIP profile alone — HealthService evaluates indicators.
            'indicators' => [
                'connection' => $connection,
                'authentication' => $authentication,
                'balance' => $balanceStatus,
            ],
            'success' => $success,
            'raw' => $result['raw'] ?? $result,
        ];
    }
}
