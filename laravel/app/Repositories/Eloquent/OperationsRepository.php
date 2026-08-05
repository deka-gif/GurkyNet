<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\OperationsRepositoryInterface;
use App\Models\Product;
use App\Models\Provider;
use App\Models\Setting;
use App\Models\ActivityLog;
use App\Models\DigiflazzTransaction;
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

        $providers = Provider::select('id', 'name', 'logo', 'is_active')->get();
        $totalProviders = $providers->count();
        $activeProviders = $providers->where('is_active', true)->count();
        $inactiveProviders = $providers->where('is_active', false)->count();

        $recentOperationLogs = ActivityLog::with('user:id,name,email')
            ->where('activity', 'like', '%OPERATIONS%')
            ->orWhere('activity', 'like', '%PRODUCT%')
            ->orWhere('activity', 'like', '%PROVIDER%')
            ->orWhere('activity', 'like', '%PRICING%')
            ->latest()
            ->take(10)
            ->get();

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
            ],
            'provider_status' => $providers,
            'recent_operation_logs' => $recentOperationLogs,
        ];
    }

    /**
     * Get paginated products list with filters.
     */
    public function getProducts(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = Product::with(['category', 'provider']);

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
            $query->where('provider_id', $filters['provider_id']);
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

        return $query->latest()->paginate($perPage);
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
            ->map(function (Provider $provider) {
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
                    'response_time' => '-',
                    'responseTime' => '-',
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
     * Get pricing margin rules configuration.
     */
    public function getPricing(): array
    {
        $defaultMargin = Setting::where('key', 'default_margin')->value('value') ?? '1500';
        $categoryMargins = json_decode(Setting::where('key', 'category_margins')->value('value') ?? '[]', true);
        $providerMargins = json_decode(Setting::where('key', 'provider_margins')->value('value') ?? '[]', true);

        return [
            'margin_rules' => [
                'default_margin' => (float) $defaultMargin,
                'category_margin' => $categoryMargins ?: [
                    ['category' => 'Pulsa', 'margin' => 1500],
                    ['category' => 'Data', 'margin' => 2000],
                    ['category' => 'PLN', 'margin' => 2500],
                ],
                'provider_margin' => $providerMargins ?: [
                    ['provider' => 'Telkomsel', 'margin' => 1500],
                    ['provider' => 'Indosat', 'margin' => 1200],
                    ['provider' => 'XL', 'margin' => 1300],
                ],
            ],
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
