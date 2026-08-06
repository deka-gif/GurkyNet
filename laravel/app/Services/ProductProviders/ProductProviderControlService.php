<?php

namespace App\Services\ProductProviders;

use App\Actions\Admin\Operations\SyncDigiflazzCatalogAction;
use App\Actions\Admin\Operations\SyncVipCatalogAction;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\ProductProviderSku;
use App\Services\ProductProviders\ProductCatalogCache;
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
        // API status is health-only — never derived from is_active (power).
        $statusLabel = match ($api) {
            'online' => 'ONLINE',
            'degraded', 'syncing' => 'SYNCING',
            'auth_failed' => 'AUTH ERROR',
            'timeout' => 'TIMEOUT',
            'not_configured' => 'NOT CONFIGURED',
            'no_response', 'unknown' => 'NO RESPONSE',
            'offline' => 'OFFLINE',
            default => strtoupper(str_replace('_', ' ', $api)),
        };
        $healthColor = strtolower((string) ($p->health_color ?? 'yellow'));
        if (!in_array($healthColor, ['green', 'yellow', 'red'], true)) {
            $healthColor = match ($api) {
                'online' => 'green',
                'degraded', 'syncing', 'timeout' => 'yellow',
                default => 'red',
            };
        }
        // Friendly health label (dot + text) — never "Health Yellow/Green/Red".
        $healthLabel = match ($healthColor) {
            'green' => 'Online',
            'yellow' => 'Syncing',
            default => 'Offline',
        };
        $apiOnline = in_array($api, ['online', 'degraded', 'syncing'], true);

        return [
            'id' => $p->id,
            'code' => $p->code,
            'name' => $p->name,
            'logo' => $p->logo,
            'enabled' => (bool) $p->is_active,
            'status' => $statusLabel,
            'priority' => (int) $p->priority,
            'apiStatus' => $p->api_status,
            'healthColor' => $healthColor,
            'healthLabel' => $healthLabel,
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
            'online' => $apiOnline,
            'apiWarning' => (bool) $p->is_active && !$apiOnline,
        ];
    }

    public function enable(ProductProvider $provider): ProductProvider
    {
        Log::info('EXEC TRACE — ENTER Service Enable', [
            'Provider ID' => $provider->id,
            'code' => $provider->code,
            'Current model is_active' => $provider->is_active,
            'Current model api_status' => $provider->api_status,
        ]);

        $provider->is_active = true;

        Log::info('EXEC TRACE — Before save() Enable', [
            'Provider ID' => $provider->id,
            'Dirty attributes' => $provider->getDirty(),
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $saved = $provider->save();
        $queryLog = DB::getQueryLog();
        DB::disableQueryLog();

        $updateQueries = array_values(array_filter($queryLog, function (array $q) {
            return (bool) preg_match('/\bupdate\s+[`"\[]?product_providers[`"\]]?/i', (string) ($q['query'] ?? ''));
        }));

        Log::info('EXEC TRACE — SQL UPDATE executed Enable', [
            'Provider ID' => $provider->id,
            'save_returned' => $saved,
            'SQL UPDATE executed' => $updateQueries,
            'Rows affected' => $provider->wasChanged() ? 1 : 0,
            'wasChanged_is_active' => $provider->wasChanged('is_active'),
            'getChanges' => $provider->getChanges(),
        ]);

        Log::info('EXEC TRACE — After save() Enable', [
            'Provider ID' => $provider->id,
            'model is_active' => $provider->is_active,
            'model api_status' => $provider->api_status,
        ]);

        $this->audit($provider, 'enable', true, 'Provider power ON — products visible in catalog');

        $fresh = $provider->fresh();
        $dbRow = DB::table('product_providers')->where('id', $provider->id)->first(['is_active', 'api_status']);

        Log::info('EXEC TRACE — Fresh model Enable', [
            'Provider ID' => $fresh?->id,
            'Fresh model is_active' => $fresh?->is_active,
            'Fresh model api_status' => $fresh?->api_status,
            'Fresh DB is_active' => $dbRow->is_active ?? null,
            'Fresh DB api_status' => $dbRow->api_status ?? null,
        ]);

        $this->flushProductCatalogCache();

        return $fresh;
    }

    public function disable(ProductProvider $provider): ProductProvider
    {
        Log::info('EXEC TRACE — ENTER Service Disable', [
            'Provider ID' => $provider->id,
            'code' => $provider->code,
            'Current model is_active' => $provider->is_active,
            'Current model api_status' => $provider->api_status,
        ]);

        // Power OFF only — do not mutate api_status / health_color.
        $provider->is_active = false;

        Log::info('EXEC TRACE — Before save() Disable', [
            'Provider ID' => $provider->id,
            'Dirty attributes' => $provider->getDirty(),
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $saved = $provider->save();
        $queryLog = DB::getQueryLog();
        DB::disableQueryLog();

        $updateQueries = array_values(array_filter($queryLog, function (array $q) {
            return (bool) preg_match('/\bupdate\s+[`"\[]?product_providers[`"\]]?/i', (string) ($q['query'] ?? ''));
        }));

        Log::info('EXEC TRACE — SQL UPDATE executed Disable', [
            'Provider ID' => $provider->id,
            'save_returned' => $saved,
            'SQL UPDATE executed' => $updateQueries,
            'Rows affected' => $provider->wasChanged() ? 1 : 0,
            'wasChanged_is_active' => $provider->wasChanged('is_active'),
            'getChanges' => $provider->getChanges(),
        ]);

        Log::info('EXEC TRACE — After save() Disable', [
            'Provider ID' => $provider->id,
            'model is_active' => $provider->is_active,
            'model api_status' => $provider->api_status,
        ]);

        $this->audit($provider, 'disable', true, 'Provider power OFF — products hidden from catalog');

        $fresh = $provider->fresh();
        $dbRow = DB::table('product_providers')->where('id', $provider->id)->first(['is_active', 'api_status']);

        Log::info('EXEC TRACE — Fresh model Disable', [
            'Provider ID' => $fresh?->id,
            'Fresh model is_active' => $fresh?->is_active,
            'Fresh model api_status' => $fresh?->api_status,
            'Fresh DB is_active' => $dbRow->is_active ?? null,
            'Fresh DB api_status' => $dbRow->api_status ?? null,
        ]);

        $this->flushProductCatalogCache();

        return $fresh;
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
     * Power (is_active) does not gate sync — operators may prepare catalog while hidden.
     */
    public function syncNow(ProductProvider $provider, array $options = []): array
    {
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
     * Enable/Disable/Priority/Sync must affect user catalog immediately.
     */
    protected function flushProductCatalogCache(): void
    {
        ProductCatalogCache::bump();
    }
}
