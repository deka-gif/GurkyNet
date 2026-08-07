<?php

namespace App\Services\ProductProviders;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Services\Catalog\ProductMappingService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Provider Management — monitoring dashboard for Product Providers only.
 * Configuration (ON/OFF, priority, sync) lives in ProductProviderControlService.
 * Payment gateways live in PaymentGatewayControlService.
 */
class ProviderPartnerService
{
    public function __construct(
        protected ProductProviderControlService $control,
        protected ProductProviderHealthService $health,
        protected ProductMappingService $mapping,
    ) {}

    /**
     * Paginated partner cards with backend filters.
     *
     * @param  array{status?:string,supported_service?:string,service?:string,search?:string,page?:int,per_page?:int,sort?:string,refresh?:bool}  $filters
     */
    public function list(array $filters = []): LengthAwarePaginator
    {
        $refresh = filter_var($filters['refresh'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($refresh) {
            $this->refreshAllHealth();
        }

        $rows = $this->collectPartners();

        $status = $this->normalizePartnerStatusFilter($filters['status'] ?? null);
        if ($status !== null) {
            $rows = $rows->filter(fn (array $row) => strtolower((string) $row['status']) === $status)->values();
        }

        $service = $filters['supported_service'] ?? $filters['service'] ?? null;
        if (is_string($service) && trim($service) !== '' && strcasecmp($service, 'All') !== 0) {
            $slugs = $this->mapping->filterSlugs($service);
            $rows = $rows->filter(function (array $row) use ($slugs, $service) {
                $codes = array_map('strtolower', $row['supportedServiceCodes'] ?? []);
                $labels = array_map('strtolower', $row['supportedServices'] ?? []);
                $needle = strtolower(trim($service));
                foreach ($slugs as $slug) {
                    if (in_array(strtolower($slug), $codes, true)) {
                        return true;
                    }
                }

                return in_array($needle, $codes, true) || in_array($needle, $labels, true);
            })->values();
        }

        if (! empty($filters['search'])) {
            $q = strtolower(trim((string) $filters['search']));
            $rows = $rows->filter(function (array $row) use ($q) {
                $hay = strtolower(implode(' ', [
                    $row['name'] ?? '',
                    $row['code'] ?? '',
                    $row['type'] ?? '',
                    implode(' ', $row['supportedServices'] ?? []),
                    implode(' ', $row['supportedServiceCodes'] ?? []),
                ]));

                return str_contains($hay, $q);
            })->values();
        }

        $sort = strtolower((string) ($filters['sort'] ?? 'priority'));
        $rows = match ($sort) {
            'name_asc' => $rows->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values(),
            'name_desc' => $rows->sortByDesc('name', SORT_NATURAL | SORT_FLAG_CASE)->values(),
            'status' => $rows->sortBy('status')->values(),
            'newest' => $rows->sortByDesc('id')->values(),
            default => $rows->sortBy([['priority', 'asc'], ['name', 'asc']])->values(),
        };

        $perPage = max(1, min(100, (int) ($filters['per_page'] ?? 25)));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $total = $rows->count();
        $slice = $rows->forPage($page, $perPage)->values();

        return new Paginator($slice->all(), $total, $perPage, $page, [
            'path' => request()->url(),
            'query' => request()->query(),
        ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function collectPartners(): Collection
    {
        return ProductProvider::query()
            ->orderBy('priority')
            ->orderBy('sort_order')
            ->get()
            ->map(fn (ProductProvider $p) => $this->toProductProviderCard($p))
            ->values();
    }

    /**
     * Refresh live health for product providers only (monitoring).
     */
    public function refreshAllHealth(): array
    {
        $updated = [];
        foreach (ProductProvider::query()->orderBy('priority')->get() as $provider) {
            try {
                $this->health->refreshStats($provider);
                $fresh = $this->health->check($provider->fresh() ?? $provider);
                $updated[] = $this->toProductProviderCard($fresh);
            } catch (\Throwable $e) {
                $updated[] = [
                    'code' => $provider->code,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $updated;
    }

    /**
     * Configuration writes are not allowed from Provider Management.
     *
     * @return array<string, mixed>
     */
    public function update(string|int $id, array $data): array
    {
        if ($this->isPaymentGatewayId($id)) {
            throw ValidationException::withMessages([
                'id' => ['Konfigurasi Payment Gateway dilakukan di Payment Gateway Control Center.'],
            ]);
        }

        throw ValidationException::withMessages([
            'id' => ['Konfigurasi Product Provider dilakukan di Product Provider Control Center (ON/OFF, Priority, Sync, Health Check).'],
        ]);
    }

    public function toProductProviderCard(ProductProvider $p): array
    {
        $controlCard = $this->control->toCard($p);
        $services = $this->supportedServicesFor($p->id);
        $displayStatus = $this->resolveDisplayStatus($p);
        $productCount = (int) ($controlCard['productCount'] ?? $p->product_count ?? 0);
        $statusDescription = (string) ($controlCard['statusDescription'] ?? ProviderHealthStatus::descriptionFor($p));

        return [
            'id' => $p->id,
            'code' => $p->code,
            'name' => $p->name,
            'type' => 'product_provider',
            'status' => $displayStatus,
            'partnerStatus' => strtolower((string) ($p->partner_status ?? 'online')),
            'enabled' => (bool) $p->is_active,
            'apiStatus' => $controlCard['apiStatus'] ?? $p->api_status,
            'apiStatusLabel' => $controlCard['apiStatusLabel'] ?? ProviderHealthStatus::labelFor($p->api_status),
            'healthColor' => $controlCard['healthColor'] ?? $p->health_color,
            'statusDescription' => $statusDescription,
            'healthLabel' => $this->resolveHealthLabel($p, $displayStatus),
            'healthIndicators' => $controlCard['healthIndicators'] ?? null,
            'providerCode' => $controlCard['providerCode'] ?? null,
            'providerMessage' => $controlCard['providerMessage'] ?? null,
            'probeLatencyMs' => $controlCard['probeLatencyMs'] ?? null,
            'responseTime' => $p->avg_response_ms !== null ? $p->avg_response_ms.'ms' : null,
            'avgResponseTime' => $p->avg_response_ms !== null ? $p->avg_response_ms.'ms' : null,
            'avgResponseMs' => $p->avg_response_ms,
            'lastSync' => $controlCard['lastSyncDisplay'] ?? optional($p->last_sync_at)?->format('d/m/Y H:i'),
            'last_sync' => optional($p->last_sync_at)?->toIso8601String(),
            'lastSyncAt' => optional($p->last_sync_at)?->toIso8601String(),
            'lastSyncDisplay' => $controlCard['lastSyncDisplay'] ?? null,
            'productCount' => $productCount,
            'productCountLabel' => $productCount.' SKU',
            'balance' => $p->balance !== null ? (float) $p->balance : null,
            'priority' => (int) $p->priority,
            'supportedServices' => $services['labels'],
            'supportedServiceCodes' => $services['codes'],
            'description' => $statusDescription,
            'notes' => $p->last_error ?: $statusDescription,
            'lastHealthCheckAt' => optional($p->last_health_check_at)?->toIso8601String(),
            'transactionEligible' => (bool) ($controlCard['transactionEligible'] ?? false),
            'readOnly' => true,
            'configHint' => 'Konfigurasi hanya di Product Provider Control Center.',
        ];
    }

    /**
     * Operator-facing health status (Online|Gangguan Sebagian|Maintenance|Offline|Autentikasi Gagal).
     */
    public function resolveDisplayStatus(ProductProvider $p): string
    {
        $partner = strtolower((string) ($p->partner_status ?? 'online'));
        if ($partner === 'maintenance') {
            return 'Maintenance';
        }

        if (! $p->is_active || $partner === 'offline') {
            return 'Disabled';
        }

        $api = strtolower((string) ($p->api_status ?? 'unknown'));

        return match ($api) {
            'online' => 'Online',
            'partial', 'degraded', 'syncing' => 'Gangguan Sebagian',
            'maintenance' => 'Maintenance',
            'auth_failed' => 'Autentikasi Gagal',
            'config_error' => 'Config Error',
            'network_configuration' => 'Network Configuration',
            'not_configured' => 'Belum Dikonfigurasi',
            'disabled' => 'Disabled',
            'offline', 'timeout', 'no_response' => 'Offline',
            default => ProviderHealthStatus::labelFor($api),
        };
    }

    /**
     * Short monitoring health label (Bahasa Indonesia).
     */
    public function resolveHealthLabel(ProductProvider $p, ?string $displayStatus = null): string
    {
        $status = $displayStatus ?? $this->resolveDisplayStatus($p);

        return match ($status) {
            'Online' => 'Sehat',
            'Gangguan Sebagian' => 'Perlu Perhatian',
            'Maintenance' => 'Maintenance',
            'Autentikasi Gagal', 'Belum Dikonfigurasi', 'Disabled' => 'Tidak Aktif',
            default => 'Tidak Aktif',
        };
    }

    /**
     * @return array{labels: list<string>, codes: list<string>}
     */
    protected function supportedServicesFor(int $productProviderId): array
    {
        $categoryIds = Product::query()
            ->where(function ($q) use ($productProviderId) {
                $q->where('product_provider_id', $productProviderId)
                    ->orWhereHas('providerSkus', function ($sku) use ($productProviderId) {
                        $sku->where('product_provider_id', $productProviderId)
                            ->where('is_active', true);
                    });
            })
            ->distinct()
            ->pluck('product_category_id')
            ->filter()
            ->all();

        if ($categoryIds === []) {
            return ['labels' => [], 'codes' => []];
        }

        $categories = ProductCategory::query()
            ->whereIn('id', $categoryIds)
            ->get(['slug', 'name']);

        $codes = [];
        $labels = [];
        foreach ($categories as $cat) {
            $family = $this->mapping->canonicalizeSlug((string) $cat->slug);
            $codes[] = $family;
            $labels[] = (string) (config('gurky_catalog.categories.'.$family.'.name') ?: $cat->name ?: $family);
        }

        $codes = array_values(array_unique($codes));
        $labels = array_values(array_unique($labels));

        return ['labels' => $labels, 'codes' => $codes];
    }

    protected function isPaymentGatewayId(string|int $id): bool
    {
        $normalized = strtolower((string) $id);

        return in_array($normalized, ['midtrans', 'pg-midtrans', 'payment-midtrans'], true)
            || (! ctype_digit((string) $id) && isset(config('ppob.payment_gateways')[$normalized]));
    }

    protected function normalizePartnerStatusFilter(mixed $status): ?string
    {
        if ($status === null || $status === '' || strcasecmp((string) $status, 'All') === 0) {
            return null;
        }

        $s = strtolower(trim((string) $status));

        return match ($s) {
            'online', 'active', 'on' => 'online',
            'partial', 'degraded', 'syncing', 'gangguan sebagian', 'gangguan_sebagian' => 'gangguan sebagian',
            'maintenance' => 'maintenance',
            'auth_failed', 'autentikasi gagal', 'autentikasi_gagal' => 'autentikasi gagal',
            'not_configured', 'belum dikonfigurasi', 'belum_dikonfigurasi' => 'belum dikonfigurasi',
            'disabled' => 'disabled',
            'offline', 'inactive', 'off', 'disabled_legacy', 'timeout' => 'offline',
            default => $s,
        };
    }
}
