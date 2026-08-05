<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\OperationsRepositoryInterface;
use App\Models\Product;
use App\Models\Provider;
use App\Models\Setting;
use App\Models\ActivityLog;
use App\Models\DigiflazzTransaction;
use App\Models\DigiflazzProduct;
use App\Models\MidtransTransaction;
use App\Services\PricingService;
use App\Services\AvailabilityService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;

class OperationsRepository implements OperationsRepositoryInterface
{
    public function __construct(
        protected PricingService $pricingService,
        protected AvailabilityService $availabilityService
    ) {}

    /**
     * Get dashboard operational metrics and health overview.
     */
    public function getDashboardMetrics(): array
    {
        $totalProducts = Product::count();
        $inactiveProducts = Product::where('status', false)->count();
        $maintenanceProducts = Product::where('status', true)->where('sku_code', 'like', '%MAINTENANCE%')->count();
        $activeProducts = max(0, $totalProducts - $inactiveProducts - $maintenanceProducts);

        $providers = Provider::withCount('products')->select('id', 'name', 'logo', 'is_active', 'updated_at')->get();
        $totalProviders = $providers->count();
        $activeProviders = $providers->where('is_active', true)->count();
        $inactiveProviders = $providers->where('is_active', false)->count();

        $recentOperationLogs = ActivityLog::with('user:id,name,email')
            ->where(function ($q) {
                $q->where('activity', 'like', '%OPERATIONS%')
                    ->orWhere('activity', 'like', '%PRODUCT%')
                    ->orWhere('activity', 'like', '%PROVIDER%')
                    ->orWhere('activity', 'like', '%PRICING%')
                    ->orWhere('activity', 'like', '%DIGIFLAZZ%');
            })
            ->latest()
            ->take(10)
            ->get();

        $sync = $this->getDigiflazzSyncStatus();
        $digiflazzLive = $this->getLiveDigiflazzProviderStatus();

        $providerStatus = $providers->map(function (Provider $provider) use ($sync) {
            return [
                'id' => $provider->id,
                'name' => $provider->name,
                'logo' => $provider->logo,
                'is_active' => $provider->is_active,
                'status' => $provider->is_active ? 'active' : 'inactive',
                'products_count' => $provider->products_count,
                'last_sync' => $sync['last_sync_at'],
                'lastSync' => $sync['last_sync_at'],
                'updated_at' => optional($provider->updated_at)?->toIso8601String(),
            ];
        });

        $stats = [
            'totalActiveProducts' => $activeProducts,
            'total_products' => $totalProducts,
            'activeProviders' => $activeProviders,
            'total_providers' => $totalProviders,
            'productsUnderMaintenance' => $maintenanceProducts,
            'maintenance_products' => $maintenanceProducts,
            'providerIssues' => $inactiveProviders,
            'provider_issues' => $inactiveProviders,
            'liveProductCount' => $totalProducts,
            'syncStatus' => $sync['status'],
            'failedSync' => $sync['failed_count'],
            'lastSync' => $sync['last_sync_at'],
        ];

        return [
            'product_summary' => [
                'product_count' => $totalProducts,
                'active_products' => $activeProducts,
                'inactive_products' => $inactiveProducts,
                'maintenance_products' => $maintenanceProducts,
            ],
            'provider_health' => [
                'total_providers' => $totalProviders,
                'active_providers' => $activeProviders,
                'inactive_providers' => $inactiveProviders,
                'health_status' => $inactiveProviders === 0 ? 'HEALTHY' : ($activeProviders > 0 ? 'DEGRADED' : 'CRITICAL'),
                'digiflazz_status' => $digiflazzLive['status'],
                'digiflazz_balance' => $digiflazzLive['balance'],
            ],
            'provider_status' => $providerStatus,
            'providers' => $providerStatus,
            'digiflazz_sync' => $sync,
            'digiflazz_provider' => $digiflazzLive,
            'stats' => $stats,
            'summary' => $stats,
            'recent_operation_logs' => $recentOperationLogs,
            'logs' => $recentOperationLogs,
        ];
    }

