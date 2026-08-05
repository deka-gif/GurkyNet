<?php

namespace App\Services\ProductProviders;

use App\Actions\Admin\Operations\SyncDigiflazzCatalogAction;
use App\Actions\Admin\Operations\SyncVipCatalogAction;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\ProductProviderSku;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Operations Product Provider Control Center domain service.
 * Payment gateways are never managed here.
 */
class ProductProviderControlService
{
    public function __construct(
        protected ProductProviderHealthService $health,
        protected SyncDigiflazzCatalogAction $syncDigiflazz,
        protected SyncVipCatalogAction $syncVip,
    ) {}

    /**
     * Control-center card payloads for all product providers.
     */
    public function listControlCenter(): array
    {
        $providers = ProductProvider::query()->orderBy('priority')->orderBy('sort_order')->get();

        return $providers->map(function (ProductProvider $p) {
            try {
                $this->health->refreshStats($p);
                $p->refresh();
            } catch (\Throwable) {
                // ignore stats refresh failures
            }

            return $this->toCard($p);
        })->all();
    }

    public function toCard(ProductProvider $p): array
    {
        $api = strtolower((string) ($p->api_status ?? 'unknown'));
        // not_configured must win over disabled/offline so missing env is never shown as OFFLINE.
        $statusLabel = match (true) {
            $api === 'not_configured' => 'NOT_CONFIGURED',
            !$p->is_active => 'OFFLINE',
            $api === 'online' => 'ONLINE',
            $api === 'degraded' => 'DEGRADED',
            $api === 'auth_failed' => 'AUTH_FAILED',
            $api === 'timeout' => 'TIMEOUT',
            default => 'OFFLINE',
        };
        $isOnline = $p->is_active && in_array($api, ['online', 'degraded'], true);

        return [
            'id' => $p->id,
            'code' => $p->code,
            'name' => $p->name,
            'logo' => $p->logo,
            'enabled' => (bool) $p->is_active,
            'status' => $statusLabel,
            'priority' => (int) $p->priority,
            'apiStatus' => $p->api_status,
            'healthColor' => $p->health_color,
            'balance' => $p->balance !== null ? (float) $p->balance : null,
            'productCount' => (int) ($p->product_count ?? ProductProviderSku::where('product_provider_id', $p->id)->count()),
            'lastSyncAt' => optional($p->last_sync_at)?->toIso8601String(),
            'avgResponseMs' => $p->avg_response_ms,
            'successRate' => $p->success_rate !== null ? (float) $p->success_rate : null,
            'failedTransactionsToday' => (int) $p->failed_transactions_today,
            'transactionsToday' => (int) $p->transactions_today,
            'lastHealthCheckAt' => optional($p->last_health_check_at)?->toIso8601String(),
            'lastSuccessAt' => optional($p->last_success_at)?->toIso8601String(),
            'lastFailureAt' => optional($p->last_failure_at)?->toIso8601String(),
            'lastError' => $p->last_error,
            'isPrimary' => (int) $p->priority === 1,
            'online' => $isOnline,
        ];
    }

    public function enable(ProductProvider $provider): ProductProvider
    {
        Log::info('EXEC TRACE — enable() before save', [
            'provider_id' => $provider->id,
            'current_is_active' => $provider->is_active,
        ]);

        $provider->is_active = true;
        $provider->save();

        Log::info('EXEC TRACE — enable() after save', [
            'provider_id' => $provider->id,
            'new_is_active' => $provider->is_active,
        ]);

        $this->audit($provider, 'enable', true, 'Provider enabled');

        $fresh = $provider->fresh();

        Log::info('EXEC TRACE — enable() after fresh()', [
            'provider_id' => $fresh?->id,
            'fresh_is_active' => $fresh?->is_active,
        ]);

        $this->flushProductCatalogCache();

        return $fresh;
    }

    public function disable(ProductProvider $provider): ProductProvider
    {
        $provider->is_active = false;
        $provider->api_status = 'offline';
        $provider->health_color = 'yellow';
        $provider->save();

        $this->audit($provider, 'disable', true, 'Provider disabled — traffic auto-switches to next priority');

        $this->flushProductCatalogCache();

        return $provider->fresh();
    }

    public function setPriority(ProductProvider $provider, int $priority): ProductProvider
    {
        if ($priority < 1) {
            throw ValidationException::withMessages(['priority' => ['Priority must be >= 1']]);
        }

        $provider->priority = $priority;
        $provider->save();

        $this->audit($provider, 'set_priority', true, "Priority set to {$priority}", ['priority' => $priority]);

        $this->flushProductCatalogCache();

        return $provider->fresh();
    }

