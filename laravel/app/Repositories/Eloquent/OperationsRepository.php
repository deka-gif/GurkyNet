<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\OperationsRepositoryInterface;
use App\Models\Product;
use App\Models\Provider;
use App\Models\Setting;
use App\Models\ActivityLog;
use App\Models\DigiflazzProduct;
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
        $maintenanceProducts = Product::query()
            ->where(function ($q) {
                $q->where('ops_status', 'maintenance')
                    ->orWhere('sku_code', 'like', '%MAINTENANCE%');
            })
            ->count();
        $inactiveProducts = Product::query()
            ->where(function ($q) {
                $q->where('ops_status', 'inactive')
                    ->orWhere(function ($legacy) {
                        $legacy->where(function ($ops) {
                            $ops->whereNull('ops_status')->orWhere('ops_status', 'active');
                        })->where('status', false)
                            ->where('sku_code', 'not like', '%MAINTENANCE%');
                    });
            })
            ->count();
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
     * Digiflazz status from GurkyNet DB snapshot (Sprint 8.5 — no live provider call on dashboard).
     */
    protected function getLiveDigiflazzProviderStatus(): array
    {
        $integration = app(\App\Services\Integration\IntegrationService::class);
        $row = $integration->balanceFromDatabase(\App\Models\ProductProvider::CODE_DIGIFLAZZ);
        $balance = $row['balance'] ?? null;
        $st = strtolower((string) ($row['partner_status'] ?? ''));

        if ($row === null) {
            return [
                'name' => 'Digiflazz',
                'configured' => false,
                'status' => 'Not Synced',
                'balance' => null,
                'balance_formatted' => null,
                'source' => 'database',
            ];
        }

        $offline = in_array($st, ['offline', 'down', 'error'], true);

        return [
            'name' => 'Digiflazz',
            'configured' => true,
            'status' => $offline ? 'Offline' : ($balance !== null ? 'Online' : 'Pending Sync'),
            'balance' => $balance,
            'balance_formatted' => $balance !== null
                ? 'Rp '.number_format($balance, 0, ',', '.')
                : null,
            'source' => 'database',
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    /**
     * Get paginated products list with filters.
     * Product Provider filtering uses products.product_provider_id only.
     * Payment gateway names must never match Digiflazz products by accident.
     * Category uses GurkyNet slug families (same as user dashboard Product Mapping).
     */
    public function getProducts(array $filters): LengthAwarePaginator
    {
        $perPage = (int) ($filters['per_page'] ?? 25);
        if ($perPage < 1) {
            $perPage = 25;
        }
        if ($perPage > 100) {
            $perPage = 100;
        }

        $query = Product::query()->with([
            'category',
            'provider',
            'productProvider',
            'providerSkus.productProvider',
        ]);

        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('products.name', 'like', "%{$search}%")
                    ->orWhere('products.sku_code', 'like', "%{$search}%")
                    ->orWhereHas('provider', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('productProvider', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%");
                    });
            });
        }

        if (!empty($filters['product_category_id'])) {
            $query->where('product_category_id', (int) $filters['product_category_id']);
        } elseif (!empty($filters['category'])) {
            $category = (string) $filters['category'];
            if ($category !== '' && strtolower($category) !== 'all') {
                $slugs = \App\Services\ProductProviders\LogicalProductKey::categoryFilterSlugs($category);
                $query->whereHas('category', function ($q) use ($slugs) {
                    $q->whereIn('slug', $slugs);
                });
            }
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

        if (array_key_exists('status', $filters) && $filters['status'] !== null && $filters['status'] !== '') {
            $this->applyProductStatusFilter($query, $filters['status']);
        }

        // Phase 20 — surface products ProductMappingService couldn't confidently classify
        // (no brand override / provider category / name-keyword match, silently defaulted).
        if (!empty($filters['unmapped'])) {
            $query->where('category_mapping_source', 'unmapped_fallback');
        }

        $this->applyProductSort($query, (string) ($filters['sort'] ?? 'newest'));

        return $query->paginate($perPage);
    }

    /**
     * Public wrapper for PricingHierarchyService (same status semantics as Product Management).
     */
    public function applyProductStatusFilterPublic($query, mixed $status): void
    {
        $this->applyProductStatusFilter($query, $status);
    }

    /**
     * Public wrapper for PricingHierarchyService summary cards.
     *
     * @return array{total_products:int,average_margin:float,active_sku_count:int}
     */
    public function pricingSummaryMetricsPublic(): array
    {
        return $this->pricingSummaryMetrics();
    }

    /**
     * Public wrapper for PricingHierarchyService SKU rows.
     *
     * @return array<string, mixed>
     */
    public function mapPricingProductRowPublic(Product $product): array
    {
        return $this->mapPricingProductRow($product);
    }

    /**
     * Status filter aligned with AvailabilityService (active / inactive / maintenance).
     * Prefers products.ops_status; falls back to legacy MAINTENANCE sku_code / boolean status.
     */
    protected function applyProductStatusFilter($query, mixed $status): void
    {
        $normalized = is_bool($status)
            ? ($status ? 'active' : 'inactive')
            : strtolower(trim((string) $status));

        $normalized = match ($normalized) {
            '1', 'true', 'tersedia', 'active' => 'active',
            '0', 'false', 'nonaktif', 'inactive', 'gangguan' => 'inactive',
            'maintenance' => 'maintenance',
            default => $normalized,
        };

        if ($normalized === 'maintenance') {
            $query->where(function ($q) {
                $q->where('products.ops_status', 'maintenance')
                    ->orWhere('products.sku_code', 'like', '%MAINTENANCE%');
            });

            return;
        }

        if ($normalized === 'active') {
            $query->where('products.sku_code', 'not like', '%MAINTENANCE%')
                ->where(function ($q) {
                    $q->where('products.ops_status', 'active')
                        ->orWhere(function ($legacy) {
                            $legacy->whereNull('products.ops_status')
                                ->where('products.status', true);
                        });
                });

            return;
        }

        if ($normalized === 'inactive') {
            $query->where(function ($q) {
                $q->where('products.ops_status', 'inactive')
                    ->orWhere(function ($legacy) {
                        $legacy->where(function ($ops) {
                            $ops->whereNull('products.ops_status')
                                ->orWhere('products.ops_status', 'active');
                        })->where('products.status', false)
                            ->where('products.sku_code', 'not like', '%MAINTENANCE%');
                    });
            });
        }
    }

    protected function applyProductSort($query, string $sort): void
    {
        match ($sort) {
            'oldest' => $query->orderBy('products.id'),
            'name_asc' => $query->orderBy('products.name')->orderBy('products.id'),
            'name_desc' => $query->orderByDesc('products.name')->orderByDesc('products.id'),
            'price_asc' => $query->orderBy('products.sell_price')->orderBy('products.id'),
            'price_desc' => $query->orderByDesc('products.sell_price')->orderByDesc('products.id'),
            default => $query->orderByDesc('products.id'),
        };
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
     * Status changes write products.ops_status so User Dashboard catalog reacts immediately.
     * Selling price is authoritative for Dashboard User (PricingService reads products.sell_price).
     */
    public function updateProduct(string|int $id, array $data): Product
    {
        $product = Product::findOrFail($id);

        if (isset($data['name']) && is_string($data['name']) && trim($data['name']) !== '') {
            $product->name = trim($data['name']);
        }

        // Pricing Engine: base_price is supplier-owned unless explicitly allowed (Product Management sync).
        if (isset($data['base_price']) && empty($data['lock_base_price'])) {
            $product->base_price = (float) $data['base_price'];
        }

        if (isset($data['admin_fee'])) {
            $product->admin_fee = (float) $data['admin_fee'];
        }

        $touchesPrice = array_key_exists('margin', $data) || array_key_exists('sell_price', $data);
        if ($touchesPrice && (float) $product->base_price <= 0) {
            throw new \InvalidArgumentException('Base Price kosong. Sinkron ulang produk dari Product Mapping / provider.');
        }

        if (isset($data['margin']) && ! isset($data['sell_price'])) {
            $margin = (float) $data['margin'];
            if ($margin < 0) {
                throw new \InvalidArgumentException('Margin tidak boleh negatif.');
            }
            $product->sell_price = (float) $product->base_price + $margin + (float) $product->admin_fee;
        } elseif (isset($data['sell_price'])) {
            $sellPrice = (float) $data['sell_price'];
            if ($sellPrice < (float) $product->base_price) {
                throw new \InvalidArgumentException('Selling Price tidak boleh lebih kecil dari Base Price.');
            }
            $product->sell_price = $sellPrice;
        }

        if (array_key_exists('status', $data) && $data['status'] !== null && $data['status'] !== '') {
            $opsStatus = $this->normalizeOpsStatus($data['status']);
            $product->ops_status = $opsStatus;
            $product->status = $opsStatus !== 'inactive';
        }

        $product->save();

        \App\Services\ProductProviders\ProductCatalogCache::bump();

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'UPDATE_PRODUCT_OPERATIONS',
            'payload' => [
                'product_id' => $product->id,
                'sku_code' => $product->sku_code,
                'ops_status' => $product->ops_status,
                'updated_fields' => $data,
                'admin_notes' => $data['admin_notes'] ?? null,
            ],
        ]);

        return $product->fresh(['category', 'provider', 'productProvider', 'providerSkus.productProvider']);
    }

    /**
     * @return 'active'|'inactive'|'maintenance'
     */
    protected function normalizeOpsStatus(mixed $status): string
    {
        if (is_bool($status)) {
            return $status ? 'active' : 'inactive';
        }

        $normalized = strtolower(trim((string) $status));

        return match ($normalized) {
            '1', 'true', 'tersedia', 'active' => 'active',
            '0', 'false', 'nonaktif', 'inactive', 'gangguan' => 'inactive',
            'maintenance' => 'maintenance',
            default => filter_var($status, FILTER_VALIDATE_BOOLEAN) ? 'active' : 'inactive',
        };
    }

    /**
     * Get paginated integration partners (Digiflazz / VIP / Midtrans).
     * Operator brands (Telkomsel, …) are not listed here — Product Mapping owns those.
     */
    public function getProviders(array $filters): LengthAwarePaginator
    {
        return app(\App\Services\ProductProviders\ProviderPartnerService::class)->list($filters);
    }

    /**
     * Update partner status (Online / Maintenance / Offline) for product providers or Midtrans.
     *
     * @return array<string, mixed>
     */
    public function updateProvider(string|int $id, array $data): array
    {
        return app(\App\Services\ProductProviders\ProviderPartnerService::class)->update($id, $data);
    }

    /**
     * @return array<int, mixed>
     */
    public function refreshProviderStatuses(): array
    {
        $result = app(\App\Services\Integration\IntegrationService::class)->probeHealth(true);

        return is_array($result['results'] ?? null) ? $result['results'] : [];
    }

    /**
     * Network Operations Center — service-level health (not SKU dumps).
     */
    public function getMonitoring(array $filters = []): array
    {
        return app(\App\Services\Monitoring\ServiceMonitoringService::class)->overview($filters);
    }

    /**
     * Pricing & Margin Engine — hierarchical catalog (Category → Brand → Group → SKU).
     * Same Product Mapping Layer as Product Management; no separate pricing table.
     */
    public function getPricing(array $filters = []): array
    {
        return app(\App\Services\Pricing\PricingHierarchyService::class)->browse($filters);
    }

    /**
     * Update SKU pricing (sell_price / margin / ops_status) or global margin rules.
     * Product updates write the same products row Product Management & Dashboard User read.
     */
    public function updatePricing(array $data): array
    {
        $productId = $data['product_id'] ?? $data['id'] ?? null;

        if ($productId !== null && $productId !== '') {
            $payload = [];

            if (array_key_exists('margin', $data) && $data['margin'] !== null && $data['margin'] !== '') {
                $payload['margin'] = (float) $data['margin'];
            }

            // Prefer explicit selling price; map FE aliases.
            $sell = $data['sell_price'] ?? $data['selling_price'] ?? $data['sellingPrice'] ?? null;
            if ($sell !== null && $sell !== '') {
                $payload['sell_price'] = (float) $sell;
                unset($payload['margin']);
            }

            if (array_key_exists('status', $data) && $data['status'] !== null && $data['status'] !== '') {
                $payload['status'] = $data['status'];
            }

            if (array_key_exists('admin_notes', $data)) {
                $payload['admin_notes'] = $data['admin_notes'];
            }

            // Base price is supplier-owned in Pricing Engine.
            $payload['lock_base_price'] = true;

            $product = $this->updateProduct($productId, $payload);

            ActivityLog::create([
                'user_id' => Auth::id(),
                'activity' => 'UPDATE_PRICING_PRODUCT_OPERATIONS',
                'payload' => [
                    'product_id' => $product->id,
                    'sku_code' => $product->sku_code,
                    'sell_price' => $product->sell_price,
                    'ops_status' => $product->ops_status,
                    'updated_fields' => $payload,
                ],
            ]);

            return [
                'product' => $this->mapPricingProductRow($product),
                'margin_rules' => [
                    'default_margin' => (float) (Setting::where('key', 'default_margin')->value('value') ?? 1500),
                    'category_margin' => json_decode(Setting::where('key', 'category_margins')->value('value') ?? '[]', true) ?: [],
                    'provider_margin' => json_decode(Setting::where('key', 'provider_margins')->value('value') ?? '[]', true) ?: [],
                ],
                'summary' => $this->pricingSummaryMetrics(),
            ];
        }

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

    /**
     * @return array{total_products:int,average_margin:float,active_sku_count:int}
     */
    protected function pricingSummaryMetrics(): array
    {
        $defaultMargin = $this->pricingService->defaultMargin();

        $total = (int) Product::query()->count();

        $activeQuery = Product::query();
        $this->applyProductStatusFilter($activeQuery, 'active');
        $active = (int) $activeQuery->count();

        $avg = Product::query()
            ->selectRaw(
                'AVG(CASE WHEN sell_price > 0 THEN (sell_price - base_price - COALESCE(admin_fee, 0)) ELSE ? END) as avg_margin',
                [$defaultMargin]
            )
            ->value('avg_margin');

        return [
            'total_products' => $total,
            'average_margin' => round((float) ($avg ?? 0), 2),
            'active_sku_count' => $active,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function mapPricingProductRow(Product $product): array
    {
        $pricing = $this->pricingService->calculateForProduct($product);
        $opsStatus = $this->normalizeOpsStatus(
            $product->ops_status
                ?? ($product->status ? 'active' : 'inactive')
        );
        if (str_contains(strtoupper((string) $product->sku_code), 'MAINTENANCE')) {
            $opsStatus = 'maintenance';
        }

        return [
            'id' => $product->id,
            'code' => $product->sku_code,
            'sku_code' => $product->sku_code,
            'name' => $product->name,
            'category' => $product->category?->name,
            'categorySlug' => $product->category?->slug,
            'operator' => $product->provider?->name,
            'operatorName' => $product->provider?->name,
            // Legacy key: some UIs used provider for operator brand.
            'provider' => $product->productProvider?->name ?? $product->provider?->name,
            'productProvider' => $product->productProvider?->name,
            'productProviderCode' => $product->productProvider?->code,
            'productProviderId' => $product->product_provider_id,
            'provider_cost' => $pricing['provider_cost'],
            'base_price' => $pricing['base_price'],
            'basePrice' => $pricing['base_price'],
            'margin' => $pricing['margin'],
            'admin_fee' => $pricing['admin_fee'],
            'adminFee' => $pricing['admin_fee'],
            'selling_price' => $pricing['selling_price'],
            'sellingPrice' => $pricing['selling_price'],
            'sell_price' => $pricing['sell_price'],
            'status' => $opsStatus,
            'opsStatus' => $opsStatus,
            'availabilityStatus' => $opsStatus,
        ];
    }
}
