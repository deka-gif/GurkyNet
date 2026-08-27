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
     *
     * @return array{providers: list<array<string, mixed>>, autoSync: array<string, mixed>}
     */
    public function listControlCenter(): array
    {
        $providers = ProductProvider::query()->orderBy('priority')->orderBy('sort_order')->get();

        $cards = $providers->map(function (ProductProvider $p) {
            try {
                $this->health->refreshStats($p);
                $p->refresh();
            } catch (\Throwable) {
                // ignore stats refresh failures
            }

            return $this->toCard($p);
        })->all();

        return [
            'providers' => $cards,
            'autoSync' => app(AutomaticCatalogSyncService::class)->statusPayload(),
        ];
    }

    public function toCard(ProductProvider $p): array
    {
        $api = strtolower((string) ($p->api_status ?? 'unknown'));
        $apiStatusLabel = ProviderHealthStatus::labelFor($api);
        $statusDescription = ProviderHealthStatus::descriptionFor($p);
        $healthColor = strtolower((string) ($p->health_color ?? 'yellow'));
        if (! in_array($healthColor, ['green', 'yellow', 'orange', 'red'], true)) {
            $healthColor = match ($api) {
                'online' => 'green',
                'partial', 'degraded', 'syncing' => 'yellow',
                'maintenance' => 'orange',
                default => 'red',
            };
        }
        $transactionEligible = ProviderHealthStatus::isTransactionEligible(
            $p->api_status,
            $p->partner_status
        ) && app(ProviderCircuitBreaker::class)->allowsFulfillment((string) $p->code);
        $poweredOn = (bool) $p->is_active;
        $productCount = (int) (
            $p->product_count
            ?? ProductProviderSku::where('product_provider_id', $p->id)->where('is_active', true)->count()
        );
        $lastSyncDisplay = $p->last_sync_at
            ? $p->last_sync_at->timezone(config('app.timezone'))->format('d/m/Y H:i')
            : null;

        return [
            'id' => $p->id,
            'code' => $p->code,
            'name' => $p->name,
            'logo' => $p->logo,
            'enabled' => $poweredOn,
            // Top-badge power state — mirrors product_providers.is_active only.
            'status' => $poweredOn ? 'ON' : 'OFF',
            'partnerStatus' => strtolower((string) ($p->partner_status ?? ($poweredOn ? 'online' : 'offline'))),
            'priority' => (int) $p->priority,
            'apiStatus' => $p->api_status,
            'apiStatusLabel' => $apiStatusLabel,
            'healthColor' => $healthColor,
            'healthLabel' => $apiStatusLabel,
            'statusDescription' => $statusDescription,
            'balance' => $p->balance !== null ? (float) $p->balance : null,
            'productCount' => $productCount,
            'productCountLabel' => $productCount.' SKU',
            'lastSyncAt' => optional($p->last_sync_at)?->toIso8601String(),
            'lastSyncDisplay' => $lastSyncDisplay,
            'avgResponseMs' => $p->avg_response_ms,
            'successRate' => $p->success_rate !== null ? (float) $p->success_rate : null,
            'failedTransactionsToday' => (int) $p->failed_transactions_today,
            'transactionsToday' => (int) $p->transactions_today,
            'lastHealthCheckAt' => optional($p->last_health_check_at)?->toIso8601String(),
            'lastSuccessAt' => optional($p->last_success_at)?->toIso8601String(),
            'lastFailureAt' => optional($p->last_failure_at)?->toIso8601String(),
            'lastError' => $p->last_error,
            'healthIndicators' => $this->healthIndicatorsForCard($p),
            'providerCode' => $this->lastHealthMeta($p)['provider_code'] ?? null,
            'providerMessage' => $this->lastHealthMeta($p)['provider_message']
                ?? $this->lastHealthMeta($p)['probe_message']
                ?? $p->last_error,
            'probeLatencyMs' => $this->lastHealthMeta($p)['latency_ms']
                ?? $p->avg_response_ms,
            'isPrimary' => (int) $p->priority === 1,
            'online' => $transactionEligible,
            'transactionEligible' => $transactionEligible,
            'apiWarning' => $poweredOn && ! $transactionEligible,
            'routingMode' => 'product_priority_failover',
            'controlsCatalogAlone' => false,
            'note' => 'Status health memengaruhi kandidat transaksi. Produk tetap tampil jika provider cadangan siap memproses.',
            'lastSyncDurationSec' => $this->lastSyncMeta($p)['duration_sec'] ?? null,
            'nextRecommendedSyncAt' => $this->lastSyncMeta($p)['next_recommended_sync_at']
                ?? ($p->last_sync_at ? $p->last_sync_at->copy()->addMinutes(30)->toIso8601String() : null),
            'syncSummary' => $this->lastSyncMeta($p),
            'productAudit' => $this->productAuditForCard($p),
            'apiVersion' => $this->lastHealthMeta($p)['api_version']
                ?? $this->lastHealthMeta($p)['provider_profile']['api_version']
                ?? null,
            'lastCheckedAt' => optional($p->last_health_check_at)?->toIso8601String(),
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

        // Power ON — visibility only. Health fields are refreshed by the probe below.
        $provider->is_active = true;
        if (strtolower((string) ($provider->partner_status ?? '')) === 'offline'
            || strtolower((string) ($provider->partner_status ?? '')) === '') {
            $provider->partner_status = 'online';
        }

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
        $this->flushProductCatalogCache();

        // Root-cause fix: routing trusts product_providers.api_status.
        // Power ON must immediately probe the live API and persist health so
        // stale offline rows cannot block Digi→VIP failover after power restore.
        $beforeHealth = DB::table('product_providers')->where('id', $provider->id)->first([
            'api_status', 'health_color', 'last_error', 'last_health_check_at',
        ]);

        Log::info('POWER ON — automatic health check starting', [
            'Provider ID' => $provider->id,
            'Provider Code' => $provider->code,
            'Old api_status' => $beforeHealth->api_status ?? null,
            'Old health_color' => $beforeHealth->health_color ?? null,
            'Old last_error' => $beforeHealth->last_error ?? null,
            'Old last_health_check_at' => $beforeHealth->last_health_check_at ?? null,
        ]);

        try {
            $fresh = $this->health->check($provider->fresh() ?? $provider);
        } catch (\Throwable $e) {
            Log::error('POWER ON — automatic health check threw', [
                'Provider ID' => $provider->id,
                'Provider Code' => $provider->code,
                'error' => $e->getMessage(),
            ]);
            // Power remains ON; keep last known health rather than inventing status.
            $fresh = $provider->fresh() ?? $provider;
        }

        Log::info('POWER ON — automatic health check finished', [
            'Provider ID' => $fresh->id,
            'Provider Code' => $fresh->code,
            'Fresh is_active' => $fresh->is_active,
            'New api_status' => $fresh->api_status,
            'New health_color' => $fresh->health_color,
            'New last_error' => $fresh->last_error,
            'New last_health_check_at' => optional($fresh->last_health_check_at)?->toIso8601String(),
        ]);

        return $fresh;
    }

    /**
     * Ops maintenance mode — products may stay visible; transactions skip this provider.
     */
    public function setMaintenance(ProductProvider $provider): ProductProvider
    {
        $provider->is_active = true;
        $provider->partner_status = 'maintenance';
        $provider->save();
        $this->flushProductCatalogCache();

        return $provider->fresh() ?? $provider;
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
        // Routing skips this provider; catalog visibility is product-centric (failover).
        $provider->is_active = false;
        $provider->partner_status = 'offline';

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
                'success' => ($result['status'] ?? '') !== 'failed',
                'reason' => 'sync_completed',
                'response_time_ms' => $result['duration_ms'] ?? null,
                'meta' => $result,
            ]);

            $this->flushProductCatalogCache();

            return array_merge($result, [
                'summary' => [
                    'providerSkuTotal' => $result['provider_sku_total'] ?? $result['synced_count'] ?? 0,
                    'inserted' => $result['inserted'] ?? 0,
                    'updated' => $result['updated'] ?? 0,
                    'skipped' => $result['skipped'] ?? 0,
                    'disabled' => $result['disabled'] ?? 0,
                    'durationSec' => $result['duration_sec'] ?? null,
                ],
                'audit' => [
                    'providerSku' => $result['provider_sku_total'] ?? 0,
                    'databaseSku' => $result['database_sku_total'] ?? 0,
                    'difference' => $result['difference'] ?? 0,
                ],
                'provider' => $this->toCard($provider->fresh()),
            ]);
        }

        if ($provider->code === ProductProvider::CODE_VIP) {
            try {
                $result = $this->syncVip->execute($options);
                $this->flushProductCatalogCache();

                return array_merge($result, [
                    'summary' => [
                        'providerSkuTotal' => ($result['imported'] ?? 0) + ($result['updated'] ?? 0) + ($result['skipped'] ?? 0),
                        'inserted' => $result['imported'] ?? 0,
                        'updated' => $result['updated'] ?? 0,
                        'skipped' => $result['skipped'] ?? 0,
                        'disabled' => 0,
                        'durationSec' => isset($result['api_latency_ms'])
                            ? round(((int) $result['api_latency_ms']) / 1000, 1)
                            : null,
                    ],
                    'audit' => [
                        'providerSku' => $result['product_count'] ?? null,
                        'databaseSku' => ProductProviderSku::where('product_provider_id', $provider->id)->count(),
                        'difference' => null,
                    ],
                    'provider' => $this->toCard($provider->fresh()),
                ]);
            } catch (\App\Exceptions\ProviderCatalogException $e) {
                throw $e;
            } catch (\Throwable $e) {
                ProductProviderLog::create([
                    'product_provider_id' => $provider->id,
                    'event_type' => 'sync',
                    'selected_provider_code' => $provider->code,
                    'success' => false,
                    'reason' => 'sync_failed',
                    'error_message' => $e->getMessage(),
                ]);

                throw new \App\Exceptions\ProviderCatalogException(
                    $e->getMessage(),
                    'VIPayment',
                    'SYNC_FAILED',
                    true,
                    ['exception' => class_basename($e)]
                );
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

        throw new \App\Exceptions\ProviderCatalogException(
            'Sinkronisasi katalog untuk ' . $provider->name . ' belum dikonfigurasi.',
            $provider->name,
            'NOT_IMPLEMENTED',
            false
        );
    }

    /**
     * Probe every product provider and return fresh cards (balances, health, SKU, latency).
     */
    public function refreshAll(): array
    {
        $providers = ProductProvider::query()->orderBy('priority')->orderBy('id')->get();
        $cards = [];
        $errors = [];

        foreach ($providers as $provider) {
            try {
                $cards[] = $this->healthCheck($provider);
                $this->audit($provider, 'refresh', true, 'Global operations refresh');
            } catch (\Throwable $e) {
                report($e);
                $errors[] = [
                    'id' => $provider->id,
                    'code' => $provider->code,
                    'message' => $e->getMessage(),
                ];
                $this->audit($provider, 'refresh', false, 'Global refresh failed', [
                    'error' => $e->getMessage(),
                ]);
                $cards[] = $this->toCard($provider->fresh() ?? $provider);
            }
        }

        return [
            'providers' => $cards,
            'errors' => $errors,
            'autoSync' => app(AutomaticCatalogSyncService::class)->statusPayload(),
        ];
    }

    /**
     * Automatic Synchronization panel payload (Sprint 6.3).
     *
     * @return array<string, mixed>
     */
    public function autoSyncStatus(): array
    {
        return app(AutomaticCatalogSyncService::class)->statusPayload();
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
     * @return array<string, mixed>
     */
    protected function lastSyncMeta(ProductProvider $p): array
    {
        $log = ProductProviderLog::query()
            ->where('product_provider_id', $p->id)
            ->where('event_type', 'sync')
            ->where('success', true)
            ->orderByDesc('id')
            ->first();

        return is_array($log?->meta) ? $log->meta : [];
    }

    /**
     * @return array{providerSku:int,databaseSku:int,difference:int,warning:bool}
     */
    protected function productAuditForCard(ProductProvider $p): array
    {
        $dbActive = ProductProviderSku::where('product_provider_id', $p->id)
            ->where('is_active', true)
            ->count();
        $dbRows = ProductProviderSku::where('product_provider_id', $p->id)->count();
        $meta = $this->lastSyncMeta($p);
        $providerSku = (int) ($meta['provider_sku_total'] ?? $p->product_count ?? $dbActive);
        $difference = $providerSku - $dbActive;

        return [
            'providerSku' => $providerSku,
            'databaseSku' => $dbActive,
            'databaseRows' => $dbRows,
            'difference' => $difference,
            'warning' => $difference !== 0,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function lastHealthMeta(ProductProvider $p): array
    {
        $log = ProductProviderLog::query()
            ->where('product_provider_id', $p->id)
            ->where('event_type', 'health_check')
            ->orderByDesc('id')
            ->first();

        return is_array($log?->meta) ? $log->meta : [];
    }

    /**
     * Indicator grid for Control Center — prefers last health_check log meta.
     *
     * @return array{connection:string, authentication:string, balance:string, service:string}
     */
    protected function healthIndicatorsForCard(ProductProvider $p): array
    {
        $meta = $this->lastHealthMeta($p);
        if (isset($meta['indicator_labels']) && is_array($meta['indicator_labels'])) {
            return [
                'connection' => (string) ($meta['indicator_labels']['connection'] ?? 'Unknown'),
                'authentication' => (string) ($meta['indicator_labels']['authentication'] ?? 'Unknown'),
                'balance' => (string) ($meta['indicator_labels']['balance'] ?? 'Unknown'),
                'service' => (string) ($meta['indicator_labels']['service'] ?? 'Unknown'),
            ];
        }

        if (isset($meta['indicators']) && is_array($meta['indicators'])) {
            return ProviderHealthStatus::indicatorLabels($meta['indicators']);
        }

        // Derive from persisted api_status when no probe meta yet.
        $api = strtolower((string) ($p->api_status ?? ''));

        return match ($api) {
            'online' => [
                'connection' => 'Online',
                'authentication' => 'Valid',
                'balance' => 'OK',
                'service' => 'Active',
            ],
            'partial', 'degraded', 'syncing' => [
                'connection' => 'Online',
                'authentication' => 'Valid',
                'balance' => 'Failed',
                'service' => 'Active',
            ],
            'auth_failed' => [
                'connection' => 'Online',
                'authentication' => 'Failed',
                'balance' => 'Unknown',
                'service' => 'Active',
            ],
            'config_error' => [
                'connection' => 'Online',
                'authentication' => 'Unknown',
                'balance' => 'Unknown',
                'service' => 'Active',
            ],
            'network_configuration' => [
                'connection' => 'Online',
                'authentication' => 'Unknown',
                'balance' => 'Unknown',
                'service' => 'Active',
            ],
            'maintenance' => [
                'connection' => 'Online',
                'authentication' => 'Unknown',
                'balance' => 'Unknown',
                'service' => 'Terganggu',
            ],
            'offline', 'timeout', 'no_response' => [
                'connection' => 'Gagal',
                'authentication' => 'Unknown',
                'balance' => 'Unknown',
                'service' => 'Terganggu',
            ],
            default => [
                'connection' => 'Unknown',
                'authentication' => 'Unknown',
                'balance' => 'Unknown',
                'service' => 'Unknown',
            ],
        };
    }

    /**
     * Enable/Disable/Priority/Sync must affect user catalog immediately.
     */
    protected function flushProductCatalogCache(): void
    {
        ProductCatalogCache::bump();
    }
}
