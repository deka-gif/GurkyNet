<?php

namespace App\Services;

use App\Services\ProductProviders\DigiflazzHealthClassifier;
use App\Services\ProductProviders\DigiflazzResponseCodeClassifier;
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
     * Optional testing — same config/env as Topup (`DIGIFLAZZ_TESTING`); omitted when unset.
     *
     * @param  array{testing?: bool|string|null}  $options
     */
    public function inquiryPasca(
        string $sku,
        string $customerNo,
        string $refId,
        ?int $year = null,
        ?int $amount = null,
        array $options = []
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

        $payload = array_merge($payload, $this->resolveOptionalInquiryFields($options));

        return $this->postRequest('/transaction', $payload);
    }

    /**
     * Optional Digiflazz `testing` flag for inq-pasca / pay-pasca — omitted when unset.
     * Reuses the same Digiflazz `testing` config/env as Topup (`DIGIFLAZZ_TESTING`).
     *
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function resolveOptionalInquiryFields(array $options = []): array
    {
        $merged = array_merge([
            'testing' => config('services.digiflazz.testing'),
        ], $options);

        $optional = [];

        if ($this->isPresentOptionalFlag($merged['testing'] ?? null)) {
            $optional['testing'] = true;
        }

        return $optional;
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
     * Optional testing — same config/env as Topup & Inquiry (`DIGIFLAZZ_TESTING`); omitted when unset.
     *
     * @param  array{testing?: bool|string|null}  $options
     */
    public function payPasca(
        string $sku,
        string $customerNo,
        string $refId,
        array $options = []
    ): array {
        $this->assertConfigured();

        $payload = [
            'commands' => 'pay-pasca',
            'username' => $this->username,
            'buyer_sku_code' => $sku,
            'customer_no' => $customerNo,
            'ref_id' => $refId,
            'sign' => $this->sign($refId),
        ];

        $payload = array_merge($payload, $this->resolveOptionalInquiryFields($options));

        return $this->postRequest('/transaction', $payload);
    }

    /**
     * Buy prepaid product (Digiflazz Topup).
     *
     * Required payload: username, buyer_sku_code, customer_no, ref_id, sign.
     * Optional Digiflazz fields (testing, max_price, cb_url, allow_dot) are merged from
     * config/services.php + $options and only included when a value is present.
     *
     * @param  array{
     *   testing?: bool|null,
     *   max_price?: int|string|null,
     *   cb_url?: string|null,
     *   allow_dot?: bool|null
     * }  $options
     */
    public function buy(string $sku, string $customerNo, string $refId, array $options = []): array
    {
        $this->assertConfigured();

        $payload = [
            'username' => $this->username,
            'buyer_sku_code' => $sku,
            'customer_no' => $customerNo,
            'ref_id' => $refId,
            'sign' => $this->sign($refId),
        ];

        $payload = array_merge($payload, $this->resolveOptionalTopupFields($options));

        return $this->postRequest('/transaction', $payload);
    }

    /**
     * Prepaid status check (Digiflazz Cek Status / Topup docs).
     *
     * Official prepaid flow: re-send the Topup request with the **same ref_id**.
     * This does not create a new GurkyNet invoice/transaction — Digiflazz keys on ref_id.
     * `cmd=status` is not used (not documented in Cek Status.pdf).
     *
     * Terminology (do not confuse):
     * - Retry HTTP: transport-level retries inside executeRequest/postRequest (same payload).
     * - Retry Status / Check Status Prepaid: this method — re-Topup with same ref_id.
     * - Retry Topup (fulfill): first purchase attempt via buy() when creating the order.
     * - Check Status Pasca: checkStatusPasca() with commands=status-pasca (postpaid only).
     */
    public function checkStatus(string $sku, string $customerNo, string $refId): array
    {
        return $this->buy($sku, $customerNo, $refId);
    }

    /**
     * Optional Topup request fields — omitted when unset so legacy payloads stay identical.
     *
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function resolveOptionalTopupFields(array $options = []): array
    {
        $merged = array_merge([
            'testing' => config('services.digiflazz.testing'),
            'max_price' => config('services.digiflazz.max_price'),
            'cb_url' => config('services.digiflazz.cb_url'),
            'allow_dot' => config('services.digiflazz.allow_dot'),
        ], $options);

        $optional = [];

        if ($this->isPresentOptionalFlag($merged['testing'] ?? null)) {
            $optional['testing'] = true;
        }

        if ($this->isPresentOptionalValue($merged['max_price'] ?? null)) {
            $optional['max_price'] = (int) $merged['max_price'];
        }

        if ($this->isPresentOptionalValue($merged['cb_url'] ?? null)) {
            $optional['cb_url'] = (string) $merged['cb_url'];
        }

        if ($this->isPresentOptionalFlag($merged['allow_dot'] ?? null)) {
            $optional['allow_dot'] = true;
        }

        return $optional;
    }

    /**
     * Extract Digiflazz Topup `data` fields for persistence. Missing keys stay null
     * so callers remain compatible with older/partial responses.
     *
     * @param  array<string, mixed>  $response  Full Digiflazz JSON or already-unwrapped `data`
     * @return array{
     *   rc: ?string,
     *   price: ?int,
     *   buyer_last_saldo: ?float,
     *   tele: ?string,
     *   wa: ?string,
     *   sn: ?string,
     *   message: ?string,
     *   status: ?string
     * }
     */
    public static function extractTopupResponseFields(array $response): array
    {
        $data = $response;
        if (isset($response['data']) && is_array($response['data'])) {
            $data = $response['data'];
        }

        return [
            'rc' => array_key_exists('rc', $data) && $data['rc'] !== null && $data['rc'] !== ''
                ? (string) $data['rc']
                : null,
            'price' => array_key_exists('price', $data) && $data['price'] !== null && $data['price'] !== ''
                ? (int) $data['price']
                : null,
            'buyer_last_saldo' => array_key_exists('buyer_last_saldo', $data) && $data['buyer_last_saldo'] !== null && $data['buyer_last_saldo'] !== ''
                ? (float) $data['buyer_last_saldo']
                : null,
            'tele' => array_key_exists('tele', $data) && $data['tele'] !== null && $data['tele'] !== ''
                ? (string) $data['tele']
                : null,
            'wa' => array_key_exists('wa', $data) && $data['wa'] !== null && $data['wa'] !== ''
                ? (string) $data['wa']
                : null,
            'sn' => array_key_exists('sn', $data) && $data['sn'] !== null && $data['sn'] !== ''
                ? (string) $data['sn']
                : null,
            'message' => array_key_exists('message', $data) && $data['message'] !== null
                ? (string) $data['message']
                : null,
            'status' => array_key_exists('status', $data) && $data['status'] !== null
                ? (string) $data['status']
                : null,
        ];
    }

    /**
     * Attributes to update on digiflazz_transactions from a Digiflazz Topup/status response.
     *
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    public static function digiflazzTransactionAttributesFromResponse(
        string $digiflazzStatus,
        array $raw,
        ?string $sn = null
    ): array {
        $fields = self::extractTopupResponseFields($raw);

        $attributes = [
            'digiflazz_status' => $digiflazzStatus,
            'raw_response' => $raw,
        ];

        $resolvedSn = $sn ?? $fields['sn'];
        if ($resolvedSn !== null) {
            $attributes['sn'] = $resolvedSn;
        }

        foreach (['rc', 'price', 'buyer_last_saldo', 'tele', 'wa', 'message'] as $key) {
            if ($fields[$key] !== null) {
                $attributes[$key] = $fields[$key];
            }
        }

        return $attributes;
    }

    protected function isPresentOptionalValue(mixed $value): bool
    {
        return $value !== null && $value !== '';
    }

    protected function isPresentOptionalFlag(mixed $value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }

        if (is_bool($value)) {
            return $value;
        }

        $normalized = strtolower(trim((string) $value));

        return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
    }

    /**
     * Postpaid status check (Digiflazz Cek Status).
     *
     * Uses commands=status-pasca with the same ref_id as the original pay-pasca / inquiry.
     * Distinct from prepaid re-Topup status checks.
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
        $context = [
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
        ];

        $rc = DigiflazzResponseCodeClassifier::normalize($result['provider_code'] ?? null);
        if ($rc !== null) {
            $context = array_merge($context, DigiflazzResponseCodeClassifier::classify($rc)->toOfficialMetadata());
        }

        Log::info('Digiflazz healthProbe result', $context);
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

                $timeout = app()->environment('testing') ? 5 : 90;
                $connectTimeout = app()->environment('testing') ? 2 : 15;

                $response = Http::timeout($timeout)
                    ->connectTimeout($connectTimeout)
                    ->withHeaders(['Content-Type' => 'application/json'])
                    ->post($url, $payload);

                $latency = microtime(true) - $startTime;
                $body = $response->json();
                if (! is_array($body)) {
                    $body = [];
                }

                // Never dump full pricelist into logs (huge + noisy). Summarize for catalog endpoints.
                $logBody = $body;
                if ($endpoint === '/price-list' && isset($body['data']) && is_array($body['data']) && array_is_list($body['data'])) {
                    $logBody = [
                        'data_count' => count($body['data']),
                        'data_sample_skus' => array_values(array_filter(array_map(
                            static fn ($row) => is_array($row) ? ($row['buyer_sku_code'] ?? null) : null,
                            array_slice($body['data'], 0, 5)
                        ))),
                    ];
                }

                Log::info("Digiflazz API Response Attempt {$attempt}", array_merge([
                    'status' => $response->status(),
                    'body' => $logBody,
                    'latency' => $latency,
                    'provider_reference' => $payload['ref_id'] ?? null,
                    'endpoint' => $endpoint,
                ], $this->rcLogContextFromBody($body)));

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

    /**
     * Attach official Digiflazz RC metadata when response `data.rc` is present.
     * Safe for price-list success payloads (product lists have no `rc` key).
     *
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    protected function rcLogContextFromBody(array $body): array
    {
        $data = $body['data'] ?? null;
        if (! is_array($data) || ! array_key_exists('rc', $data)) {
            return [];
        }

        return [
            'digiflazz_rc' => DigiflazzResponseCodeClassifier::fromResponseData($data)->toOfficialMetadata(),
        ];
    }
}
