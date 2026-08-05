<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DigiflazzService
{
    protected string $username;
    protected string $apiKey;
    protected string $baseUrl;

    public function __construct()
    {
        $this->username = (string) (config('services.digiflazz.username') ?: env('DIGIFLAZZ_USERNAME', ''));
        $this->apiKey = (string) (config('services.digiflazz.api_key') ?: env('DIGIFLAZZ_API_KEY', ''));
        $this->baseUrl = rtrim((string) (config('services.digiflazz.base_url') ?: env('DIGIFLAZZ_BASE_URL', 'https://api.digiflazz.com/v1')), '/');
    }

    /**
     * Generate MD5 Signature for Digiflazz requests.
     */
    public function sign(string $refId): string
    {
        return md5($this->username . $this->apiKey . $refId);
    }

    /**
     * Call Digiflazz Inquiry.
     */
    public function inquiry(string $sku, string $customerNo, string $refId): array
    {
        $payload = [
            'username' => $this->username,
            'buyer_sku_code' => $sku,
            'customer_no' => $customerNo,
            'ref_id' => $refId,
            'sign' => $this->sign($refId),
        ];

        return $this->postRequest('/transaction', $payload);
    }

    /**
     * Buy prepaid product.
     */
    public function buy(string $sku, string $customerNo, string $refId): array
    {
        $this->assertConfigured();

        $payload = [
            'username' => $this->username,
            'buyer_sku_code' => $sku,
            'customer_no' => $customerNo,
            'ref_id' => $refId,
            'sign' => $this->sign($refId),
        ];

        return $this->postRequest('/transaction', $payload);
    }

    /**
     * Check transaction status.
     */
    public function checkStatus(string $sku, string $customerNo, string $refId): array
    {
        $payload = [
            'username' => $this->username,
            'buyer_sku_code' => $sku,
            'customer_no' => $customerNo,
            'ref_id' => $refId,
            'cmd' => 'status',
            'sign' => $this->sign($refId),
        ];

        return $this->postRequest('/transaction', $payload);
    }

    /**
     * Fetch pricelist (prepaid or postpaid).
     */
    public function fetchPriceList(string $cmd = 'prepaid'): array
    {
        $this->assertConfigured();

        $payload = [
            'cmd' => $cmd,
            'username' => $this->username,
            'sign' => $this->sign('pricelist'),
        ];

        return $this->postRequest('/price-list', $payload);
    }

    /**
     * Whether real (non-placeholder) Digiflazz credentials are configured.
     */
    public function isConfigured(): bool
    {
        $placeholder = ['', 'dummy_username', 'dummy_api_key'];

        return !in_array($this->username, $placeholder, true)
            && !in_array($this->apiKey, $placeholder, true);
    }

    /**
     * Fail closed when production credentials are missing.
     */
    protected function assertConfigured(): void
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Digiflazz credentials are not configured.');
        }
    }

    /**
     * Check live deposit balance on Digiflazz (cek-saldo API).
     * Returns the balance as float, or null when unavailable.
     */
    public function checkBalance(): ?float
    {
        if (!$this->isConfigured()) {
            return null;
        }

        $payload = [
            'cmd' => 'deposit',
            'username' => $this->username,
            'sign' => md5($this->username . $this->apiKey . 'depo'),
        ];

        try {
            $response = $this->postRequest('/cek-saldo', $payload, 1);
            $deposit = $response['data']['deposit'] ?? null;

            return $deposit !== null ? (float) $deposit : null;
        } catch (\Throwable $e) {
            Log::warning('Digiflazz balance check failed', ['message' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Perform HTTP POST request to Digiflazz with exponential backoff retry and precise logging.
     */
    protected function postRequest(string $endpoint, array $payload, int $maxRetries = 3): array
    {
        $url = $this->baseUrl . $endpoint;
        $attempt = 0;
        $delay = 1000; // millisecond delay start
        if (app()->environment('testing')) {
            $maxRetries = 1;
        }

        while (true) {
            $attempt++;
            $startTime = microtime(true);

            try {
                Log::info("Digiflazz API Request Attempt {$attempt}", [
                    'url' => $url,
                    'payload' => array_merge($payload, ['sign' => '***hidden***']),
                ]);

                $timeout = app()->environment('testing') ? 5 : 30;
                $connectTimeout = app()->environment('testing') ? 2 : 10;

                $response = Http::timeout($timeout)
                    ->connectTimeout($connectTimeout)
                    ->withHeaders(['Content-Type' => 'application/json'])
                    ->post($url, $payload);

                $latency = microtime(true) - $startTime;

                Log::info("Digiflazz API Response Attempt {$attempt}", [
                    'status' => $response->status(),
                    'body' => $response->json(),
                    'latency' => $latency,
                    'provider_reference' => $payload['ref_id'] ?? null,
                ]);

                if ($response->successful()) {
                    return $response->json() ?? [];
                }

                // If 5xx Server Error or Rate Limit, try retry
                if (($response->serverError() || $response->status() === 429) && $attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }

                throw new \Exception("Digiflazz API error (" . $response->status() . "): " . $response->body());

            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                $latency = microtime(true) - $startTime;
                Log::error("Digiflazz API Connection Exception Attempt {$attempt}", [
                    'message' => $e->getMessage(),
                    'latency' => $latency,
                    'provider_reference' => $payload['ref_id'] ?? null,
                ]);

                if ($attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }
                throw $e;
            } catch (\Exception $e) {
                $latency = microtime(true) - $startTime;
                Log::error("Digiflazz API Unexpected Exception Attempt {$attempt}", [
                    'message' => $e->getMessage(),
                    'latency' => $latency,
                    'provider_reference' => $payload['ref_id'] ?? null,
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