    /**
     * Read Digiflazz sync metadata persisted by SyncDigiflazzCatalogAction.
     */
    public function getDigiflazzSyncStatus(): array
    {
        $settings = Setting::whereIn('key', [
            'digiflazz_last_sync_at',
            'digiflazz_last_sync_status',
            'digiflazz_last_sync_count',
            'digiflazz_last_sync_failed',
            'digiflazz_last_sync_message',
            'digiflazz_failed_sync_total',
        ])->pluck('value', 'key');

        return [
            'last_sync_at' => $settings['digiflazz_last_sync_at'] ?? null,
            'status' => $settings['digiflazz_last_sync_status'] ?? 'never',
            'synced_count' => (int) ($settings['digiflazz_last_sync_count'] ?? 0),
            'failed_count' => (int) ($settings['digiflazz_last_sync_failed'] ?? 0),
            'failed_sync_total' => (int) ($settings['digiflazz_failed_sync_total'] ?? 0),
            'message' => $settings['digiflazz_last_sync_message'] ?? null,
            'live_product_count' => Product::count(),
            'digiflazz_product_count' => DigiflazzProduct::count(),
        ];
    }

    /**
     * Live Digiflazz connectivity + deposit balance for Operations / Owner.
     */
    protected function getLiveDigiflazzProviderStatus(): array
    {
        $service = app(\App\Services\DigiflazzService::class);

        if (!$service->isConfigured()) {
            return [
                'name' => 'Digiflazz',
                'configured' => false,
                'status' => 'Not Configured',
                'balance' => null,
            ];
        }

        $balance = \Illuminate\Support\Facades\Cache::remember(
            'digiflazz_balance',
            60,
            fn () => $service->checkBalance()
        );

        return [
            'name' => 'Digiflazz',
            'configured' => true,
            'status' => $balance !== null ? 'Online' : 'Unreachable',
            'balance' => $balance,
            'balance_formatted' => $balance !== null
                ? 'Rp ' . number_format($balance, 0, ',', '.')
                : null,
        ];
    }

