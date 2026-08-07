<?php

namespace App\Services\Integration;

use App\Contracts\Realtime\RealtimeTransport;
use App\Models\ProductProvider;
use App\Services\Payment\PaymentGatewayControlService;
use App\Services\ProductProviders\ProductProviderControlService;
use App\Services\ProductProviders\ProviderPartnerService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Sprint 8.5 — Single gateway for external provider API calls.
 * Dashboards must NOT call Digiflazz/VIP/Midtrans directly — only read DB/cache.
 * Manual Ops actions and schedulers go through this service (rate-limited).
 */
class IntegrationService
{
    public const TTL_BALANCE_SECONDS = 600; // 10 minutes

    public const TTL_HEALTH_SECONDS = 60; // 1 minute

    public const TTL_GATEWAY_SECONDS = 60; // 1 minute

    public const CACHE_BALANCE_LOCK = 'integration:lock:balances';

    public const CACHE_HEALTH_LOCK = 'integration:lock:health';

    public const CACHE_GATEWAY_LOCK = 'integration:lock:gateways';

    public function __construct(
        protected ProductProviderControlService $providers,
        protected ProviderPartnerService $partners,
        protected PaymentGatewayControlService $gateways,
        protected RealtimeTransport $realtime
    ) {}

    /**
     * Read-only balance from GurkyNet DB (SSOT). Never hits provider.
     *
     * @return array{code: string, balance: float|null, partner_status: string|null, updated_at: string|null}|null
     */
    public function balanceFromDatabase(string $code): ?array
    {
        $p = ProductProvider::query()->where('code', $code)->first();
        if (! $p) {
            return null;
        }

        return [
            'code' => $p->code,
            'balance' => $p->balance !== null ? (float) $p->balance : null,
            'partner_status' => $p->partner_status,
            'updated_at' => optional($p->last_health_check_at ?? $p->updated_at)?->toIso8601String(),
        ];
    }

    /**
     * Digiflazz balance from DB only (Owner/Finance dashboards).
     */
    public function digiflazzBalanceCached(): ?float
    {
        $row = $this->balanceFromDatabase(ProductProvider::CODE_DIGIFLAZZ)
            ?? $this->balanceFromDatabase('digiflazz');

        return $row['balance'] ?? null;
    }

    /**
     * Sync provider balances via health checks — rate limited to 10 minutes unless forced.
     *
     * @return array{synced: bool, skipped: bool, reason?: string, rows: list<array<string, mixed>>}
     */
    public function syncBalances(bool $force = false): array
    {
        if (! $force && ! $this->acquireThrottle(self::CACHE_BALANCE_LOCK, self::TTL_BALANCE_SECONDS)) {
            return [
                'synced' => false,
                'skipped' => true,
                'reason' => 'Rate limited — next balance sync after '.self::TTL_BALANCE_SECONDS.'s',
                'rows' => $this->balanceSnapshotRows(),
            ];
        }

        $rows = [];
        foreach (ProductProvider::query()->orderBy('priority')->get() as $provider) {
            try {
                $this->providers->healthCheck($provider);
                $provider->refresh();
                $rows[] = [
                    'id' => $provider->id,
                    'code' => $provider->code,
                    'balance' => $provider->balance !== null ? (float) $provider->balance : null,
                    'partner_status' => $provider->partner_status,
                ];
            } catch (\Throwable $e) {
                Log::warning('IntegrationService::syncBalances failed', [
                    'code' => $provider->code,
                    'error' => $e->getMessage(),
                ]);
                $rows[] = [
                    'id' => $provider->id,
                    'code' => $provider->code,
                    'balance' => $provider->balance !== null ? (float) $provider->balance : null,
                    'error' => $e->getMessage(),
                ];
            }
        }

        $this->realtime->publish('division.operations', 'ProviderBalancesSynced', [
            'at' => now()->toIso8601String(),
            'count' => count($rows),
        ]);
        $this->realtime->publish('division.finance', 'ProviderBalancesSynced', [
            'at' => now()->toIso8601String(),
            'count' => count($rows),
        ]);

        return ['synced' => true, 'skipped' => false, 'rows' => $rows];
    }

