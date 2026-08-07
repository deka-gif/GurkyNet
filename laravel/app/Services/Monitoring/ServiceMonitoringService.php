<?php

namespace App\Services\Monitoring;

use App\Models\Product;
use App\Models\Setting;
use App\Services\Catalog\ProductMappingService;
use App\Services\ProductProviders\ProviderPartnerService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Network Operations Center — aggregates GurkyNet SERVICES (not SKU dumps).
 * Status derived from Product Management (ops_status) + Provider Management (partner_status).
 */
class ServiceMonitoringService
{
    public function __construct(
        protected ProductMappingService $mapping,
        protected ProviderPartnerService $partners,
    ) {}

    /**
     * @param  array{status?:string,search?:string,refresh?:bool}  $filters
     * @return array<string, mixed>
     */
    public function overview(array $filters = []): array
    {
        if (filter_var($filters['refresh'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $this->refreshProviderHealth();
        }

        $services = $this->buildServiceCards();

        $statusFilter = $this->normalizeStatusFilter($filters['status'] ?? null);
        if ($statusFilter !== null) {
            $services = $services->filter(
                fn (array $s) => strtolower((string) $s['status']) === $statusFilter
            )->values();
        }

        if (! empty($filters['search'])) {
            $q = strtolower(trim((string) $filters['search']));
            $services = $services->filter(function (array $s) use ($q) {
                $hay = strtolower(implode(' ', [
                    $s['name'] ?? '',
                    $s['key'] ?? '',
                    implode(' ', $s['providerNames'] ?? []),
                ]));

                return str_contains($hay, $q);
            })->values();
        }

        return [
            'summary' => [
                'total_services' => $services->count(),
                'online_services' => $services->where('status', 'Online')->count(),
                'partial_services' => $services->where('status', 'Partial')->count(),
                'maintenance_services' => $services->where('status', 'Maintenance')->count(),
                'offline_services' => $services->where('status', 'Offline')->count(),
                'last_check_at' => now()->toIso8601String(),
            ],
            'services' => $services->values()->all(),
            'checkedAt' => now()->timezone('Asia/Jakarta')->format('H:i:s').' WIB',
        ];
    }

    /**
     * Level 1–2: service detail with per-provider summaries (no full SKU list).
     *
     * @return array<string, mixed>
     */
    public function serviceDetail(string $serviceKey): array
    {
        $meta = $this->serviceCatalog()->firstWhere('key', $serviceKey);
        if (! $meta) {
            abort(404, 'Service tidak ditemukan.');
        }

        if (($meta['type'] ?? 'catalog') === 'wallet') {
            $card = $this->walletServiceCard(now()->timezone('Asia/Jakarta')->format('H:i:s').' WIB');

            return [
                'key' => 'wallet',
                'name' => 'Wallet',
                'status' => $card['status'],
                'totalSku' => 0,
                'onlineSku' => 0,
                'maintenanceSku' => 0,
                'offlineSku' => 0,
                'providers' => [[
                    'id' => null,
                    'code' => 'midtrans',
                    'name' => 'Midtrans',
                    'status' => $card['status'],
                    'totalSku' => 0,
                    'onlineSku' => 0,
                    'maintenanceSku' => 0,
                    'offlineSku' => 0,
                    'avgResponseMs' => null,
                    'latency' => null,
                    'successRate' => null,
                    'lastSyncAt' => null,
                    'lastCheckAt' => $card['lastCheck'],
                ]],
                'lastCheckAt' => now()->toIso8601String(),
                'checkedAt' => $card['lastCheck'],
            ];
        }

        $slugs = $this->mapping->filterSlugs($serviceKey);
        $providerRows = $this->aggregateByProviderForSlugs($slugs);
        $counts = $this->sumCounts($providerRows);
        $providers = $this->formatProviderSummaries($providerRows);
        $status = $this->resolveServiceStatus($counts);

        return [
            'key' => $serviceKey,
            'name' => $meta['name'],
            'status' => $status,
            'totalSku' => $counts['total'],
            'onlineSku' => $counts['online'],
            'maintenanceSku' => $counts['maintenance'],
            'offlineSku' => $counts['offline'],
            'providers' => $providers,
            'lastCheckAt' => now()->toIso8601String(),
            'checkedAt' => now()->timezone('Asia/Jakarta')->format('H:i:s').' WIB',
        ];
    }

    /**
     * Level 3: only problematic SKUs (maintenance + offline), paginated.
     *
     * @return array<string, mixed>
     */
    public function problematicSkus(string $serviceKey, ?int $productProviderId = null, int $page = 1, int $perPage = 50): array
    {
        $meta = $this->serviceCatalog()->firstWhere('key', $serviceKey);
        if (! $meta) {
            abort(404, 'Service tidak ditemukan.');
        }

        if (($meta['type'] ?? 'catalog') === 'wallet') {
            return [
                'service' => 'Wallet',
                'serviceKey' => 'wallet',
                'data' => [],
                'pagination' => [
                    'currentPage' => 1,
                    'lastPage' => 1,
                    'perPage' => $perPage,
                    'total' => 0,
                ],
            ];
        }

        $slugs = $this->mapping->filterSlugs($serviceKey);
        $perPage = max(1, min(100, $perPage));
        $page = max(1, $page);

        $query = Product::query()
            ->join('product_categories', 'product_categories.id', '=', 'products.product_category_id')
            ->leftJoin('product_providers', 'product_providers.id', '=', 'products.product_provider_id')
            ->whereNull('products.deleted_at')
            ->whereIn('product_categories.slug', $slugs)
            ->where(function ($q) {
                $q->whereRaw("LOWER(COALESCE(products.ops_status, 'active')) = 'maintenance'")
                    ->orWhereRaw("UPPER(products.sku_code) LIKE '%MAINTENANCE%'")
                    ->orWhereRaw("LOWER(COALESCE(products.ops_status, 'active')) = 'inactive'")
                    ->orWhere('product_providers.is_active', false)
                    ->orWhereRaw("LOWER(COALESCE(product_providers.partner_status, 'online')) = 'offline'")
                    ->orWhereRaw("LOWER(COALESCE(product_providers.partner_status, 'online')) = 'maintenance'");
            });

        if ($productProviderId) {
            $query->where('products.product_provider_id', $productProviderId);
        }

        $total = (clone $query)->count();

        $rows = $query
            ->orderBy('products.name')
            ->forPage($page, $perPage)
            ->get([
                'products.id',
                'products.sku_code',
                'products.name',
                'products.ops_status',
                'products.product_provider_id',
                'product_providers.name as provider_name',
                'product_providers.is_active as provider_is_active',
                'product_providers.partner_status',
            ])
            ->map(function ($row) {
                $bucket = $this->classifyBucket($row);

                return [
                    'id' => (int) $row->id,
                    'code' => (string) $row->sku_code,
                    'name' => (string) $row->name,
                    'status' => $bucket === 'maintenance' ? 'Maintenance' : 'Offline',
                    'productProvider' => $row->provider_name ?: 'Unknown',
                    'productProviderId' => $row->product_provider_id ? (int) $row->product_provider_id : null,
                    'opsStatus' => strtolower((string) ($row->ops_status ?? 'active')),
                    'partnerStatus' => strtolower((string) ($row->partner_status ?? 'online')),
                ];
            });

        return [
            'service' => $meta['name'],
            'serviceKey' => $serviceKey,
            'data' => $rows->all(),
            'pagination' => [
                'currentPage' => $page,
                'lastPage' => (int) max(1, ceil($total / $perPage)),
                'perPage' => $perPage,
                'total' => $total,
            ],
        ];
    }

    /**
     * Probe live provider health then return fresh overview.
     *
     * @return array<string, mixed>
     */
    public function refreshAndOverview(array $filters = []): array
    {
        $this->refreshProviderHealth();
        $filters['refresh'] = false;

        return $this->overview($filters);
    }

    protected function refreshProviderHealth(): void
    {
        $this->partners->refreshAllHealth();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    protected function buildServiceCards(): Collection
    {
        $checkedAt = now()->timezone('Asia/Jakarta')->format('H:i:s').' WIB';
        $aggregates = $this->loadProviderAggregates();

        return $this->serviceCatalog()->map(function (array $meta) use ($checkedAt, $aggregates) {
            if (($meta['type'] ?? 'catalog') === 'wallet') {
                return $this->walletServiceCard($checkedAt);
            }

            $slugs = $this->mapping->filterSlugs($meta['key']);
            $providerRows = $aggregates
                ->filter(fn (array $r) => in_array($r['category_slug'], $slugs, true))
                ->values();

            // Merge same provider across alias slugs
            $byProvider = $providerRows->groupBy('product_provider_id')->map(function (Collection $group) {
                $first = $group->first();

                return [
                    'product_provider_id' => $first['product_provider_id'],
                    'provider_code' => $first['provider_code'],
                    'provider_name' => $first['provider_name'],
                    'provider_is_active' => $first['provider_is_active'],
                    'partner_status' => $first['partner_status'],
                    'avg_response_ms' => $first['avg_response_ms'],
                    'success_rate' => $first['success_rate'],
                    'last_sync_at' => $first['last_sync_at'],
                    'last_health_check_at' => $first['last_health_check_at'],
                    'total' => (int) $group->sum('total'),
                    'online' => (int) $group->sum('online'),
                    'maintenance' => (int) $group->sum('maintenance'),
                    'offline' => (int) $group->sum('offline'),
                ];
            })->values();

            $counts = $this->sumCounts($byProvider);
            $providers = $this->formatProviderSummaries($byProvider);
            $status = $this->resolveServiceStatus($counts);

            $latencyMs = collect($providers)->pluck('avgResponseMs')->filter(fn ($v) => $v !== null)->avg();
            $successRate = collect($providers)->pluck('successRate')->filter(fn ($v) => $v !== null)->avg();

            return [
                'key' => $meta['key'],
                'id' => $meta['key'],
                'code' => strtoupper($meta['key']),
                'name' => $meta['name'],
                'type' => 'catalog',
                'status' => $status,
                'providers' => collect($providers)->pluck('name')->values()->all(),
                'providerNames' => collect($providers)->pluck('name')->values()->all(),
                'providerCount' => count($providers),
                'totalSku' => $counts['total'],
                'onlineSku' => $counts['online'],
                'maintenanceSku' => $counts['maintenance'],
                'offlineSku' => $counts['offline'],
                'latencyMs' => $latencyMs !== null ? (int) round($latencyMs) : null,
                'latency' => $latencyMs !== null ? ((int) round($latencyMs)).' ms' : null,
                'successRate' => $successRate !== null ? round((float) $successRate, 2) : null,
                'lastCheckAt' => now()->toIso8601String(),
                'lastCheck' => $checkedAt,
                'lastSyncAt' => collect($providers)->pluck('lastSyncAt')->filter()->sortDesc()->first(),
            ];
        })->values();
    }

    /**
     * Canonical NOC services from Product Mapping Layer (+ Wallet).
     *
     * @return Collection<int, array{key:string,name:string,type:string}>
     */
    protected function serviceCatalog(): Collection
    {
        $labels = [
            'pulsa' => 'Pulsa',
            'data' => 'Paket Data',
            'voucher-internet' => 'Voucher Internet',
            'sms-telepon' => 'Paket SMS & Telepon',
            'masa-aktif' => 'Masa Aktif',
            'aktivasi-perdana' => 'Aktivasi Perdana',
            'esim' => 'eSIM',
            'topup-digital' => 'Top Up Digital',
            'game' => 'Top Up Game',
            'voucher-digital' => 'Voucher Digital',
            'langganan-digital' => 'Langganan Digital',
            'pln' => 'Token PLN',
            'pln-pascabayar' => 'PLN Pascabayar',
            'pdam' => 'PDAM',
            'bpjs-kesehatan' => 'BPJS',
            'bpjs-tk' => 'BPJS Ketenagakerjaan',
            'internet-pascabayar' => 'Internet Pascabayar',
            'tv-pascabayar' => 'TV Pascabayar',
            'gas' => 'Gas PGN',
            'multifinance' => 'Multifinance',
            'pbb' => 'PBB',
            'samsat' => 'SAMSAT',
            'transfer' => 'Transfer',
            'international' => 'International Top Up',
        ];

        $skipAliases = ['ewallet', 'voucher', 'tagihan'];

        $items = collect(config('gurky_catalog.categories', []))
            ->keys()
            ->reject(fn ($key) => in_array((string) $key, $skipAliases, true))
            ->map(fn ($key) => [
                'key' => (string) $key,
                'name' => $labels[(string) $key]
                    ?? (string) (config('gurky_catalog.categories.'.$key.'.name') ?: $key),
                'type' => 'catalog',
            ]);

        $items->push([
            'key' => 'wallet',
            'name' => 'Wallet',
            'type' => 'wallet',
        ]);

        return $items->values();
    }

    /**
     * One aggregated query: counts per category slug × product provider.
     *
     * @return Collection<int, array<string, mixed>>
     */
    protected function loadProviderAggregates(): Collection
    {
        $bucket = $this->sqlBucketExpression();

        $rows = DB::table('products')
            ->join('product_categories', 'product_categories.id', '=', 'products.product_category_id')
            ->leftJoin('product_providers', 'product_providers.id', '=', 'products.product_provider_id')
            ->whereNull('products.deleted_at')
            ->groupBy(
                'product_categories.slug',
                'products.product_provider_id',
                'product_providers.code',
                'product_providers.name',
                'product_providers.is_active',
                'product_providers.partner_status',
                'product_providers.avg_response_ms',
                'product_providers.success_rate',
                'product_providers.last_sync_at',
                'product_providers.last_health_check_at'
            )
            ->selectRaw('product_categories.slug as category_slug')
            ->selectRaw('products.product_provider_id as product_provider_id')
            ->selectRaw('product_providers.code as provider_code')
            ->selectRaw('product_providers.name as provider_name')
            ->selectRaw('product_providers.is_active as provider_is_active')
            ->selectRaw('product_providers.partner_status as partner_status')
            ->selectRaw('product_providers.avg_response_ms as avg_response_ms')
            ->selectRaw('product_providers.success_rate as success_rate')
            ->selectRaw('product_providers.last_sync_at as last_sync_at')
            ->selectRaw('product_providers.last_health_check_at as last_health_check_at')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN ({$bucket}) = 'online' THEN 1 ELSE 0 END) as online_count")
            ->selectRaw("SUM(CASE WHEN ({$bucket}) = 'maintenance' THEN 1 ELSE 0 END) as maintenance_count")
            ->selectRaw("SUM(CASE WHEN ({$bucket}) = 'offline' THEN 1 ELSE 0 END) as offline_count")
            ->get();

        return $rows->map(fn ($row) => [
            'category_slug' => (string) $row->category_slug,
            'product_provider_id' => $row->product_provider_id ? (int) $row->product_provider_id : null,
            'provider_code' => $row->provider_code,
            'provider_name' => $row->provider_name ?: 'Unknown',
            'provider_is_active' => (bool) $row->provider_is_active,
            'partner_status' => strtolower((string) ($row->partner_status ?? 'online')),
            'avg_response_ms' => $row->avg_response_ms,
            'success_rate' => $row->success_rate,
            'last_sync_at' => $row->last_sync_at,
            'last_health_check_at' => $row->last_health_check_at,
            'total' => (int) $row->total,
            'online' => (int) $row->online_count,
            'maintenance' => (int) $row->maintenance_count,
            'offline' => (int) $row->offline_count,
        ]);
    }

    /**
     * @param  list<string>  $slugs
     * @return Collection<int, array<string, mixed>>
     */
    protected function aggregateByProviderForSlugs(array $slugs): Collection
    {
        if ($slugs === []) {
            return collect();
        }

        return $this->loadProviderAggregates()
            ->filter(fn (array $r) => in_array($r['category_slug'], $slugs, true))
            ->groupBy('product_provider_id')
            ->map(function (Collection $group) {
                $first = $group->first();

                return [
                    'product_provider_id' => $first['product_provider_id'],
                    'provider_code' => $first['provider_code'],
                    'provider_name' => $first['provider_name'],
                    'provider_is_active' => $first['provider_is_active'],
                    'partner_status' => $first['partner_status'],
                    'avg_response_ms' => $first['avg_response_ms'],
                    'success_rate' => $first['success_rate'],
                    'last_sync_at' => $first['last_sync_at'],
                    'last_health_check_at' => $first['last_health_check_at'],
                    'total' => (int) $group->sum('total'),
                    'online' => (int) $group->sum('online'),
                    'maintenance' => (int) $group->sum('maintenance'),
                    'offline' => (int) $group->sum('offline'),
                ];
            })
            ->values();
    }

    protected function sqlBucketExpression(): string
    {
        return <<<'SQL'
CASE
  WHEN LOWER(COALESCE(products.ops_status, 'active')) = 'maintenance'
    OR UPPER(products.sku_code) LIKE '%MAINTENANCE%' THEN 'maintenance'
  WHEN LOWER(COALESCE(products.ops_status, 'active')) = 'inactive' THEN 'offline'
  WHEN COALESCE(product_providers.is_active, 0) = 0
    OR LOWER(COALESCE(product_providers.partner_status, 'online')) = 'offline' THEN 'offline'
  WHEN LOWER(COALESCE(product_providers.partner_status, 'online')) = 'maintenance' THEN 'maintenance'
  ELSE 'online'
END
SQL;
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $providerRows
     * @return array{total:int,online:int,maintenance:int,offline:int}
     */
    protected function sumCounts(Collection $providerRows): array
    {
        return [
            'total' => (int) $providerRows->sum('total'),
            'online' => (int) $providerRows->sum('online'),
            'maintenance' => (int) $providerRows->sum('maintenance'),
            'offline' => (int) $providerRows->sum('offline'),
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $providerRows
     * @return list<array<string, mixed>>
     */
    protected function formatProviderSummaries(Collection $providerRows): array
    {
        return $providerRows
            ->filter(fn (array $r) => ! empty($r['product_provider_id']))
            ->map(function (array $row) {
                $counts = [
                    'total' => (int) $row['total'],
                    'online' => (int) $row['online'],
                    'maintenance' => (int) $row['maintenance'],
                    'offline' => (int) $row['offline'],
                ];
                $status = $this->resolveProviderStatusFromCounts(
                    $counts,
                    (bool) ($row['provider_is_active'] ?? false),
                    (string) ($row['partner_status'] ?? 'online')
                );

                return [
                    'id' => (int) $row['product_provider_id'],
                    'code' => $row['provider_code'],
                    'name' => $row['provider_name'],
                    'status' => $status,
                    'totalSku' => $counts['total'],
                    'onlineSku' => $counts['online'],
                    'maintenanceSku' => $counts['maintenance'],
                    'offlineSku' => $counts['offline'],
                    'avgResponseMs' => $row['avg_response_ms'] !== null ? (int) $row['avg_response_ms'] : null,
                    'latency' => $row['avg_response_ms'] !== null ? ((int) $row['avg_response_ms']).' ms' : null,
                    'successRate' => $row['success_rate'] !== null ? (float) $row['success_rate'] : null,
                    'lastSyncAt' => $row['last_sync_at']
                        ? Carbon::parse($row['last_sync_at'])->timezone('Asia/Jakarta')->format('H:i').' WIB'
                        : null,
                    'lastCheckAt' => $row['last_health_check_at']
                        ? Carbon::parse($row['last_health_check_at'])->timezone('Asia/Jakarta')->format('H:i:s').' WIB'
                        : null,
                ];
            })
            ->sortBy('name')
            ->values()
            ->all();
    }

    protected function classifyBucket(object $row): string
    {
        $ops = strtolower((string) ($row->ops_status ?? 'active'));
        $sku = strtoupper((string) $row->sku_code);
        $partner = strtolower((string) ($row->partner_status ?? 'online'));
        $providerActive = (bool) $row->provider_is_active;

        if ($ops === 'maintenance' || str_contains($sku, 'MAINTENANCE')) {
            return 'maintenance';
        }
        if ($ops === 'inactive') {
            return 'offline';
        }
        if (! $providerActive || $partner === 'offline') {
            return 'offline';
        }
        if ($partner === 'maintenance') {
            return 'maintenance';
        }

        return 'online';
    }

    /**
     * @param  array{total:int,online:int,maintenance:int,offline:int}  $counts
     */
    protected function resolveServiceStatus(array $counts): string
    {
        if ($counts['total'] === 0) {
            return 'Offline';
        }

        if ($counts['online'] === 0 && $counts['maintenance'] === 0) {
            return 'Offline';
        }

        if ($counts['online'] === 0 && $counts['maintenance'] > 0) {
            return 'Maintenance';
        }

        if ($counts['maintenance'] > 0 || $counts['offline'] > 0) {
            return 'Partial';
        }

        return 'Online';
    }

    protected function resolveProviderStatusFromCounts(array $counts, bool $isActive, string $partnerStatus): string
    {
        if (! $isActive || $partnerStatus === 'offline') {
            return 'Offline';
        }
        if ($partnerStatus === 'maintenance') {
            return 'Maintenance';
        }
        if ($counts['total'] === 0) {
            return 'Offline';
        }
        if ($counts['online'] === 0 && $counts['maintenance'] > 0) {
            return 'Maintenance';
        }
        if ($counts['maintenance'] > 0 || $counts['offline'] > 0) {
            return 'Partial';
        }

        return 'Online';
    }

    /**
     * @return array<string, mixed>
     */
    protected function walletServiceCard(string $checkedAt): array
    {
        $configured = trim((string) (config('services.midtrans.server_key') ?: env('MIDTRANS_SERVER_KEY', ''))) !== ''
            && trim((string) (config('services.midtrans.client_key') ?: env('MIDTRANS_CLIENT_KEY', ''))) !== '';
        $stored = strtolower((string) (Setting::where('key', 'partner_midtrans_status')->value('value') ?? ''));
        if (! in_array($stored, ['online', 'maintenance', 'offline'], true)) {
            $stored = $configured ? 'online' : 'offline';
        }

        $status = match (true) {
            $stored === 'maintenance' => 'Maintenance',
            $stored === 'offline' || ! $configured => 'Offline',
            default => 'Online',
        };

        return [
            'key' => 'wallet',
            'id' => 'wallet',
            'code' => 'WALLET',
            'name' => 'Wallet',
            'type' => 'wallet',
            'status' => $status,
            'providers' => ['Midtrans'],
            'providerNames' => ['Midtrans'],
            'providerCount' => 1,
            'totalSku' => 0,
            'onlineSku' => 0,
            'maintenanceSku' => 0,
            'offlineSku' => 0,
            'latencyMs' => null,
            'latency' => null,
            'successRate' => null,
            'lastCheckAt' => now()->toIso8601String(),
            'lastCheck' => $checkedAt,
            'lastSyncAt' => null,
            'notes' => $configured ? null : 'Midtrans belum dikonfigurasi.',
        ];
    }

    protected function normalizeStatusFilter(mixed $status): ?string
    {
        if ($status === null || $status === '' || strcasecmp((string) $status, 'All') === 0) {
            return null;
        }

        $s = strtolower(trim((string) $status));

        return match ($s) {
            'online' => 'online',
            'partial', 'degraded' => 'partial',
            'maintenance' => 'maintenance',
            'offline' => 'offline',
            default => $s,
        };
    }
}
