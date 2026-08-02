<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\OperationsRepositoryInterface;
use App\Models\Product;
use App\Models\Provider;
use App\Models\Setting;
use App\Models\ActivityLog;
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
