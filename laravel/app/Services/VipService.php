<?php

namespace App\Services;

use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * VIP Reseller / VIPAYMENT HTTP client.
 * Auth: key = VIP_API_KEY, sign = md5(VIP_USERNAME + VIP_API_KEY).
 * Docs pattern: https://vip-reseller.co.id/api/{profile|prepaid|game-feature}
 */
class VipService
{
    protected string $baseUrl;
    protected string $apiId;
    protected string $apiKey;
    protected string $signature;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) (config('services.vip.base_url') ?: ''), '/');
        $this->apiId = (string) (config('services.vip.username') ?: config('services.vip.merchant_id') ?: '');
        $this->apiKey = (string) (config('services.vip.api_key') ?: '');
        $configuredSign = (string) (config('services.vip.signature') ?: '');
        $this->signature = $configuredSign !== ''
            ? $configuredSign
            : ($this->apiId !== '' && $this->apiKey !== '' ? md5($this->apiId . $this->apiKey) : '');
    }

    /**
     * @return array{ok:bool,missing:string[],message:?string}
     */
    public function credentialStatus(): array
    {
        $missing = [];
        if ($this->baseUrl === '') {
            $missing[] = 'VIP_BASE_URL';
        }
        if ($this->apiId === '') {
            $missing[] = 'VIP_USERNAME (or VIP_MERCHANT_ID)';
        }
        if ($this->apiKey === '' || in_array($this->apiKey, ['dummy', 'dummy_api_key'], true)) {
            $missing[] = 'VIP_API_KEY';
        }

        if ($missing !== []) {
            return [
                'ok' => false,
                'missing' => $missing,
                'message' => ProductProvider::vipDisplayName()
                    . ' credentials incomplete. Missing: ' . implode(', ', $missing)
                    . '. Set them in laravel/.env and run php artisan config:clear.',
            ];
        }

        return ['ok' => true, 'missing' => [], 'message' => null];
    }

    public function isConfigured(): bool
    {
        return $this->credentialStatus()['ok'] === true;
    }

    public function assertConfigured(): void
    {
        $status = $this->credentialStatus();
        if (!$status['ok']) {
            throw new RuntimeException($status['message'] ?? 'VIP credentials missing');
        }
    }

    /**
     * Profile / saldo — used for Health Check.
     *
     * @return array{success:bool,api_status:string,health_color:string,http_status:?int,latency_ms:int,balance:?float,message:string,raw:array}
     */
    public function profile(): array
    {
        Log::info('EXEC TRACE — ENTER VipService profile');

        $cred = $this->credentialStatus();
        if (!$cred['ok']) {
            Log::warning('VIP RUNTIME AUDIT — REQUEST NEVER LEFT LARAVEL (Health Check)', [
                'reason' => 'VipService::profile() credentialStatus() failed before Http::post',
                'missing' => $cred['missing'],
                'message' => $cred['message'],
                'intended_method' => 'POST',
                'intended_url' => rtrim($this->baseUrl !== '' ? $this->baseUrl : (string) config('services.vip.base_url', 'https://vip-reseller.co.id/api'), '/') . '/profile',
                'REQUEST_URL' => null,
                'REQUEST_BODY' => null,
                'REQUEST_HEADERS' => null,
                'RESPONSE_STATUS' => null,
                'RESPONSE_BODY' => null,
            ]);

            return [
                'success' => false,
                'api_status' => 'not_configured',
                'health_color' => 'red',
                'http_status' => null,
                'latency_ms' => 0,
                'balance' => null,
                'message' => $cred['message'] ?? 'Credentials missing',
                'raw' => ['missing' => $cred['missing']],
            ];
        }

        return $this->request('profile', [
            'key' => $this->apiKey,
            'sign' => $this->signature,
        ], 'health_check');
    }

    /**
     * Prepaid service catalog (type=services).
     *
     * @return array{success:bool,api_status:string,http_status:?int,latency_ms:int,message:string,data:array,raw:array}
     */
    public function prepaidServices(?string $filterType = null, ?string $filterValue = null): array
    {
        $this->assertConfigured();

        $params = [
            'key' => $this->apiKey,
            'sign' => $this->signature,
            'type' => 'services',
        ];
        if ($filterType) {
            $params['filter_type'] = $filterType;
        }
        if ($filterValue) {
            $params['filter_value'] = $filterValue;
        }

        $result = $this->request('prepaid', $params, 'sync');
        $rows = $result['raw']['data'] ?? [];
        if (!is_array($rows)) {
            $rows = [];
        }

        return array_merge($result, [
            'data' => array_values(array_filter($rows, 'is_array')),
        ]);
    }

    /**
     * Game-feature service catalog (optional second catalog source).
     *
     * @return array{success:bool,api_status:string,http_status:?int,latency_ms:int,message:string,data:array,raw:array}
     */
    public function gameServices(): array
    {
        $this->assertConfigured();

        $result = $this->request('game-feature', [
            'key' => $this->apiKey,
            'sign' => $this->signature,
            'type' => 'services',
        ], 'sync');

        $rows = $result['raw']['data'] ?? [];
        if (!is_array($rows)) {
            $rows = [];
        }

        return array_merge($result, [
            'data' => array_values(array_filter($rows, 'is_array')),
        ]);
    }

    /**
     * Place prepaid order (fulfillment path — not used by this task's UI changes).
     */
    public function orderPrepaid(string $serviceCode, string $customerNo, ?string $refId = null): array
    {
        $this->assertConfigured();

        $params = [
            'key' => $this->apiKey,
            'sign' => $this->signature,
            'type' => 'order',
            'service' => $serviceCode,
            'data_no' => $customerNo,
        ];
        if ($refId) {
            $params['reff_id'] = $refId;
        }

        return $this->request('prepaid', $params, 'fulfill');
    }

    /**
     * @return array{success:bool,api_status:string,health_color:string,http_status:?int,latency_ms:int,balance:?float,message:string,raw:array}
     */
    protected function request(string $path, array $params, string $logEvent): array
    {
        Log::info('EXEC TRACE — VipService::request() HTTP request starting', [
            'path' => $path,
            'event' => $logEvent,
        ]);

        $url = $this->baseUrl . '/' . ltrim($path, '/');
        $started = microtime(true);
        $provider = ProductProvider::vip();
        $headers = [
            'Content-Type' => 'application/x-www-form-urlencoded',
            'Accept' => 'application/json',
        ];

        $signSource = ((string) (config('services.vip.signature') ?: '') !== '')
            ? 'VIP_SIGNATURE (precomputed)'
            : 'md5(apiId + apiKey)';

        $requestBodyForLog = array_merge($params, [
            'key' => $this->mask((string) ($params['key'] ?? '')),
            'sign' => $this->mask((string) ($params['sign'] ?? '')),
            'sign_calculation' => $signSource,
        ]);

        $this->writeLog($provider?->id, 'api_request', [
            'url' => $url,
            'path' => $path,
            'payload' => $requestBodyForLog,
            'event' => $logEvent,
        ]);

        Log::info('VIP RUNTIME AUDIT REQUEST', [
            'event' => $logEvent,
            'REQUEST_URL' => $url,
            'REQUEST_HEADERS' => $headers,
            'REQUEST_BODY' => $requestBodyForLog,
            'http_method' => 'POST',
        ]);
        Log::info('VIP REQUEST URL', ['REQUEST_URL' => $url]);
        Log::info('VIP REQUEST BODY', ['REQUEST_BODY' => $requestBodyForLog]);
        Log::info('VIP REQUEST HEADERS', ['REQUEST_HEADERS' => $headers]);

        try {
            $timeout = app()->environment('testing') ? 5 : 30;
            /** @var Response $response */
            $response = Http::asForm()
                ->withHeaders(['Accept' => 'application/json'])
                ->timeout($timeout)
                ->connectTimeout(app()->environment('testing') ? 2 : 10)
                ->post($url, $params);

            $ms = (int) ((microtime(true) - $started) * 1000);
            $rawBodyString = $response->body();
            $body = $response->json();
            if (!is_array($body)) {
                $body = ['raw_body' => $rawBodyString];
            }

            $this->writeLog($provider?->id, 'api_response', [
                'url' => $url,
                'http_status' => $response->status(),
                'latency_ms' => $ms,
                'body' => $this->truncateBody($body),
                'event' => $logEvent,
            ], $ms, $response->successful());

            Log::info('VIP RUNTIME AUDIT RESPONSE', [
                'event' => $logEvent,
                'RESPONSE_STATUS' => $response->status(),
                'RESPONSE_BODY' => $rawBodyString,
                'latency_ms' => $ms,
                'REQUEST_URL' => $url,
            ]);
            Log::info('VIP RESPONSE STATUS', ['RESPONSE_STATUS' => $response->status()]);
            Log::info('VIP RESPONSE BODY', ['RESPONSE_BODY' => $rawBodyString]);

            if (in_array($response->status(), [401, 403], true)) {
                Log::error('VIP Authentication Error', [
                    'RESPONSE_STATUS' => $response->status(),
                    'RESPONSE_BODY' => $rawBodyString,
                    'REQUEST_URL' => $url,
                ]);
                $this->writeLog($provider?->id, 'authentication_failure', [
                    'http_status' => $response->status(),
                    'message' => $body['message'] ?? 'Unauthorized',
                ], $ms, false);

                return $this->failResult('auth_failed', 'red', $response->status(), $ms, $body['message'] ?? 'Authentication failed', $body);
            }

            if ($response->serverError()) {
                Log::error('VIP HTTP 5xx', [
                    'RESPONSE_STATUS' => $response->status(),
                    'RESPONSE_BODY' => $rawBodyString,
                    'REQUEST_URL' => $url,
                ]);

                return $this->failResult('offline', 'red', $response->status(), $ms, 'HTTP ' . $response->status(), $body);
            }

            // VIP uses result:true/false in JSON body even with HTTP 200
            $resultFlag = $body['result'] ?? $body['status'] ?? null;
            $message = (string) ($body['message'] ?? '');
            $authLike = $this->looksLikeAuthFailure($message, $resultFlag);

            if ($authLike) {
                Log::error('VIP Authentication Error', [
                    'RESPONSE_STATUS' => $response->status(),
                    'RESPONSE_BODY' => $rawBodyString,
                    'message' => $message,
                    'REQUEST_URL' => $url,
                ]);
                $this->writeLog($provider?->id, 'authentication_failure', [
                    'http_status' => $response->status(),
                    'message' => $message,
                ], $ms, false);

                return $this->failResult('auth_failed', 'red', $response->status(), $ms, $message ?: 'Authentication failed', $body);
            }

            if ($resultFlag === false || $resultFlag === 0 || $resultFlag === 'false') {
                Log::error('VIP API logical failure', [
                    'RESPONSE_STATUS' => $response->status(),
                    'RESPONSE_BODY' => $rawBodyString,
                    'body.result_or_status' => $resultFlag,
                    'REQUEST_URL' => $url,
                ]);

                return $this->failResult('offline', 'yellow', $response->status(), $ms, $message ?: 'VIP API returned failure', $body);
            }

            if (!$response->successful() && $resultFlag === null) {
                Log::error('VIP non-2xx without result flag', [
                    'RESPONSE_STATUS' => $response->status(),
                    'RESPONSE_BODY' => $rawBodyString,
                    'REQUEST_URL' => $url,
                ]);

                return $this->failResult('offline', 'yellow', $response->status(), $ms, $message ?: ('HTTP ' . $response->status()), $body);
            }

            $balance = $this->extractBalance($body);

            return [
                'success' => true,
                'api_status' => 'online',
                'health_color' => 'green',
                'http_status' => $response->status(),
                'latency_ms' => $ms,
                'balance' => $balance,
                'message' => $message !== '' ? $message : 'OK',
                'raw' => $body,
            ];
        } catch (ConnectionException $e) {
            $ms = (int) ((microtime(true) - $started) * 1000);
            $msg = $e->getMessage();
            $isSsl = str_contains(strtolower($msg), 'ssl') || str_contains(strtolower($msg), 'certificate');

            Log::error($isSsl ? 'VIP SSL Error' : 'VIP Timeout', [
                'Exception' => $msg,
                'Timeout' => !$isSsl,
                'SSL_Error' => $isSsl,
                'REQUEST_URL' => $url,
                'class' => $e::class,
            ]);

            $this->writeLog($provider?->id, 'api_response', [
                'url' => $url,
                'error' => $msg,
                'event' => $logEvent,
            ], $ms, false);

            return $this->failResult('timeout', 'yellow', null, $ms, 'Timeout / connection error: ' . $msg, []);
        } catch (\Throwable $e) {
            $ms = (int) ((microtime(true) - $started) * 1000);
            Log::error('VIP Exception', [
                'Exception' => $e->getMessage(),
                'REQUEST_URL' => $url,
                'class' => $e::class,
            ]);

            return $this->failResult('offline', 'red', null, $ms, $e->getMessage(), []);
        }
    }

    protected function failResult(string $apiStatus, string $color, ?int $http, int $ms, string $message, array $raw): array
    {
        return [
            'success' => false,
            'api_status' => $apiStatus,
            'health_color' => $color,
            'http_status' => $http,
            'latency_ms' => $ms,
            'balance' => null,
            'message' => $message,
            'raw' => $raw,
        ];
    }

    protected function looksLikeAuthFailure(string $message, mixed $resultFlag): bool
    {
        $m = strtolower($message);
        foreach (['api key', 'apikey', 'signature', 'sign', 'unauthorized', 'unauthorised', 'invalid key', 'wrong key', 'authentication', 'login'] as $needle) {
            if (str_contains($m, $needle)) {
                return true;
            }
        }

        return false;
    }

    protected function extractBalance(array $body): ?float
    {
        $data = $body['data'] ?? null;
        if (!is_array($data)) {
            return null;
        }

        foreach (['balance', 'saldo', 'deposit'] as $key) {
            if (isset($data[$key]) && is_numeric($data[$key])) {
                return (float) $data[$key];
            }
        }

        return null;
    }

    protected function mask(string $value): string
    {
        if ($value === '') {
            return '';
        }
        if (strlen($value) <= 4) {
            return '****';
        }

        return substr($value, 0, 2) . str_repeat('*', max(4, strlen($value) - 4)) . substr($value, -2);
    }

    protected function truncateBody(array $body): array
    {
        $copy = $body;
        if (isset($copy['data']) && is_array($copy['data']) && count($copy['data']) > 5) {
            $copy['data'] = array_slice($copy['data'], 0, 5);
            $copy['_data_truncated'] = true;
        }

        return $copy;
    }

    protected function writeLog(?int $providerId, string $event, array $meta, ?int $ms = null, ?bool $success = null): void
    {
        try {
            ProductProviderLog::create([
                'product_provider_id' => $providerId,
                'event_type' => $event,
                'selected_provider_code' => ProductProvider::CODE_VIP,
                'success' => $success,
                'response_time_ms' => $ms,
                'reason' => $event,
                'error_message' => ($success === false) ? ($meta['message'] ?? $meta['error'] ?? null) : null,
                'meta' => $meta,
            ]);
        } catch (\Throwable $e) {
            Log::debug('VIP log write skipped', ['error' => $e->getMessage()]);
        }
    }
}