    /**
     * Provider health probe — rate limited to 1 minute unless forced.
     *
     * @return array{probed: bool, skipped: bool, reason?: string, results: mixed}
     */
    public function probeHealth(bool $force = false): array
    {
        if (! $force && ! $this->acquireThrottle(self::CACHE_HEALTH_LOCK, self::TTL_HEALTH_SECONDS)) {
            return [
                'probed' => false,
                'skipped' => true,
                'reason' => 'Rate limited — health probe cooldown '.self::TTL_HEALTH_SECONDS.'s',
                'results' => $this->partners->list(['per_page' => 50])->items(),
            ];
        }

        $results = $this->partners->refreshAllHealth();

        $this->realtime->publish('division.operations', 'ProviderHealthProbed', [
            'at' => now()->toIso8601String(),
        ]);

        return ['probed' => true, 'skipped' => false, 'results' => $results];
    }

    /**
     * Payment gateway health — rate limited to 1 minute.
     *
     * @return array{probed: bool, skipped: bool, reason?: string, gateways: list<array<string, mixed>>}
     */
    public function probePaymentGateways(bool $force = false): array
    {
        if (! $force && ! $this->acquireThrottle(self::CACHE_GATEWAY_LOCK, self::TTL_GATEWAY_SECONDS)) {
            return [
                'probed' => false,
                'skipped' => true,
                'reason' => 'Rate limited — gateway probe cooldown '.self::TTL_GATEWAY_SECONDS.'s',
                'gateways' => $this->gateways->listControlCenter(),
            ];
        }

        $out = [];
        foreach ($this->gateways->listControlCenter() as $gw) {
            $code = (string) ($gw['code'] ?? '');
            if ($code === '') {
                continue;
            }
            try {
                $out[] = $this->gateways->healthCheck($code);
            } catch (\Throwable $e) {
                $out[] = array_merge($gw, ['error' => $e->getMessage()]);
            }
        }

        $this->realtime->publish('division.finance', 'PaymentGatewaysProbed', [
            'at' => now()->toIso8601String(),
        ]);
        $this->realtime->publish('division.operations', 'PaymentGatewaysProbed', [
            'at' => now()->toIso8601String(),
        ]);

        return ['probed' => true, 'skipped' => false, 'gateways' => $out];
    }

    /**
     * Manual Ops-only health check for one provider (bypasses global throttle with force).
     *
     * @return array<string, mixed>
     */
    public function healthCheckProvider(ProductProvider $provider, bool $force = true): array
    {
        return $this->providers->healthCheck($provider);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function balanceSnapshotRows(): array
    {
        return ProductProvider::query()
            ->orderBy('priority')
            ->get(['id', 'code', 'name', 'balance', 'partner_status', 'last_health_check_at'])
            ->map(fn (ProductProvider $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'balance' => $p->balance !== null ? (float) $p->balance : null,
                'partner_status' => $p->partner_status,
                'last_health_check_at' => optional($p->last_health_check_at)?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Policy metadata for ops/docs/tests.
     *
     * @return array<string, mixed>
     */
    public function policy(): array
    {
        return [
            'balance_ttl_seconds' => self::TTL_BALANCE_SECONDS,
            'health_ttl_seconds' => self::TTL_HEALTH_SECONDS,
            'gateway_ttl_seconds' => self::TTL_GATEWAY_SECONDS,
            'catalog_sync' => 'nightly_2359_wib_or_manual',
            'dashboard_may_call_provider' => false,
            'owner_may_call_provider' => false,
            'operations_manual_allowed' => ['health_check', 'sync', 'maintenance', 'retry_intent'],
        ];
    }

    protected function acquireThrottle(string $key, int $ttlSeconds): bool
    {
        // Cache::add returns true only if key was absent
        return Cache::add($key, now()->toIso8601String(), $ttlSeconds);
    }
}
