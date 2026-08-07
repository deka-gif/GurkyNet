<?php

namespace App\Services;

use App\Services\ProductProviders\DigiflazzHealthClassifier;
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
     * Prepaid PLN meter validation (inquiry-pln). Does not charge Digiflazz deposit.
     * Signature uses customer_no (not ref_id) per Digiflazz docs.
     */
    public function inquiryPln(string $customerNo): array
    {
        $this->assertConfigured();

        $payload = [
            'username' => $this->username,
            'customer_no' => $customerNo,
            'sign' => $this->sign($customerNo),
        ];

        return $this->postRequest('/inquiry-pln', $payload);
    }

    /**
     * Postpaid / e-money inquiry (inq-pasca). Does not charge Digiflazz deposit.
     * Optional $year — Digiflazz PBB (tahun pajak).
     * Optional $amount — Digiflazz E-Money denomination.
     */
    public function inquiryPasca(
        string $sku,
        string $customerNo,
        string $refId,
        ?int $year = null,
        ?int $amount = null
    ): array {
        $this->assertConfigured();

        $payload = [
            'commands' => 'inq-pasca',
            'username' => $this->username,
            'buyer_sku_code' => $sku,
            'customer_no' => $customerNo,
            'ref_id' => $refId,
            'sign' => $this->sign($refId),
        ];
        if ($year !== null && $year >= 2000 && $year <= 2100) {
            $payload['year'] = $year;
        }
        if ($amount !== null && $amount > 0) {
            $payload['amount'] = $amount;
        }

        return $this->postRequest('/transaction', $payload);
    }

    /**
     * Alias — postpaid inquiry must use inq-pasca.
     */
    public function inquiry(string $sku, string $customerNo, string $refId): array
    {
        return $this->inquiryPasca($sku, $customerNo, $refId);
    }

    /**
     * Postpaid bill payment (pay-pasca). Must reuse the same ref_id as inquiry.
     */
    public function payPasca(string $sku, string $customerNo, string $refId): array
    {
        $this->assertConfigured();

        $payload = [
            'commands' => 'pay-pasca',
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
     * Check prepaid transaction status.
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
     * Check postpaid transaction status (status-pasca).
     */
    public function checkStatusPasca(string $sku, string $customerNo, string $refId): array
    {
        $this->assertConfigured();

        $payload = [
            'commands' => 'status-pasca',
            'username' => $this->username,
            'buyer_sku_code' => $sku,
            'customer_no' => $customerNo,
            'ref_id' => $refId,
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
        $probe = $this->healthProbe();

        return $probe['balance_value'] ?? null;
    }

    /**
     * Multi-indicator Digiflazz probe via shared executeRequest transport.
     * Classification uses official Digiflazz RC — never message substring matching.
     *
     * @return array<string, mixed>
     */
    public function healthProbe(): array
    {
        if (! $this->isConfigured()) {
            $result = DigiflazzHealthClassifier::classify([
                'http_status' => null,
                'body' => [],
                'latency_ms' => 0,
                'connection_error' => false,
                'error_message' => null,
            ], false);
            $this->logHealthProbeResult($result);

            return $result;
        }

        $payload = [
            'cmd' => 'deposit',
            'username' => $this->username,
            'sign' => md5($this->username.$this->apiKey.'depo'),
        ];

        $transport = $this->executeRequest('/cek-saldo', $payload, app()->environment('testing') ? 1 : 3);
        $result = DigiflazzHealthClassifier::classify($transport, true);
        $this->logHealthProbeResult($result);

        return $result;
    }

    /**
     * @param  array<string, mixed>  $result
     */
    protected function logHealthProbeResult(array $result): void
    {
        Log::info('Digiflazz healthProbe result', [
            'provider' => 'digiflazz',
            'endpoint' => '/cek-saldo',
            'http_status' => $result['http_status'] ?? null,
            'latency_ms' => $result['latency_ms'] ?? null,
            'provider_code' => $result['provider_code'] ?? null,
            'provider_message' => $result['provider_message'] ?? $result['message'] ?? null,
            'authentication' => $result['authentication'] ?? null,
            'connection' => $result['connection'] ?? null,
            'balance' => $result['balance'] ?? null,
            'status' => $result['status'] ?? null,
        ]);
    }

    /**
     * Shared Digiflazz HTTP transport (retry + logging). Never logs secrets.
     *
     * @return array{http_status:?int, body:array, latency_ms:int, connection_error:bool, error_message:?string}
     */
    protected function executeRequest(string $endpoint, array $payload, int $maxRetries = 3): array
    {
        $url = $this->baseUrl.$endpoint;
        $attempt = 0;
        $delay = 1000;
        if (app()->environment('testing')) {
            $maxRetries = min($maxRetries, 1);
        }

        $last = [
            'http_status' => null,
            'body' => [],
            'latency_ms' => 0,
            'connection_error' => false,
            'error_message' => null,
        ];

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
                $body = $response->json();
                if (! is_array($body)) {
                    $body = [];
                }

                Log::info("Digiflazz API Response Attempt {$attempt}", [
                    'status' => $response->status(),
                    'body' => $body,
                    'latency' => $latency,
                    'provider_reference' => $payload['ref_id'] ?? null,
                ]);

                $last = [
                    'http_status' => $response->status(),
                    'body' => $body,
                    'latency_ms' => (int) round($latency * 1000),
                    'connection_error' => false,
                    'error_message' => (string) ($body['data']['message'] ?? $body['message'] ?? null),
                ];

                if ($response->successful()) {
                    return $last;
                }

                if (($response->serverError() || $response->status() === 429) && $attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }

                return $last;
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                $latency = microtime(true) - $startTime;
                Log::error("Digiflazz API Connection Exception Attempt {$attempt}", [
                    'message' => $e->getMessage(),
                    'latency' => $latency,
                    'provider_reference' => $payload['ref_id'] ?? null,
                ]);

                $last = [
                    'http_status' => null,
                    'body' => [],
                    'latency_ms' => (int) round($latency * 1000),
                    'connection_error' => true,
                    'error_message' => $e->getMessage(),
                ];

                if ($attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }

                return $last;
            } catch (\Throwable $e) {
                $latency = microtime(true) - $startTime;
                Log::error("Digiflazz API Unexpected Exception Attempt {$attempt}", [
                    'message' => $e->getMessage(),
                    'latency' => $latency,
                    'provider_reference' => $payload['ref_id'] ?? null,
                ]);

                $last = [
                    'http_status' => $last['http_status'],
                    'body' => $last['body'],
                    'latency_ms' => (int) round($latency * 1000),
                    'connection_error' => false,
                    'error_message' => $e->getMessage(),
                ];

                if ($attempt < $maxRetries) {
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }

                return $last;
            }
        }
    }

    /**
     * Perform HTTP POST request to Digiflazz with exponential backoff retry and precise logging.
     * Throws when the final attempt is not successful (keeps Sync/Transaction fail-closed).
     */
    protected function postRequest(string $endpoint, array $payload, int $maxRetries = 3): array
    {
        $result = $this->executeRequest($endpoint, $payload, $maxRetries);

        if ($result['connection_error']) {
            throw new \Illuminate\Http\Client\ConnectionException(
                (string) ($result['error_message'] ?? 'Connection failed')
            );
        }

        $status = (int) ($result['http_status'] ?? 0);
        if ($status >= 200 && $status < 300) {
            return $result['body'];
        }

        throw new \Exception(
            'Digiflazz API error ('.$status.'): '.json_encode($result['body'], JSON_UNESCAPED_UNICODE)
        );
    }
}
