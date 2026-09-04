<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MidtransService
{
    protected string $serverKey;
    protected string $clientKey;
    protected bool $isProduction;
    protected string $snapBaseUrl;
    protected string $apiBaseUrl;

    public function __construct(?\App\Services\Payment\MidtransCredentialResolver $resolver = null)
    {
        $resolver ??= app(\App\Services\Payment\MidtransCredentialResolver::class);
        $this->applyCredentials($resolver->resolve());
    }

    public function refreshCredentials(): void
    {
        $this->applyCredentials(app(\App\Services\Payment\MidtransCredentialResolver::class)->resolve());
    }

    /**
     * @param  array{server_key:string,client_key:string,is_production:bool,base_url:?string}  $creds
     */
    protected function applyCredentials(array $creds): void
    {
        $this->serverKey = (string) ($creds['server_key'] ?? '');
        $this->clientKey = (string) ($creds['client_key'] ?? '');
        $this->isProduction = (bool) ($creds['is_production'] ?? false);

        $configuredBaseUrl = $creds['base_url'] ?? null;
        if ($configuredBaseUrl) {
            $this->snapBaseUrl = rtrim((string) $configuredBaseUrl, '/');
            $this->apiBaseUrl = rtrim((string) $configuredBaseUrl, '/');
        } else {
            $this->snapBaseUrl = $this->isProduction
                ? 'https://app.midtrans.com/snap/v1'
                : 'https://app.sandbox.midtrans.com/snap/v1';

            $this->apiBaseUrl = $this->isProduction
                ? 'https://api.midtrans.com/v2'
                : 'https://api.sandbox.midtrans.com/v2';
        }
    }

    public function isConfigured(): bool
    {
        $placeholders = ['', 'dummy_server_key', 'dummy_client_key'];

        return !in_array($this->serverKey, $placeholders, true)
            && !in_array($this->clientKey, $placeholders, true);
    }

    public function getServerKey(): string
    {
        return $this->serverKey;
    }

    public function getClientKey(): string
    {
        return $this->clientKey;
    }

    public function isProduction(): bool
    {
        return $this->isProduction;
    }

    protected function assertConfigured(): void
    {
        $this->refreshCredentials();
        if (!$this->isConfigured()) {
            throw new \App\Exceptions\Payment\PaymentGatewayNotConfiguredException();
        }
    }

    /**
     * Create Snap Transaction.
     *
     * @param  array{enabled_payments?:list<string>,expiry?:array}  $options
     */
    public function createSnapTransaction(string $orderId, float $grossAmount, array $customerDetails = [], array $itemDetails = [], array $options = []): array
    {
        $this->assertConfigured();

        $enabledPayments = [];
        if (isset($options['enabled_payments']) && is_array($options['enabled_payments'])) {
            $enabledPayments = array_values(array_filter($options['enabled_payments'], 'is_string'));
        }

        $payload = [
            'transaction_details' => [
                'order_id' => $orderId,
                'gross_amount' => (int) $grossAmount,
            ],
            'customer_details' => $customerDetails ?: null,
            'item_details' => $itemDetails ?: null,
        ];

        // Only request credit card when it is in the Snap filter (or no filter — legacy callers).
        if ($enabledPayments === [] || in_array('credit_card', $enabledPayments, true)) {
            $payload['credit_card'] = ['secure' => true];
        }

        if ($enabledPayments !== []) {
            $payload['enabled_payments'] = $enabledPayments;
        }

        if (! empty($options['expiry']) && is_array($options['expiry'])) {
            $payload['expiry'] = $options['expiry'];
        }

        // Snap "Return to merchant’s page" — must be GurkyNet, never Midtrans dashboard default (example.com).
        // FR-TOPUP-UX-02 — finish URL is customer transaction detail only (no tokens/credentials).
        $finishUrl = $options['finish_redirect_url'] ?? null;
        if (is_string($finishUrl) && $finishUrl !== '') {
            $payload['callbacks'] = [
                'finish' => $finishUrl,
            ];
        }

        // Clean out nulls
        $payload = array_filter($payload);

        return $this->postRequest($this->snapBaseUrl . '/transactions', $payload);
    }

    /**
     * Create Core API Transaction.
     */
    public function createCoreApiTransaction(array $payload): array
    {
        return $this->postRequest($this->apiBaseUrl . '/charge', $payload);
    }

    /**
     * Check transaction status.
     */
    public function checkStatus(string $orderId): array
    {
        return $this->getRequest($this->apiBaseUrl . '/' . $orderId . '/status', $orderId);
    }

    /**
     * Cancel transaction.
     */
    public function cancel(string $orderId): array
    {
        return $this->postRequest($this->apiBaseUrl . '/' . $orderId . '/cancel', [], $orderId);
    }

    /**
     * Force transaction to expire.
     */
    public function expire(string $orderId): array
    {
        return $this->postRequest($this->apiBaseUrl . '/' . $orderId . '/expire', [], $orderId);
    }

    /**
     * Refund a paid transaction.
     */
    public function refund(string $orderId, float $amount, string $reason = '', string $refundKey = ''): array
    {
        $payload = [
            'refund_key' => $refundKey ?: 'REF-' . $orderId . '-' . time(),
            'amount' => (int) $amount,
            'reason' => $reason ?: 'Refund requested',
        ];

        return $this->postRequest($this->apiBaseUrl . '/' . $orderId . '/refund', $payload, $orderId);
    }

    /**
     * Generate standard Authorization header.
     */
    protected function getHeaders(): array
    {
        return [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            'Authorization' => 'Basic ' . base64_encode($this->serverKey . ':'),
        ];
    }

    /**
     * Execute HTTP POST with exponential backoff and comprehensive logging.
     */
    protected function postRequest(string $url, array $payload, string $orderId = '', int $maxRetries = 3): array
    {
        $this->refreshCredentials();
        $attempt = 0;
        $delay = 1000; // millisecond delay start

        // Extract order ID if not passed directly
        if (empty($orderId) && isset($payload['transaction_details']['order_id'])) {
            $orderId = $payload['transaction_details']['order_id'];
        }

        while (true) {
            $attempt++;
            $startTime = microtime(true);

            try {
                Log::info("Midtrans POST Request Attempt {$attempt}", [
                    'url' => $url,
                    'payload' => $payload,
                    'order_id' => $orderId,
                ]);

                $response = Http::timeout(10)
                    ->withHeaders($this->getHeaders())
                    ->post($url, $payload);

                $latency = microtime(true) - $startTime;

                Log::info("Midtrans POST Response Attempt {$attempt}", [
                    'status' => $response->status(),
                    'body' => $response->json(),
                    'latency' => $latency,
                    'order_id' => $orderId,
                ]);

                if ($response->successful()) {
                    return $response->json() ?? [];
                }

                // If 5xx Server Error or Rate Limit, retry
                if (($response->serverError() || $response->status() === 429) && $attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }

                throw new \Exception("Midtrans API Error (" . $response->status() . "): " . $response->body());

            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                $latency = microtime(true) - $startTime;
                Log::error("Midtrans Connection Exception Attempt {$attempt}", [
                    'message' => $e->getMessage(),
                    'latency' => $latency,
                    'order_id' => $orderId,
                ]);

                if ($attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }
                throw $e;
            } catch (\Exception $e) {
                $latency = microtime(true) - $startTime;
                Log::error("Midtrans Unexpected Exception Attempt {$attempt}", [
                    'message' => $e->getMessage(),
                    'latency' => $latency,
                    'order_id' => $orderId,
                ]);

                if ($attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }
                throw $e;
            }
        }
    }

    /**
     * Execute HTTP GET with exponential backoff and comprehensive logging.
     */
    protected function getRequest(string $url, string $orderId = '', int $maxRetries = 3): array
    {
        $this->refreshCredentials();
        $attempt = 0;
        $delay = 1000;

        while (true) {
            $attempt++;
            $startTime = microtime(true);

            try {
                Log::info("Midtrans GET Request Attempt {$attempt}", [
                    'url' => $url,
                    'order_id' => $orderId,
                ]);

                $response = Http::timeout(10)
                    ->withHeaders($this->getHeaders())
                    ->get($url);

                $latency = microtime(true) - $startTime;

                Log::info("Midtrans GET Response Attempt {$attempt}", [
                    'status' => $response->status(),
                    'body' => $response->json(),
                    'latency' => $latency,
                    'order_id' => $orderId,
                ]);

                if ($response->successful()) {
                    return $response->json() ?? [];
                }

                if (($response->serverError() || $response->status() === 429) && $attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }

                throw new \Exception("Midtrans API Error (" . $response->status() . "): " . $response->body());

            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                $latency = microtime(true) - $startTime;
                Log::error("Midtrans Connection Exception Attempt {$attempt}", [
                    'message' => $e->getMessage(),
                    'latency' => $latency,
                    'order_id' => $orderId,
                ]);

                if ($attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }
                throw $e;
            } catch (\Exception $e) {
                $latency = microtime(true) - $startTime;
                Log::error("Midtrans Unexpected Exception Attempt {$attempt}", [
                    'message' => $e->getMessage(),
                    'latency' => $latency,
                    'order_id' => $orderId,
                ]);

                if ($attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }
                throw $e;
            }
        }
    }
}
