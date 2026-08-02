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

    public function __construct()
    {
        $this->serverKey = env('MIDTRANS_SERVER_KEY', 'dummy_server_key');
        $this->clientKey = env('MIDTRANS_CLIENT_KEY', 'dummy_client_key');
        $this->isProduction = (bool) env('MIDTRANS_IS_PRODUCTION', false);

        $configuredBaseUrl = env('MIDTRANS_BASE_URL');
        if ($configuredBaseUrl) {
            $this->snapBaseUrl = rtrim($configuredBaseUrl, '/');
            $this->apiBaseUrl = rtrim($configuredBaseUrl, '/');
        } else {
            $this->snapBaseUrl = $this->isProduction
                ? 'https://app.midtrans.com/snap/v1'
                : 'https://app.sandbox.midtrans.com/snap/v1';

            $this->apiBaseUrl = $this->isProduction
                ? 'https://api.midtrans.com/v2'
                : 'https://api.sandbox.midtrans.com/v2';
        }
    }

    /**
     * Create Snap Transaction.
     */
    public function createSnapTransaction(string $orderId, float $grossAmount, array $customerDetails = [], array $itemDetails = []): array
    {
        $payload = [
            'transaction_details' => [
                'order_id' => $orderId,
                'gross_amount' => (int) $grossAmount,
            ],
            'customer_details' => $customerDetails ?: null,
            'item_details' => $itemDetails ?: null,
            'credit_card' => [
                'secure' => true,
            ]
        ];

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
