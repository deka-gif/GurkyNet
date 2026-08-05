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
    public function __construct(protected DigiflazzService $digiflazz) {}

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

            $response = $this->digiflazz->buy($providerSku, $customerNo, $refId);
            $ms = (int) ((microtime(true) - $started) * 1000);
            $data = $response['data'] ?? null;

            if (!$data || !is_array($data)) {
                return ProviderFulfillmentResult::failed(
                    $ms,
                    'invalid_response',
                    true,
                    'Invalid or empty Digiflazz response.',
                    is_array($response) ? $response : []
                );
            }

            $status = strtolower((string) ($data['status'] ?? 'pending'));
            $sn = isset($data['sn']) ? (string) $data['sn'] : null;
            $message = (string) ($data['message'] ?? $data['rc'] ?? '');

            if ($status === 'success') {
                return ProviderFulfillmentResult::success($ms, $sn, $response, $message ?: 'OK');
            }

            if ($status === 'failed') {
                $failover = $this->shouldFailoverOnFailedMessage($message);

                return ProviderFulfillmentResult::failed(
                    $ms,
                    $failover ? $this->classifyFailureReason($message) : 'provider_rejected',
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

            return ProviderFulfillmentResult::error(
                $ms,
                $this->classifyException($e),
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
            $balance = $this->digiflazz->checkBalance();
            $ms = (int) ((microtime(true) - $started) * 1000);

            return [
                'reachable' => $balance !== null,
                'authenticated' => $balance !== null,
                'balance' => $balance,
                'latency_ms' => $ms,
                'message' => $balance !== null ? 'OK' : 'Balance check returned null',
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

    protected function shouldFailoverOnFailedMessage(string $message): bool
    {
        $m = strtolower($message);

        foreach ([
            'saldo', 'balance', 'insufficient',
            'timeout', 'maintenance', 'gangguan',
            'offline', 'server', 'internal',
            'cut off', 'sedang gangguan',
        ] as $needle) {
            if (str_contains($m, $needle)) {
                return true;
            }
        }

        // rc-style / empty — allow failover so secondary provider can try
        return $message === '' || preg_match('/\b5\d{2}\b/', $message) === 1;
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
