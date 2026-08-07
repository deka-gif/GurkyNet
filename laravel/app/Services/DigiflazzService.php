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
     * Multi-indicator Digiflazz probe (connection / auth / balance).
     * Balance failure alone must not imply connection/auth failure.
     *
     * @return array{
     *   configured:bool,
     *   connection:string,
     *   authentication:string,
     *   balance:string,
     *   balance_value:?float,
     *   latency_ms:?int,
     *   http_status:?int,
     *   message:?string
     * }
     */
    public function healthProbe(): array
    {
        if (! $this->isConfigured()) {
            return [
                'configured' => false,
                'connection' => 'failed',
                'authentication' => 'failed',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => null,
                'http_status' => null,
                'message' => 'Credentials not configured',
            ];
        }

        $payload = [
            'cmd' => 'deposit',
            'username' => $this->username,
            'sign' => md5($this->username.$this->apiKey.'depo'),
        ];

        $url = $this->baseUrl.'/cek-saldo';
        $started = microtime(true);
        $timeout = app()->environment('testing') ? 5 : 30;
        $connectTimeout = app()->environment('testing') ? 2 : 10;

        try {
            $response = Http::timeout($timeout)
                ->connectTimeout($connectTimeout)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($url, $payload);

            $ms = (int) ((microtime(true) - $started) * 1000);
            $status = $response->status();
            $body = $response->json();
            if (! is_array($body)) {
                $body = [];
            }
            $message = (string) ($body['data']['message'] ?? $body['message'] ?? '');
            $rc = strtolower((string) ($body['data']['rc'] ?? $body['rc'] ?? ''));
            $deposit = $body['data']['deposit'] ?? null;

            if (in_array($status, [401, 403], true)) {
                return [
                    'configured' => true,
                    'connection' => 'ok',
                    'authentication' => 'failed',
                    'balance' => 'failed',
                    'balance_value' => null,
                    'latency_ms' => $ms,
                    'http_status' => $status,
                    'message' => $message !== '' ? $message : 'Authentication failed',
                ];
            }

            $authFail = $this->looksLikeDigiAuthFailure($message, $rc);
            if ($authFail) {
                return [
                    'configured' => true,
                    'connection' => 'ok',
                    'authentication' => 'failed',
                    'balance' => 'failed',
                    'balance_value' => null,
                    'latency_ms' => $ms,
                    'http_status' => $status,
                    'message' => $message !== '' ? $message : 'Authentication failed',
                ];
            }

            if ($response->serverError()) {
                return [
                    'configured' => true,
                    'connection' => 'failed',
                    'authentication' => 'unknown',
                    'balance' => 'failed',
                    'balance_value' => null,
                    'latency_ms' => $ms,
                    'http_status' => $status,
                    'message' => 'HTTP '.$status,
                ];
            }

            // Connected & authenticated enough to get a structured response.
            if ($deposit !== null) {
                return [
                    'configured' => true,
                    'connection' => $ms > 3000 ? 'slow' : 'ok',
                    'authentication' => 'ok',
                    'balance' => 'ok',
                    'balance_value' => (float) $deposit,
                    'latency_ms' => $ms,
                    'http_status' => $status,
                    'message' => 'OK',
                ];
            }

            // Reachable + not auth error, but saldo missing → Partial (not Offline).
            return [
                'configured' => true,
                'connection' => $ms > 3000 ? 'slow' : 'ok',
                'authentication' => 'ok',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => $ms,
                'http_status' => $status,
                'message' => $message !== '' ? $message : 'Gagal mengambil informasi saldo provider',
            ];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return [
                'configured' => true,
                'connection' => 'timeout',
                'authentication' => 'unknown',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => (int) ((microtime(true) - $started) * 1000),
                'http_status' => null,
                'message' => $e->getMessage(),
            ];
        } catch (\Throwable $e) {
            $msg = strtolower($e->getMessage());
            $isTimeout = str_contains($msg, 'timeout') || str_contains($msg, 'timed out') || str_contains($msg, 'could not resolve');

            return [
                'configured' => true,
                'connection' => $isTimeout ? 'timeout' : 'failed',
                'authentication' => 'unknown',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => (int) ((microtime(true) - $started) * 1000),
                'http_status' => null,
                'message' => $e->getMessage(),
            ];
        }
    }

    protected function looksLikeDigiAuthFailure(string $message, string $rc): bool
    {
        $m = strtolower($message);
        if (in_array($rc, ['01', '02', '03'], true)) {
            // Digiflazz often uses these for invalid IP / wrong credentials — keep soft.
        }

        return str_contains($m, 'invalid')
            || str_contains($m, 'unauthor')
            || str_contains($m, 'signature')
            || str_contains($m, 'sign')
            || str_contains($m, 'api key')
            || str_contains($m, 'username')
            || str_contains($m, 'credential');
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
