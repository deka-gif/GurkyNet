<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\ProductProviderSku;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProductProviderHealthService
{
    public function __construct(protected ProductProviderRegistry $registry) {}

    /**
     * Run health check for one provider and persist metrics.
     */
    public function check(ProductProvider $provider): ProductProvider
    {
        $provider->refresh();

        $oldApiStatus = $provider->api_status;
        $oldHealthColor = $provider->health_color;
        $oldLastError = $provider->last_error;
        $oldLastCheck = optional($provider->last_health_check_at)?->toIso8601String();

        Log::info('HEALTH CHECK — before update', [
            'Provider ID' => $provider->id,
            'Provider Code' => $provider->code,
            'Old api_status' => $oldApiStatus,
            'Old health_color' => $oldHealthColor,
            'Old last_error' => $oldLastError,
            'Old last_health_check_at' => $oldLastCheck,
            'is_active' => $provider->is_active,
        ]);

        if (!$this->registry->has($provider->code)) {
            Log::info('HEALTH CHECK — adapter missing', [
                'Provider Code' => $provider->code,
            ]);

            $provider->forceFill([
                'api_status' => 'offline',
                'health_color' => 'red',
                'last_health_check_at' => now(),
                'last_error' => 'No adapter registered',
            ])->save();

            $this->log($provider, false, null, 'No adapter registered', [
                'api_status' => 'offline',
            ]);

            $fresh = $provider->fresh();
            $this->logAfterUpdate($fresh, $oldApiStatus, $oldHealthColor, $oldLastError);

            return $fresh;
        }

        $adapter = $this->registry->get($provider->code);

        Log::info('HEALTH CHECK — adapter selected', [
            'Provider Code' => $provider->code,
            'adapter_class' => $adapter::class,
        ]);

        // Always probe API — power (is_active) must never override health status.
        // Power OFF + API Online is valid: products hidden, API still healthy.
        $result = $adapter->healthCheck();
        $probeStatus = (string) ($result['api_status'] ?? '');

        Log::info('HEALTH CHECK — adapter/VipService result', [
            'Provider ID' => $provider->id,
            'Provider Code' => $provider->code,
            'success' => (bool) ($result['success'] ?? $result['authenticated'] ?? false)
                || in_array($probeStatus, ['online', 'degraded'], true),
            'api_status' => $probeStatus,
            'health_color' => $result['health_color'] ?? null,
            'http_status' => $result['http_status'] ?? null,
            'latency_ms' => $result['latency_ms'] ?? null,
            'latency' => $result['latency_ms'] ?? null,
            'message' => $result['message'] ?? null,
            'authenticated' => $result['authenticated'] ?? null,
            'reachable' => $result['reachable'] ?? null,
            'balance' => $result['balance'] ?? null,
        ]);

        if ($probeStatus === 'not_configured') {
            $message = (string) ($result['message'] ?? 'NOT CONFIGURED');
            $provider->forceFill([
                'api_status' => 'not_configured',
                'health_color' => 'red',
                'last_health_check_at' => now(),
                'last_error' => $message,
                'avg_response_ms' => $result['latency_ms'] ?? $provider->avg_response_ms,
            ])->save();

            $this->log($provider, false, $result['latency_ms'] ?? null, $message, [
                'api_status' => 'not_configured',
                'missing' => $result['raw']['missing'] ?? null,
            ]);

            $fresh = $provider->fresh();
            $this->logAfterUpdate($fresh, $oldApiStatus, $oldHealthColor, $oldLastError);

            return $fresh;
        }

        $latency = $result['latency_ms'] ?? null;
        $balance = $result['balance'] ?? null;
        $message = $result['message'] ?? null;

        // Prefer adapter-provided status (online / auth_failed / timeout / not_configured / …)
        $status = (string) ($result['api_status'] ?? '');
        $color = (string) ($result['health_color'] ?? '');

        if ($status === '') {
            $reachable = (bool) ($result['reachable'] ?? false);
            $auth = (bool) ($result['authenticated'] ?? false);
            $status = 'offline';
            $color = 'red';
            if ($reachable && $auth) {
                $status = 'online';
                $color = ($latency !== null && $latency > 3000) ? 'yellow' : 'green';
                if ($balance !== null && $balance <= 0) {
                    $color = 'yellow';
                    $status = 'degraded';
                }
            } elseif ($reachable) {
                $status = 'degraded';
                $color = 'yellow';
            }
        }

        if ($color === '') {
            $color = match ($status) {
                'online' => 'green',
                'degraded', 'timeout' => 'yellow',
                'auth_failed', 'not_configured', 'offline' => 'red',
                default => 'yellow',
            };
        }

        if ($status === 'online' && $balance !== null && $balance <= 0) {
            $status = 'degraded';
            $color = 'yellow';
        }

        $ok = in_array($status, ['online', 'degraded'], true);

        $provider->forceFill([
            'api_status' => $status,
            'health_color' => $color,
            'balance' => $balance,
            'avg_response_ms' => $latency ?? $provider->avg_response_ms,
            'last_health_check_at' => now(),
            'last_error' => $ok ? null : $message,
            'last_success_at' => $ok ? now() : $provider->last_success_at,
            'last_failure_at' => $ok ? $provider->last_failure_at : now(),
        ])->save();

        $this->log($provider, $ok, $latency, $message, [
            'balance' => $balance,
            'health_color' => $color,
            'api_status' => $status,
            'http_status' => $result['http_status'] ?? null,
        ]);

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
        if (!$provider) {
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
            if (($provider->api_status ?? '') === 'offline') {
                $updates['api_status'] = 'online';
                $updates['health_color'] = 'green';
            }
        } elseif (!$result->ok) {
            $updates['last_failure_at'] = now();
            $updates['last_error'] = $result->message ?? $result->reason;
            if (in_array($result->reason, ['timeout', 'http_5xx', 'provider_offline', 'provider_maintenance'], true)) {
                $updates['api_status'] = 'degraded';
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
            'error_message' => $success ? null : $message,
            'reason' => $success ? 'health_ok' : 'health_failed',
            'meta' => $meta,
        ]);
    }
}
