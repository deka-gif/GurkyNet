<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\ProductProviderSku;
use Illuminate\Support\Facades\Log;

class ProductProviderHealthService
{
    public function __construct(protected ProductProviderRegistry $registry) {}

    /**
     * Run multi-indicator health check and persist metrics.
     * Balance failure alone never forces Offline.
     */
    public function check(ProductProvider $provider): ProductProvider
    {
        $provider->refresh();

        $oldApiStatus = $provider->api_status;
        $oldHealthColor = $provider->health_color;
        $oldLastError = $provider->last_error;

        Log::info('HEALTH CHECK — before update', [
            'Provider ID' => $provider->id,
            'Provider Code' => $provider->code,
            'Old api_status' => $oldApiStatus,
            'Old health_color' => $oldHealthColor,
            'is_active' => $provider->is_active,
            'partner_status' => $provider->partner_status,
        ]);

        $this->refreshStats($provider);
        $provider->refresh();

        if (! $this->registry->has($provider->code)) {
            $evaluated = ProviderHealthStatus::evaluate([
                'configured' => false,
                'connection' => 'failed',
                'authentication' => 'failed',
                'balance' => 'failed',
                'sync' => 'unknown',
                'partner_status' => $provider->partner_status,
            ]);

            return $this->persistEvaluation($provider, $evaluated, null, [
                'reason' => 'no_adapter',
            ], $oldApiStatus, $oldHealthColor, $oldLastError);
        }

        $adapter = $this->registry->get($provider->code);
        $result = $adapter->healthCheck();

        $indicators = $this->buildIndicators($provider, $result);
        $evaluated = ProviderHealthStatus::evaluate($indicators);

        $latency = $result['latency_ms'] ?? null;
        $balanceValue = $result['balance_value']
            ?? $result['balance_amount']
            ?? (is_numeric($result['balance'] ?? null) ? $result['balance'] : null);

        Log::info('HEALTH CHECK — probe classified', [
            'provider' => $provider->code,
            'http_status' => $result['http_status'] ?? null,
            'latency_ms' => $latency,
            'provider_code' => $result['provider_code'] ?? $indicators['provider_code'] ?? null,
            'provider_message' => $indicators['message'] ?? null,
            'connection' => $indicators['connection'] ?? null,
            'authentication' => $indicators['authentication'] ?? null,
            'balance' => $indicators['balance'] ?? null,
            'service' => $indicators['service'] ?? null,
            'sync' => $indicators['sync'] ?? null,
            'status_internal' => $evaluated['api_status'],
        ]);

        $providerProfile = is_array($result['provider_profile'] ?? null)
            ? $result['provider_profile']
            : null;

        return $this->persistEvaluation(
            $provider,
            $evaluated,
            $latency,
            [
                'balance' => $balanceValue,
                'http_status' => $result['http_status'] ?? null,
                'probe_message' => $result['provider_message'] ?? $result['message'] ?? null,
                'provider_code' => $result['provider_code'] ?? null,
                'provider_message' => $result['provider_message'] ?? $result['message'] ?? null,
                'latency_ms' => $latency,
                'indicators' => $evaluated['indicators'],
                'indicator_labels' => $evaluated['indicator_labels'] ?? [],
                'provider_profile' => $providerProfile,
            ],
            $oldApiStatus,
            $oldHealthColor,
            $oldLastError,
            $balanceValue,
            $providerProfile
        );
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    protected function buildIndicators(ProductProvider $provider, array $result): array
    {
        $fromAdapter = is_array($result['indicators'] ?? null) ? $result['indicators'] : [];

        $connection = strtolower((string) ($fromAdapter['connection'] ?? $result['connection'] ?? ''));
        $authentication = strtolower((string) ($fromAdapter['authentication'] ?? $result['authentication'] ?? ''));
        $balance = strtolower((string) ($fromAdapter['balance'] ?? ''));
        $service = strtolower((string) ($fromAdapter['service'] ?? $result['service'] ?? ''));
        $status = strtolower((string) ($fromAdapter['status'] ?? $result['status'] ?? ''));

        // Flat contract: balance may be indicator string.
        if ($balance === '' && isset($result['balance']) && in_array((string) $result['balance'], ['ok', 'failed', 'unknown'], true)) {
            $balance = (string) $result['balance'];
        }

        if ($connection === '' || $authentication === '') {
            // Legacy adapter payloads without indicators.
            if (($result['configured'] ?? true) === false || ($result['api_status'] ?? null) === 'not_configured') {
                $connection = 'failed';
                $authentication = 'failed';
                $balance = 'failed';
                $status = $status !== '' ? $status : ProviderHealthStatus::NOT_CONFIGURED;
            } elseif (($result['api_status'] ?? null) === 'auth_failed') {
                $connection = 'ok';
                $authentication = 'failed';
                $balance = 'unknown';
                $status = $status !== '' ? $status : ProviderHealthStatus::AUTH_FAILED;
            } elseif (in_array(($result['api_status'] ?? null), ['timeout', 'offline'], true)) {
                $connection = ($result['api_status'] === 'timeout') ? 'timeout' : 'failed';
                $authentication = 'unknown';
                $balance = 'unknown';
                $status = $status !== '' ? $status : ProviderHealthStatus::OFFLINE;
            } else {
                $reachable = (bool) ($result['reachable'] ?? false);
                $auth = (bool) ($result['authenticated'] ?? false);
                $connection = $reachable ? ((($result['latency_ms'] ?? 0) > 3000) ? 'slow' : 'ok') : 'failed';
                $authentication = $auth ? 'ok' : ($reachable ? 'failed' : 'unknown');
                $hasAmount = ($result['balance_value'] ?? $result['balance_amount'] ?? null) !== null
                    || (isset($result['balance']) && is_numeric($result['balance']));
                $balance = $hasAmount ? 'ok' : 'failed';
            }
        }

        $configured = (bool) ($result['configured'] ?? ($connection !== 'failed' || $authentication === 'ok'));
        if (($result['api_status'] ?? null) === 'not_configured') {
            $configured = false;
        }

        $balanceValue = $result['balance_value']
            ?? $result['balance_amount']
            ?? (is_numeric($result['balance'] ?? null) ? $result['balance'] : null);

        return [
            'configured' => $configured,
            'connection' => $connection ?: 'unknown',
            'authentication' => $authentication ?: 'unknown',
            'balance' => $balance ?: 'unknown',
            'service' => $service !== '' ? $service : 'ok',
            'status' => $status,
            'provider_code' => $result['provider_code'] ?? $fromAdapter['provider_code'] ?? null,
            'balance_value' => $balanceValue,
            'sync' => $this->syncIndicator($provider),
            'inquiry' => $this->inquiryIndicator($provider),
            'success_rate' => $this->successRateIndicator($provider),
            'success_rate_value' => $provider->success_rate !== null ? (float) $provider->success_rate : null,
            'product_count' => (int) ($provider->product_count ?? 0),
            'latency_ms' => $result['latency_ms'] ?? null,
            'http_status' => $result['http_status'] ?? null,
            'partner_status' => $provider->partner_status,
            'message' => $result['provider_message'] ?? $result['message'] ?? null,
            'provider_message' => $result['provider_message'] ?? $result['message'] ?? null,
            'warnings' => [],
        ];
    }

    protected function syncIndicator(ProductProvider $provider): string
    {
        $count = (int) ($provider->product_count ?? 0);
        if ($count <= 0) {
            $count = ProductProviderSku::query()
                ->where('product_provider_id', $provider->id)
                ->where('is_active', true)
                ->count();
        }

        if ($count <= 0) {
            return 'failed';
        }

        if (! $provider->last_sync_at) {
            return 'stale';
        }

        if ($provider->last_sync_at->lt(now()->subDays(2))) {
            return 'stale';
        }

        return 'ok';
    }

    protected function inquiryIndicator(ProductProvider $provider): string
    {
        $recentFails = ProductProviderLog::query()
            ->where('product_provider_id', $provider->id)
            ->where('created_at', '>=', now()->subHours(6))
            ->where(function ($q) {
                $q->where('event_type', 'inquiry_failed')
                    ->orWhere(function ($inner) {
                        $inner->where('event_type', 'fulfill_attempt')
                            ->where('success', false)
                            ->where(function ($r) {
                                $r->where('reason', 'like', '%inquiry%')
                                    ->orWhere('error_message', 'like', '%inquiry%');
                            });
                    });
            })
            ->count();

        if ($recentFails >= 3) {
            return 'warning';
        }

        return 'ok';
    }

    protected function successRateIndicator(ProductProvider $provider): string
    {
        if ($provider->success_rate === null) {
            return 'unknown';
        }

        $rate = (float) $provider->success_rate;
        $total = (int) ($provider->transactions_today ?? 0);
        if ($total >= 5 && $rate < 90) {
            return 'warning';
        }

        return 'ok';
    }

    /**
     * @param  array{api_status:string,health_color:string,label:string,description:string,transaction_eligible:bool,indicators:array}  $evaluated
     * @param  array<string, mixed>  $meta
     */
    protected function persistEvaluation(
        ProductProvider $provider,
        array $evaluated,
        ?int $latency,
        array $meta,
        mixed $oldApiStatus,
        mixed $oldHealthColor,
        mixed $oldLastError,
        mixed $balance = null,
        ?array $providerProfile = null
    ): ProductProvider {
        $status = $evaluated['api_status'];
        $color = $evaluated['health_color'];
        $ok = (bool) $evaluated['transaction_eligible'];

        $fill = [
            'api_status' => $status,
            'health_color' => $color,
            'avg_response_ms' => $latency ?? $provider->avg_response_ms,
            'last_health_check_at' => now(),
            'last_error' => $ok && $status === ProviderHealthStatus::ONLINE
                ? null
                : $evaluated['description'],
            'last_success_at' => $ok ? now() : $provider->last_success_at,
            'last_failure_at' => $ok ? $provider->last_failure_at : now(),
        ];

        if ($balance !== null || array_key_exists('balance', $meta)) {
            $fill['balance'] = $meta['balance'] ?? $balance;
        }

        // VIP Profile.pdf metadata only — do not clear on failed probes.
        if (is_array($providerProfile)) {
            $fill['provider_profile'] = $providerProfile;
        }

        $provider->forceFill($fill)->save();

        $this->log($provider, $ok, $latency, $evaluated['description'], array_merge($meta, [
            'health_color' => $color,
            'api_status' => $status,
            'label' => $evaluated['label'],
            'transaction_eligible' => $ok,
        ]));

        $fresh = $provider->fresh();
        $this->logAfterUpdate($fresh, $oldApiStatus, $oldHealthColor, $oldLastError);

        return $fresh;
    }

    protected function logAfterUpdate(
        ?ProductProvider $provider,
        mixed $oldApiStatus,
        mixed $oldHealthColor,
        mixed $oldLastError
    ): void {
        if (! $provider) {
            return;
        }

        Log::info('HEALTH CHECK — after update', [
            'Provider ID' => $provider->id,
            'Provider Code' => $provider->code,
            'Old api_status' => $oldApiStatus,
            'Old health_color' => $oldHealthColor,
            'Old last_error' => $oldLastError,
            'New api_status' => $provider->api_status,
            'New health_color' => $provider->health_color,
            'New last_error' => $provider->last_error,
            'Updated timestamp' => optional($provider->last_health_check_at)?->toIso8601String(),
        ]);
    }

    public function checkAll(): array
    {
        $out = [];
        foreach (ProductProvider::query()->orderBy('priority')->get() as $provider) {
            $out[] = $this->check($provider);
        }

        return $out;
    }

    /**
     * Refresh daily counters + success rate from logs (best-effort).
     */
    public function refreshStats(ProductProvider $provider): void
    {
        $today = now()->startOfDay();

        $attempts = ProductProviderLog::query()
            ->where('product_provider_id', $provider->id)
            ->where('event_type', 'fulfill_attempt')
            ->where('created_at', '>=', $today);

        $total = (clone $attempts)->count();
        $success = (clone $attempts)->where('success', true)->count();
        $failed = (clone $attempts)->where('success', false)->count();

        $avg = ProductProviderLog::query()
            ->where('product_provider_id', $provider->id)
            ->where('event_type', 'fulfill_attempt')
            ->where('created_at', '>=', $today)
            ->whereNotNull('response_time_ms')
            ->avg('response_time_ms');

        $productCount = ProductProviderSku::query()
            ->where('product_provider_id', $provider->id)
            ->where('is_active', true)
            ->count();

        $provider->forceFill([
            'transactions_today' => $total,
            'failed_transactions_today' => $failed,
            'success_rate' => $total > 0 ? round(($success / $total) * 100, 2) : null,
            'avg_response_ms' => $avg !== null ? (int) round($avg) : $provider->avg_response_ms,
            'product_count' => $productCount,
        ])->save();
    }

    public function recordFulfillmentOutcome(ProductProvider $provider, ProviderFulfillmentResult $result): void
    {
        $updates = [
            'avg_response_ms' => $result->responseTimeMs,
        ];

        if ($result->ok && $result->status === 'success') {
            $updates['last_success_at'] = now();
            $updates['last_error'] = null;
            if (in_array(strtolower((string) ($provider->api_status ?? '')), ['offline', 'timeout'], true)) {
                // Do not auto-promote to online from a single success — next health check decides.
                $updates['api_status'] = ProviderHealthStatus::PARTIAL;
                $updates['health_color'] = 'yellow';
            }
        } elseif (! $result->ok) {
            $updates['last_failure_at'] = now();
            $updates['last_error'] = $result->message ?? $result->reason;
            if (in_array($result->reason, ['timeout', 'http_5xx', 'provider_offline'], true)) {
                $updates['api_status'] = ProviderHealthStatus::PARTIAL;
                $updates['health_color'] = 'yellow';
            }
        }

        $provider->forceFill($updates)->save();

        try {
            $this->refreshStats($provider->fresh());
        } catch (\Throwable $e) {
            Log::debug('refreshStats skipped', ['error' => $e->getMessage()]);
        }
    }

    protected function log(
        ProductProvider $provider,
        bool $success,
        ?int $latency,
        ?string $message,
        array $meta = []
    ): void {
        ProductProviderLog::create([
            'product_provider_id' => $provider->id,
            'event_type' => 'health_check',
            'selected_provider_code' => $provider->code,
            'success' => $success,
            'response_time_ms' => $latency,
            'error_message' => $success && ($meta['api_status'] ?? '') === ProviderHealthStatus::ONLINE ? null : $message,
            'reason' => ($meta['api_status'] ?? null) === ProviderHealthStatus::ONLINE ? 'health_ok' : 'health_attention',
            'meta' => $meta,
        ]);
    }
}