    /**
     * Get paginated products list with filters.
     * Product Provider filtering uses products.product_provider_id only.
     * Payment gateway names must never match Digiflazz products by accident.
     */
    public function getProducts(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = Product::with(['category', 'provider', 'productProvider']);

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku_code', 'like', "%{$search}%");
            });
        }

        if (!empty($filters['product_category_id'])) {
            $query->where('product_category_id', $filters['product_category_id']);
        }

        if (!empty($filters['provider_id'])) {
            // Operator brand (Telkomsel, PLN, …) — not Product Provider.
            $query->where('provider_id', $filters['provider_id']);
        }

        // Resolve Product Provider filter (id preferred, then code, then legacy "provider" label).
        $productProviderId = $this->resolveProductProviderFilterId($filters);
        if ($productProviderId === 0) {
            // Explicit empty: payment gateway selected, or unknown provider label.
            $query->whereRaw('1 = 0');
        } elseif ($productProviderId !== null) {
            $query->where('product_provider_id', $productProviderId);
        }

        if (isset($filters['status'])) {
            if ($filters['status'] === 'maintenance') {
                $query->where('status', true)->where('sku_code', 'like', '%MAINTENANCE%');
            } elseif ($filters['status'] === 'active' || $filters['status'] === '1' || $filters['status'] === true) {
                $query->where('status', true)->where('sku_code', 'not like', '%MAINTENANCE%');
            } elseif ($filters['status'] === 'inactive' || $filters['status'] === '0' || $filters['status'] === false) {
                $query->where('status', false);
            }
        }

        return $query->latest()->paginate($perPage);
    }

    /**
     * Product Management dropdown source — ONLY product_providers.
     * Never merges config payment_gateways.
     *
     * @return \Illuminate\Support\Collection<int, object{id:int,name:string,code:string}>
     */
    public function getProductProviders(): \Illuminate\Support\Collection
    {
        $paymentCodes = array_keys((array) config('ppob.payment_gateways', []));

        return \App\Models\ProductProvider::query()
            ->when($paymentCodes !== [], fn ($q) => $q->whereNotIn('code', $paymentCodes))
            ->orderBy('priority')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'priority', 'is_active', 'sort_order']);
    }

    /**
     * @return int|null Product provider id to filter; 0 = force empty; null = no filter
     */
    protected function resolveProductProviderFilterId(array $filters): ?int
    {
        if (!empty($filters['product_provider_id'])) {
            $id = (int) $filters['product_provider_id'];
            $exists = \App\Models\ProductProvider::query()
                ->where('id', $id)
                ->whereNotIn('code', array_keys((array) config('ppob.payment_gateways', [])))
                ->exists();

            return $exists ? $id : 0;
        }

        if (!empty($filters['product_provider_code'])) {
            $code = strtolower((string) $filters['product_provider_code']);
            if ($this->isPaymentGatewayCodeOrName($code)) {
                return 0;
            }
            $id = \App\Models\ProductProvider::query()->where('code', $code)->value('id');

            return $id ? (int) $id : 0;
        }

        // Legacy UI sent `provider=Midtrans|Xendit|…` — never treat those as catalog filters.
        if (!empty($filters['provider']) && empty($filters['provider_id'])) {
            $label = trim((string) $filters['provider']);
            if ($label === '' || strcasecmp($label, 'All') === 0) {
                return null;
            }
            if ($this->isPaymentGatewayCodeOrName($label)) {
                return 0;
            }
            $id = \App\Models\ProductProvider::query()
                ->where(function ($q) use ($label) {
                    $q->where('code', strtolower($label))
                        ->orWhere('name', $label);
                })
                ->value('id');

            return $id ? (int) $id : 0;
        }

        return null;
    }

    protected function isPaymentGatewayCodeOrName(string $value): bool
    {
        $normalized = strtolower(trim($value));
        foreach ((array) config('ppob.payment_gateways', []) as $code => $meta) {
            if ($normalized === strtolower((string) $code)) {
                return true;
            }
            $name = strtolower((string) ($meta['name'] ?? ''));
            if ($name !== '' && $normalized === $name) {
                return true;
            }
        }

        return in_array($normalized, ['midtrans', 'xendit', 'alterra', 'artajasa'], true);
    }

    /**
     * Update product details (sell price, margin, status, admin notes).
     */
    public function updateProduct(string|int $id, array $data): Product
    {
        $product = Product::findOrFail($id);

        if (isset($data['margin']) && !isset($data['sell_price'])) {
            $margin = (float) $data['margin'];
            $product->sell_price = (float) $product->base_price + $margin + (float) $product->admin_fee;
        } elseif (isset($data['sell_price'])) {
            $product->sell_price = (float) $data['sell_price'];
        }

        if (isset($data['status'])) {
            $product->status = filter_var($data['status'], FILTER_VALIDATE_BOOLEAN);
        }

        $product->save();

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'UPDATE_PRODUCT_OPERATIONS',
            'payload' => [
                'product_id' => $product->id,
                'sku_code' => $product->sku_code,
                'updated_fields' => $data,
                'admin_notes' => $data['admin_notes'] ?? null,
            ],
        ]);

        return $product->fresh(['category', 'provider']);
    }

    /**
     * Get paginated providers list with filters.
     */
    public function getProviders(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = Provider::withCount('products');

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where('name', 'like', "%{$search}%");
        }

        if (isset($filters['status'])) {
            $isActive = filter_var($filters['status'], FILTER_VALIDATE_BOOLEAN);
            $query->where('is_active', $isActive);
        }

        $paginator = $query->latest()->paginate($perPage);
        $sync = $this->getDigiflazzSyncStatus();

        $paginator->getCollection()->transform(function (Provider $provider) use ($sync) {
            $provider->setAttribute('last_sync', $sync['last_sync_at']);
            $provider->setAttribute('lastSync', $sync['last_sync_at']);
            $provider->setAttribute('sync_status', $sync['status']);
            $provider->setAttribute('status', $provider->is_active ? 'active' : 'inactive');
            return $provider;
        });

        return $paginator;
    }

    /**
     * Update provider details (status, maintenance flag, notes).
     */
    public function updateProvider(string|int $id, array $data): Provider
    {
        $provider = Provider::findOrFail($id);

        if (isset($data['status'])) {
            $provider->is_active = filter_var($data['status'], FILTER_VALIDATE_BOOLEAN);
        } elseif (isset($data['is_active'])) {
            $provider->is_active = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }

        $provider->save();

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'UPDATE_PROVIDER_OPERATIONS',
            'payload' => [
                'provider_id' => $provider->id,
                'provider_name' => $provider->name,
                'maintenance_flag' => $data['maintenance_flag'] ?? false,
                'notes' => $data['notes'] ?? null,
                'updated_fields' => $data,
            ],
        ]);

        return $provider->fresh();
    }

    /**
     * Get service monitoring data for Operations dashboard.
     */
    public function getMonitoring(array $filters = []): array
    {
        // Real average fulfillment time per provider, computed from Digiflazz
        // transaction records of the last 7 days (created -> last status update).
        $recentFulfillments = DigiflazzTransaction::whereIn('digiflazz_status', ['success', 'sukses'])
            ->where('created_at', '>=', now()->subDays(7))
            ->whereColumn('updated_at', '>', 'created_at')
            ->get(['buyer_sku_code', 'created_at', 'updated_at']);

        $skuToProvider = Product::whereNotNull('provider_id')->pluck('provider_id', 'sku_code');

        $providerDurations = [];
        foreach ($recentFulfillments as $fulfillment) {
            $providerId = $skuToProvider[$fulfillment->buyer_sku_code] ?? null;
            if ($providerId === null) {
                continue;
            }
            $providerDurations[$providerId][] = $fulfillment->updated_at->diffInSeconds($fulfillment->created_at, true);
        }

        $providerResponseTimes = [];
        foreach ($providerDurations as $providerId => $durations) {
            $providerResponseTimes[$providerId] = round(array_sum($durations) / count($durations), 1) . 's';
        }

        $providersQuery = Provider::withCount([
            'products as total_products',
            'products as active_products' => fn ($query) => $query->where('status', true)->where('sku_code', 'not like', '%MAINTENANCE%'),
            'products as inactive_products' => fn ($query) => $query->where('status', false),
            'products as maintenance_products' => fn ($query) => $query->where('status', true)->where('sku_code', 'like', '%MAINTENANCE%'),
        ]);

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $providersQuery->where('name', 'like', "%{$search}%");
        }

        $services = $providersQuery
            ->orderBy('name')
            ->get()
            ->map(function (Provider $provider) use ($providerResponseTimes) {
                $status = match (true) {
                    ! $provider->is_active => 'Offline',
                    $provider->maintenance_products > 0 => 'Maintenance',
                    $provider->inactive_products > 0 => 'Degraded',
                    default => 'Online',
                };

                $uptime = $provider->total_products > 0
                    ? round(($provider->active_products / $provider->total_products) * 100, 2) . '%'
                    : '0%';

                return [
                    'id' => $provider->id,
                    'code' => 'PRV-' . $provider->id,
                    'name' => $provider->name,
                    'provider' => $provider->name,
                    'category' => 'PPOB Provider',
                    'status' => $status,
                    'response_time' => $providerResponseTimes[$provider->id] ?? null,
                    'responseTime' => $providerResponseTimes[$provider->id] ?? null,
                    'uptime' => $uptime,
                    'last_updated' => optional($provider->updated_at)->toISOString(),
                    'lastUpdated' => optional($provider->updated_at)->toISOString(),
                    'description' => sprintf(
                        '%d active products, %d inactive products, %d products under maintenance.',
                        $provider->active_products,
                        $provider->inactive_products,
                        $provider->maintenance_products
                    ),
                    'metrics' => [
                        'total_products' => $provider->total_products,
                        'active_products' => $provider->active_products,
                        'inactive_products' => $provider->inactive_products,
                        'maintenance_products' => $provider->maintenance_products,
                    ],
                ];
            })
            ->filter(function (array $service) use ($filters) {
                if (empty($filters['status'])) {
                    return true;
                }

                return strtolower($service['status']) === strtolower((string) $filters['status']);
            })
            ->values();

        $maintenance = Product::with('provider:id,name')
            ->where('status', true)
            ->where('sku_code', 'like', '%MAINTENANCE%')
            ->latest('updated_at')
            ->take(20)
            ->get()
            ->map(fn (Product $product) => [
                'id' => 'MNT-' . $product->id,
                'service' => $product->name,
                'service_name' => $product->name,
                'provider' => $product->provider?->name ?? '-',
                'start_time' => optional($product->updated_at)->toISOString(),
                'startTime' => optional($product->updated_at)->toISOString(),
                'end_time' => null,
                'endTime' => null,
                'status' => 'In Progress',
                'description' => 'Product SKU is marked as maintenance in Operations.',
            ]);

        $digiflazzIncidents = DigiflazzTransaction::query()
            ->whereNotIn('digiflazz_status', ['success', 'sukses', 'pending', 'processing'])
            ->latest()
            ->take(10)
            ->get()
            ->map(fn (DigiflazzTransaction $transaction) => [
                'id' => 'DGF-' . $transaction->id,
                'service' => 'Digiflazz',
                'time' => optional($transaction->created_at)->toISOString(),
                'timestamp' => optional($transaction->created_at)->toISOString(),
                'status' => $transaction->digiflazz_status,
                'currentStatus' => $transaction->digiflazz_status,
                'incident' => 'Digiflazz transaction returned status: ' . $transaction->digiflazz_status,
                'message' => 'Ref ID: ' . $transaction->ref_id . ', SKU: ' . $transaction->buyer_sku_code,
            ]);

        $midtransIncidents = MidtransTransaction::query()
            ->whereNotIn('transaction_status', ['settlement', 'capture', 'pending'])
            ->latest()
            ->take(10)
            ->get()
            ->map(fn (MidtransTransaction $transaction) => [
                'id' => 'MID-' . $transaction->id,
                'service' => 'Midtrans',
                'time' => optional($transaction->created_at)->toISOString(),
                'timestamp' => optional($transaction->created_at)->toISOString(),
                'status' => $transaction->transaction_status,
                'currentStatus' => $transaction->transaction_status,
                'incident' => 'Midtrans transaction returned status: ' . $transaction->transaction_status,
                'message' => 'Order ID: ' . $transaction->order_id,
            ]);

        $incidents = $digiflazzIncidents
            ->concat($midtransIncidents)
            ->sortByDesc('timestamp')
            ->values()
            ->take(20);

        return [
            'summary' => [
                'online_services' => $services->where('status', 'Online')->count(),
                'maintenance_services' => $services->where('status', 'Maintenance')->count(),
                'degraded_services' => $services->where('status', 'Degraded')->count(),
                'offline_services' => $services->where('status', 'Offline')->count(),
                'total_services' => $services->count(),
            ],
            'services' => $services,
            'maintenance' => $maintenance,
            'schedules' => $maintenance,
            'incidents' => $incidents,
            'logs' => $incidents,
        ];
    }

    /**
     * Get pricing margin rules configuration (+ master products for Pricing UI).
     * Optional filters use products.product_provider_id (never payment gateways).
     */
    public function getPricing(array $filters = []): array
    {
        $defaultMargin = Setting::where('key', 'default_margin')->value('value') ?? '1500';
        $categoryMargins = json_decode(Setting::where('key', 'category_margins')->value('value') ?? '[]', true);
        $providerMargins = json_decode(Setting::where('key', 'provider_margins')->value('value') ?? '[]', true);

        $query = Product::with(['category:id,name,slug', 'provider:id,name', 'productProvider:id,name,code']);

        $productProviderId = $this->resolveProductProviderFilterId($filters);
        if ($productProviderId === 0) {
            $query->whereRaw('1 = 0');
        } elseif ($productProviderId !== null) {
            $query->where('product_provider_id', $productProviderId);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku_code', 'like', "%{$search}%");
            });
        }

        $masterProducts = $query
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(function (Product $product) {
                $pricing = $this->pricingService->calculateForProduct($product);
                return [
                    'id' => $product->id,
                    'sku_code' => $product->sku_code,
                    'name' => $product->name,
                    'category' => $product->category?->name,
                    'provider' => $product->provider?->name,
                    'productProvider' => $product->productProvider?->name,
                    'productProviderCode' => $product->productProvider?->code,
                    'productProviderId' => $product->product_provider_id,
                    'provider_cost' => $pricing['provider_cost'],
                    'base_price' => $pricing['base_price'],
                    'margin' => $pricing['margin'],
                    'admin_fee' => $pricing['admin_fee'],
                    'selling_price' => $pricing['selling_price'],
                    'sell_price' => $pricing['sell_price'],
                    'status' => $product->status,
                ];
            })
            ->values()
            ->all();

        return [
            'margin_rules' => [
                'default_margin' => (float) $defaultMargin,
                'category_margin' => $categoryMargins ?: [],
                'provider_margin' => $providerMargins ?: [],
            ],
            'products' => $masterProducts,
            'master_products' => $masterProducts,
        ];
    }

    /**
     * Update pricing margin rules configuration.
     */
    public function updatePricing(array $data): array
    {
        if (isset($data['default_margin'])) {
            Setting::updateOrCreate(
                ['key' => 'default_margin'],
                ['value' => (string) $data['default_margin']]
            );
        }

        if (isset($data['category_margin'])) {
            Setting::updateOrCreate(
                ['key' => 'category_margins'],
                ['value' => json_encode($data['category_margin'])]
            );
        }

        if (isset($data['provider_margin'])) {
            Setting::updateOrCreate(
                ['key' => 'provider_margins'],
                ['value' => json_encode($data['provider_margin'])]
            );
        }

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'UPDATE_PRICING_RULES_OPERATIONS',
            'payload' => $data,
        ]);

        return $this->getPricing();
    }
}
