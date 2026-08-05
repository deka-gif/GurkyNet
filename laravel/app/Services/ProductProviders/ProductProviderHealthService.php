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
        if (!$this->registry->has($provider->code)) {
            $provider->forceFill([
                'api_status' => 'offline',
                'health_color' => 'red',
                'last_health_check_at' => now(),
                'last_error' => 'No adapter registered',
            ])->save();

            $this->log($provider, false, null, 'No adapter registered');

            return $provider->fresh();
        }

        if (!$provider->is_active) {
            $provider->forceFill([
                'api_status' => 'offline',
                'health_color' => 'yellow',
                'last_health_check_at' => now(),
                'last_error' => 'Provider disabled',
            ])->save();

            $this->log($provider, false, null, 'Provider disabled');

            return $provider->fresh();
        }

        $adapter = $this->registry->get($provider->code);
        $result = $adapter->healthCheck();

        $reachable = (bool) ($result['reachable'] ?? false);
        $auth = (bool) ($result['authenticated'] ?? false);
        $latency = $result['latency_ms'] ?? null;
        $balance = $result['balance'] ?? null;
        $message = $result['message'] ?? null;

        $color = 'red';
        $status = 'offline';
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

        $provider->forceFill([
            'api_status' => $status,
            'health_color' => $color,
            'balance' => $balance,
            'avg_response_ms' => $latency ?? $provider->avg_response_ms,
            'last_health_check_at' => now(),
            'last_error' => $reachable ? null : $message,
        ])->save();

        $this->log($provider, $reachable && $auth, $latency, $message, [
            'balance' => $balance,
            'health_color' => $color,
            'api_status' => $status,
        ]);

        return $provider->fresh();
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
