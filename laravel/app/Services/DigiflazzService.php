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
     * Uses the same transport as Sync / Inquiry / Transaction (executeRequest).
     * Balance failure alone must never imply authentication failure.
     *
     * @return array{
     *   configured:bool,
     *   connection:string,
     *   authentication:string,
     *   balance:string,
     *   balance_value:?float,
     *   latency_ms:?int,
     *   http_status:?int,
     *   message:?string,
     *   rc:?string
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
                'rc' => null,
            ];
        }

        $payload = [
            'cmd' => 'deposit',
            'username' => $this->username,
            'sign' => md5($this->username.$this->apiKey.'depo'),
        ];

        $transport = $this->executeRequest('/cek-saldo', $payload, app()->environment('testing') ? 1 : 3);

        $ms = (int) ($transport['latency_ms'] ?? 0);
        $status = $transport['http_status'];
        $body = is_array($transport['body'] ?? null) ? $transport['body'] : [];
        $message = (string) ($body['data']['message'] ?? $body['message'] ?? $transport['error_message'] ?? '');
        $rc = strtolower((string) ($body['data']['rc'] ?? $body['rc'] ?? ''));
        $deposit = $body['data']['deposit'] ?? null;

        if ($transport['connection_error']) {
            $isTimeout = str_contains(strtolower((string) $transport['error_message']), 'timeout')
                || str_contains(strtolower((string) $transport['error_message']), 'timed out')
                || str_contains(strtolower((string) $transport['error_message']), 'could not resolve');

            $result = [
                'configured' => true,
                'connection' => $isTimeout ? 'timeout' : 'failed',
                'authentication' => 'unknown',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => $ms,
                'http_status' => $status,
                'message' => $message !== '' ? $message : (string) ($transport['error_message'] ?? 'Connection failed'),
                'rc' => $rc !== '' ? $rc : null,
            ];
            $this->logHealthProbeResult($result);

            return $result;
        }

        if ($status !== null && in_array((int) $status, [401, 403], true)) {
            $result = [
                'configured' => true,
                'connection' => 'ok',
                'authentication' => 'failed',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => $ms,
                'http_status' => $status,
                'message' => $message !== '' ? $message : 'HTTP '.$status,
                'rc' => $rc !== '' ? $rc : null,
            ];
            $this->logHealthProbeResult($result);

            return $result;
        }

        if ($this->looksLikeDigiAuthFailure($message, $rc)) {
            $result = [
                'configured' => true,
                'connection' => 'ok',
                'authentication' => 'failed',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => $ms,
                'http_status' => $status,
                'message' => $message,
                'rc' => $rc !== '' ? $rc : null,
            ];
            $this->logHealthProbeResult($result);

            return $result;
        }

        if ($status !== null && (int) $status >= 500) {
            $result = [
                'configured' => true,
                'connection' => 'failed',
                'authentication' => 'unknown',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => $ms,
                'http_status' => $status,
                'message' => $message !== '' ? $message : 'HTTP '.$status,
                'rc' => $rc !== '' ? $rc : null,
            ];
            $this->logHealthProbeResult($result);

            return $result;
        }

        // Reachable + not a confirmed auth failure.
        $connection = ($ms > 3000) ? 'slow' : 'ok';

        if ($deposit !== null) {
            $result = [
                'configured' => true,
                'connection' => $connection,
                'authentication' => 'ok',
                'balance' => 'ok',
                'balance_value' => (float) $deposit,
                'latency_ms' => $ms,
                'http_status' => $status,
                'message' => $message !== '' ? $message : 'OK',
                'rc' => $rc !== '' ? $rc : null,
            ];
            $this->logHealthProbeResult($result);

            return $result;
        }

        // Auth OK (or unknown but not failed) — balance unreadable → Partial upstream.
        $result = [
            'configured' => true,
            'connection' => $connection,
            'authentication' => 'ok',
            'balance' => 'failed',
            'balance_value' => null,
            'latency_ms' => $ms,
            'http_status' => $status,
            'message' => $message !== '' ? $message : 'Balance unavailable',
            'rc' => $rc !== '' ? $rc : null,
        ];
        $this->logHealthProbeResult($result);

        return $result;
    }

    /**
     * Strict credential-failure detection only. Avoids false positives from
     * generic substrings like "sign", "invalid", or "username".
     */
    protected function looksLikeDigiAuthFailure(string $message, string $rc): bool
    {
        $m = strtolower(trim($message));
        if ($m === '') {
            return false;
        }

        $phrases = [
            'wrong signature',
            'invalid signature',
            'signature salah',
            'signature tidak valid',
            'unauthorized',
            'unauthorised',
            'invalid api key',
            'api key salah',
            'api key tidak valid',
            'invalid username',
            'username salah',
            'username tidak valid',
            'credential invalid',
            'credentials invalid',
            'credential salah',
            'authentication failed',
            'autentikasi gagal',
        ];

        foreach ($phrases as $phrase) {
            if (str_contains($m, $phrase)) {
                return true;
            }
        }

        return false;
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
            'rc' => $result['rc'] ?? null,
            'message' => $result['message'] ?? null,
            'balance_available' => ($result['balance'] ?? null) === 'ok',
            'authentication' => $result['authentication'] ?? null,
            'connection' => $result['connection'] ?? null,
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