    /**
     * Make this provider primary (priority = 1) and shift previous primary down.
     */
    public function setPrimary(ProductProvider $provider): ProductProvider
    {
        DB::transaction(function () use ($provider) {
            $others = ProductProvider::query()
                ->where('id', '!=', $provider->id)
                ->orderBy('priority')
                ->get();

            $provider->priority = 1;
            $provider->save();

            $next = 2;
            foreach ($others as $other) {
                $other->priority = $next++;
                $other->save();
            }
        });

        $this->audit($provider, 'set_primary', true, 'Set as primary product provider');

        $this->flushProductCatalogCache();

        return $provider->fresh();
    }

    public function healthCheck(ProductProvider $provider): array
    {
        $fresh = $this->health->check($provider);

        return $this->toCard($fresh);
    }

    /**
     * Sync catalog for a specific product provider.
     * Digiflazz uses existing sync pipeline; others require their own adapter sync.
     */
    public function syncNow(ProductProvider $provider, array $options = []): array
    {
        if (!$provider->is_active) {
            throw ValidationException::withMessages([
                'provider' => ['Provider dinonaktifkan. Aktifkan terlebih dahulu sebelum sync.'],
            ]);
        }

        if ($provider->code === ProductProvider::CODE_DIGIFLAZZ) {
            $result = $this->syncDigiflazz->execute($options);
            $provider->forceFill([
                'last_sync_at' => now(),
                'product_count' => ProductProviderSku::where('product_provider_id', $provider->id)->count(),
            ])->save();

            ProductProviderLog::create([
                'product_provider_id' => $provider->id,
                'event_type' => 'sync',
                'selected_provider_code' => $provider->code,
                'success' => true,
                'reason' => 'sync_completed',
                'meta' => $result,
            ]);

            $this->flushProductCatalogCache();

            return array_merge($result, ['provider' => $this->toCard($provider->fresh())]);
        }

        if ($provider->code === ProductProvider::CODE_VIP) {
            try {
                $result = $this->syncVip->execute($options);
                $this->flushProductCatalogCache();

                return array_merge($result, ['provider' => $this->toCard($provider->fresh())]);
            } catch (\Throwable $e) {
                throw ValidationException::withMessages([
                    'provider' => [$e->getMessage()],
                ]);
            }
        }

        ProductProviderLog::create([
            'product_provider_id' => $provider->id,
            'event_type' => 'sync',
            'selected_provider_code' => $provider->code,
            'success' => false,
            'reason' => 'sync_not_implemented',
            'error_message' => 'Catalog sync for this provider is not configured yet.',
        ]);

        throw ValidationException::withMessages([
            'provider' => ['Sinkronisasi katalog untuk ' . $provider->name . ' belum dikonfigurasi.'],
        ]);
    }

    public function logs(ProductProvider $provider, int $limit = 50): array
    {
        return ProductProviderLog::query()
            ->where('product_provider_id', $provider->id)
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (ProductProviderLog $log) => [
                'id' => $log->id,
                'eventType' => $log->event_type,
                'selectedProviderCode' => $log->selected_provider_code,
                'fallbackProviderCode' => $log->fallback_provider_code,
                'reason' => $log->reason,
                'responseTimeMs' => $log->response_time_ms,
                'attempt' => $log->attempt,
                'success' => $log->success,
                'errorMessage' => $log->error_message,
                'meta' => $log->meta,
                'createdAt' => optional($log->created_at)?->toIso8601String(),
            ])
            ->all();
    }

    protected function audit(ProductProvider $provider, string $event, bool $success, string $reason, array $meta = []): void
    {
        ProductProviderLog::create([
            'product_provider_id' => $provider->id,
            'event_type' => $event,
            'selected_provider_code' => $provider->code,
            'success' => $success,
            'reason' => $reason,
            'meta' => $meta,
        ]);
    }

    /**
     * Enable/Disable/Priority must affect user catalog immediately (no deploy / restart).
     */
    protected function flushProductCatalogCache(): void
    {
        try {
            Cache::tags(['products', 'active_products'])->flush();
        } catch (\BadMethodCallException) {
            // File/array cache drivers do not support tags.
        }

        Cache::forget('products_active_all');
    }
}
