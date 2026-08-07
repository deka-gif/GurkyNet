<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;
use App\Models\Transaction;
use App\Services\DigiflazzService;
use Illuminate\Support\Facades\Log;

/**
 * Digiflazz product-provider adapter.
 * Preserves existing Digiflazz buy semantics used by ProcessDigiflazzTransaction.
 */
class DigiflazzProductProviderAdapter implements ProductProviderAdapterInterface
{
    public function __construct(
        protected DigiflazzService $digiflazz,
        protected ProviderFailoverPolicy $failoverPolicy,
    ) {}

    public function code(): string
    {
        return ProductProvider::CODE_DIGIFLAZZ;
    }

    public function isConfigured(): bool
    {
        return $this->digiflazz->isConfigured();
    }

    public function fulfill(
        Transaction $transaction,
        string $providerSku,
        string $customerNo,
        string $refId
    ): ProviderFulfillmentResult {
        $started = microtime(true);

        try {
            if (!$this->isConfigured()) {
                return ProviderFulfillmentResult::error(
                    (int) ((microtime(true) - $started) * 1000),
                    'provider_not_configured',
                    true,
                    'Digiflazz credentials are not configured.'
                );
            }

            $isPasca = $this->isPascaTransaction($transaction);
            $response = $isPasca
                ? $this->digiflazz->payPasca($providerSku, $customerNo, $refId)
                : $this->digiflazz->buy($providerSku, $customerNo, $refId);
            $ms = (int) ((microtime(true) - $started) * 1000);
            $data = $response['data'] ?? null;

            if (!$data || !is_array($data)) {
                return ProviderFulfillmentResult::failed(
                    $ms,
                    'invalid_response',
                    !$isPasca,
                    'Invalid or empty Digiflazz response.',
                    is_array($response) ? $response : []
                );
            }

            $status = strtolower((string) ($data['status'] ?? 'pending'));
            $sn = isset($data['sn']) ? (string) $data['sn'] : null;
            $message = (string) ($data['message'] ?? $data['rc'] ?? '');

            if ($status === 'success' || $status === 'sukses') {
                return ProviderFulfillmentResult::success($ms, $sn, $response, $message ?: 'OK');
            }

            if ($status === 'failed' || $status === 'gagal') {
                $reason = $this->classifyFailureReason($message);
                if ($this->failoverPolicy->messageLooksCustomer($message)) {
                    $reason = 'customer_validation';
                }
                // pay-pasca ref_id is bound to Digiflazz inquiry — never failover to another provider.
                $failover = !$isPasca && $this->failoverPolicy->shouldFailover($reason, $message);

                return ProviderFulfillmentResult::failed(
                    $ms,
                    $failover ? $reason : ($reason === 'customer_validation' ? 'customer_validation' : 'provider_rejected'),
                    $failover,
                    $message ?: 'Digiflazz reported failed.',
                    $response
                );
            }

            // pending / processing — do not failover; Digiflazz owns the ref_id
            return ProviderFulfillmentResult::pending($ms, $response, $message ?: 'Processing');
        } catch (\Throwable $e) {
            $ms = (int) ((microtime(true) - $started) * 1000);
            Log::warning('Digiflazz adapter fulfill error', [
                'transaction_id' => $transaction->id,
                'error' => $e->getMessage(),
            ]);

            $isPasca = $this->isPascaTransaction($transaction);

            return ProviderFulfillmentResult::error(
                $ms,
                $this->classifyException($e),
                !$isPasca,
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

        try {
            if (!$this->isConfigured()) {
                return ProviderFulfillmentResult::error(
                    (int) ((microtime(true) - $started) * 1000),
                    'provider_not_configured',
                    false,
                    'Digiflazz credentials are not configured.'
                );
            }

            $isPasca = $this->isPascaTransaction($transaction);
            $response = $isPasca
                ? $this->digiflazz->checkStatusPasca($providerSku, $customerNo, $refId)
                : $this->digiflazz->checkStatus($providerSku, $customerNo, $refId);
            $ms = (int) ((microtime(true) - $started) * 1000);
            $data = $response['data'] ?? null;

            if (!$data || !is_array($data)) {
                return ProviderFulfillmentResult::pending($ms, is_array($response) ? $response : [], 'Status inquiry empty');
            }

            $status = strtolower((string) ($data['status'] ?? 'pending'));
            $sn = isset($data['sn']) ? (string) $data['sn'] : null;
            $message = (string) ($data['message'] ?? $data['rc'] ?? '');

            if ($status === 'success' || $status === 'sukses') {
                return ProviderFulfillmentResult::success($ms, $sn, $response, $message ?: 'OK');
            }

            if ($status === 'failed' || $status === 'gagal') {
                return ProviderFulfillmentResult::failed(
                    $ms,
                    'provider_rejected',
                    false,
                    $message ?: 'Digiflazz reported failed.',
                    $response
                );
            }

            return ProviderFulfillmentResult::pending($ms, $response, $message ?: 'Still processing');
        } catch (\Throwable $e) {
            return ProviderFulfillmentResult::pending(
                (int) ((microtime(true) - $started) * 1000),
                ['error' => $e->getMessage()],
                'Status check error: ' . $e->getMessage()
            );
        }
    }

    protected function isPascaTransaction(Transaction $transaction): bool
    {
        $transaction->loadMissing('items');
        $meta = $transaction->items->first()?->custom_metadata ?? [];
        if (!is_array($meta)) {
            return false;
        }

        return !empty($meta['is_pasca']) || !empty($meta['inquiry_ref_id']);
    }

    public function healthCheck(): array
    {
        $probe = $this->digiflazz->healthProbe();

        return [
            'reachable' => in_array($probe['connection'] ?? '', ['ok', 'slow'], true),
            'authenticated' => ($probe['authentication'] ?? '') === 'ok',
            'balance' => $probe['balance_value'] ?? null,
            'latency_ms' => $probe['latency_ms'] ?? null,
            'message' => $probe['message'] ?? null,
            'http_status' => $probe['http_status'] ?? null,
            'configured' => (bool) ($probe['configured'] ?? false),
            'indicators' => [
                'connection' => $probe['connection'] ?? 'unknown',
                'authentication' => $probe['authentication'] ?? 'unknown',
                'balance' => $probe['balance'] ?? 'unknown',
            ],
            'raw' => $probe,
        ];
    }

    protected function classifyFailureReason(string $message): string
    {
        $m = strtolower($message);
        if (str_contains($m, 'saldo') || str_contains($m, 'balance') || str_contains($m, 'insufficient')) {
            return 'insufficient_balance';
        }
        if (str_contains($m, 'maintenance') || str_contains($m, 'gangguan') || str_contains($m, 'cut off')) {
            return 'provider_maintenance';
        }
        if (str_contains($m, 'timeout')) {
            return 'timeout';
        }
        if (str_contains($m, 'offline')) {
            return 'provider_offline';
        }

        return 'provider_error';
    }

    protected function classifyException(\Throwable $e): string
    {
        $m = strtolower($e->getMessage());
        if ($e instanceof \Illuminate\Http\Client\ConnectionException || str_contains($m, 'timeout') || str_contains($m, 'timed out')) {
            return 'timeout';
        }
        if (str_contains($m, '500') || str_contains($m, '502') || str_contains($m, '503')) {
            return 'http_5xx';
        }
        if (str_contains($m, 'not configured')) {
            return 'provider_not_configured';
        }

        return 'provider_exception';
    }
}
