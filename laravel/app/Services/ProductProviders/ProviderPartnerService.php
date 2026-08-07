<?php

namespace App\Services\ProductProviders;

use App\Models\ActivityLog;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Setting;
use App\Services\Catalog\ProductMappingService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;

/**
 * Provider Management Control Center — Digiflazz / VIP / Midtrans partners.
 * Reuses ProductProvider health + Control Center; payment gateways stay out of product_providers.
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

        if (!empty($filters['search'])) {
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
        $productProviders = ProductProvider::query()
            ->orderBy('priority')
            ->orderBy('sort_order')
            ->get()
            ->map(fn (ProductProvider $p) => $this->toProductProviderCard($p));

        $gateways = $this->paymentGatewayCards();

        return $productProviders->concat($gateways)->values();
    }

    /**
     * Refresh live health for all product providers + Midtrans config probe.
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

        $this->probeMidtransStatus();

        return $updated;
    }

    /**
     * Update partner status / notes. Accepts product_provider id or payment code (midtrans).
     *
     * @return array<string, mixed>
     */
    public function update(string|int $id, array $data): array
    {
        if ($this->isPaymentGatewayId($id)) {
            return $this->updatePaymentGateway((string) $id, $data);
        }

        $provider = ProductProvider::findOrFail((int) $id);

        if (isset($data['name']) && is_string($data['name']) && trim($data['name']) !== '') {
            $provider->name = trim($data['name']);
        }

        if (array_key_exists('status', $data) || array_key_exists('partner_status', $data) || array_key_exists('is_active', $data)) {
            $raw = $data['partner_status'] ?? $data['status'] ?? ($data['is_active'] ?? null);
            $partnerStatus = $this->normalizePartnerStatusWrite($raw);

            if ($partnerStatus === 'maintenance') {
                $this->control->enable($provider->fresh() ?? $provider);
                $provider = $provider->fresh() ?? $provider;
                $provider->partner_status = 'maintenance';
                $provider->is_active = true;
                $provider->save();
            } elseif ($partnerStatus === 'offline') {
                $this->control->disable($provider->fresh() ?? $provider);
                $provider = $provider->fresh() ?? $provider;
                $provider->partner_status = 'offline';
                $provider->is_active = false;
                $provider->save();
            } else {
                $this->control->enable($provider->fresh() ?? $provider);
                $provider = $provider->fresh() ?? $provider;
                $provider->partner_status = 'online';
                $provider->is_active = true;
                $provider->save();
            }

            ProductCatalogCache::bump();
        }

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'UPDATE_PROVIDER_PARTNER_OPERATIONS',
            'payload' => [
                'product_provider_id' => $provider->id,
                'code' => $provider->code,
                'partner_status' => $provider->partner_status,
                'notes' => $data['notes'] ?? null,
                'updated_fields' => $data,
            ],
        ]);

        return $this->toProductProviderCard($provider->fresh() ?? $provider);
    }

    public function toProductProviderCard(ProductProvider $p): array
    {
        $controlCard = $this->control->toCard($p);
        $services = $this->supportedServicesFor($p->id);
        $partnerStatus = $this->resolveDisplayStatus($p);

        return [
            'id' => $p->id,
            'code' => $p->code,
            'name' => $p->name,
            'type' => 'product_provider',
            'status' => $partnerStatus,
            'partnerStatus' => strtolower((string) ($p->partner_status ?? 'online')),
            'enabled' => (bool) $p->is_active,
            'apiStatus' => $controlCard['apiStatus'] ?? $p->api_status,
            'apiStatusLabel' => $controlCard['apiStatusLabel'] ?? null,
            'healthColor' => $controlCard['healthColor'] ?? $p->health_color,
            'responseTime' => $p->avg_response_ms !== null ? $p->avg_response_ms.'ms' : null,
            'avgResponseTime' => $p->avg_response_ms !== null ? $p->avg_response_ms.'ms' : null,
            'avgResponseMs' => $p->avg_response_ms,
            'lastSync' => optional($p->last_sync_at)?->toIso8601String(),
            'last_sync' => optional($p->last_sync_at)?->toIso8601String(),
            'lastSyncAt' => optional($p->last_sync_at)?->toIso8601String(),
            'productCount' => (int) ($p->product_count ?? 0),
            'balance' => $p->balance !== null ? (float) $p->balance : null,
            'priority' => (int) $p->priority,
            'supportedServices' => $services['labels'],
            'supportedServiceCodes' => $services['codes'],
            'description' => sprintf(
                '%s · %d produk · API %s',
                $partnerStatus,
                (int) ($p->product_count ?? 0),
                (string) ($controlCard['apiStatusLabel'] ?? $p->api_status ?? 'unknown')
            ),
            'notes' => $p->last_error,
            'lastHealthCheckAt' => optional($p->last_health_check_at)?->toIso8601String(),
        ];
    }

    /**
     * Display status for Provider Management filters (Online|Maintenance|Offline).
     */
    public function resolveDisplayStatus(ProductProvider $p): string
    {
        if (!$p->is_active) {
            return 'Offline';
        }

        $partner = strtolower((string) ($p->partner_status ?? 'online'));
        if ($partner === 'maintenance') {
            return 'Maintenance';
        }

        $api = strtolower((string) ($p->api_status ?? 'unknown'));
        if (in_array($api, ['offline', 'not_configured', 'auth_failed', 'no_response', 'timeout'], true)) {
            return 'Offline';
        }

        return 'Online';
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

    /**
     * @return Collection<int, array<string, mixed>>
     */
    protected function paymentGatewayCards(): Collection
    {
        $cards = collect();
        foreach ((array) config('ppob.payment_gateways', []) as $code => $meta) {
            // Only surface Midtrans in Provider Management (actively integrated).
            if (strtolower((string) $code) !== 'midtrans') {
                continue;
            }
            $cards->push($this->midtransCard());
        }

        return $cards;
    }

    protected function midtransCard(): array
    {
        $configured = $this->midtransConfigured();
        $stored = strtolower((string) (Setting::where('key', 'partner_midtrans_status')->value('value') ?? ''));
        if (!in_array($stored, ['online', 'maintenance', 'offline'], true)) {
            $stored = $configured ? 'online' : 'offline';
        }

        $status = match ($stored) {
            'maintenance' => 'Maintenance',
            'offline' => 'Offline',
            default => $configured ? 'Online' : 'Offline',
        };
        if ($stored === 'online' && !$configured) {
            $status = 'Offline';
        }

        return [
            'id' => 'midtrans',
            'code' => 'midtrans',
            'name' => (string) (config('ppob.payment_gateways.midtrans.name') ?: 'Midtrans'),
            'type' => 'payment_gateway',
            'status' => $status,
            'partnerStatus' => $stored,
            'enabled' => $stored !== 'offline' && $configured,
            'apiStatus' => $configured ? 'online' : 'not_configured',
            'apiStatusLabel' => $configured ? 'Configured' : 'Not Configured',
            'healthColor' => $status === 'Online' ? 'green' : ($status === 'Maintenance' ? 'yellow' : 'red'),
            'responseTime' => null,
            'avgResponseTime' => null,
            'avgResponseMs' => null,
            'lastSync' => null,
            'last_sync' => null,
            'lastSyncAt' => null,
            'productCount' => 0,
            'balance' => null,
            'priority' => 900,
            'supportedServices' => ['Top Up Saldo', 'Payment Gateway'],
            'supportedServiceCodes' => ['wallet-topup', 'payment-gateway'],
            'description' => 'Payment gateway Midtrans untuk top up saldo GurkyPay.',
            'notes' => $configured ? null : 'MIDTRANS_SERVER_KEY / CLIENT_KEY belum dikonfigurasi.',
            'lastHealthCheckAt' => now()->toIso8601String(),
        ];
    }

    protected function midtransConfigured(): bool
    {
        $server = (string) (config('services.midtrans.server_key') ?: env('MIDTRANS_SERVER_KEY', ''));
        $client = (string) (config('services.midtrans.client_key') ?: env('MIDTRANS_CLIENT_KEY', ''));

        return trim($server) !== '' && trim($client) !== '';
    }

    protected function probeMidtransStatus(): void
    {
        // Persist probe outcome only when operator has not forced maintenance/offline.
        $stored = strtolower((string) (Setting::where('key', 'partner_midtrans_status')->value('value') ?? ''));
        if (in_array($stored, ['maintenance', 'offline'], true)) {
            return;
        }

        Setting::updateOrCreate(
            ['key' => 'partner_midtrans_status'],
            ['value' => $this->midtransConfigured() ? 'online' : 'offline']
        );
    }

    /**
     * @return array<string, mixed>
     */
    protected function updatePaymentGateway(string $id, array $data): array
    {
        $code = strtolower(str_replace(['pg-', 'payment-'], '', $id));
        if ($code !== 'midtrans') {
            abort(404, 'Payment gateway tidak ditemukan.');
        }

        if (array_key_exists('status', $data) || array_key_exists('partner_status', $data)) {
            $partnerStatus = $this->normalizePartnerStatusWrite($data['partner_status'] ?? $data['status']);
            Setting::updateOrCreate(
                ['key' => 'partner_midtrans_status'],
                ['value' => $partnerStatus]
            );
        }

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'UPDATE_PAYMENT_GATEWAY_PARTNER',
            'payload' => [
                'code' => 'midtrans',
                'notes' => $data['notes'] ?? null,
                'updated_fields' => $data,
            ],
        ]);

        return $this->midtransCard();
    }

    protected function isPaymentGatewayId(string|int $id): bool
    {
        $normalized = strtolower((string) $id);

        return in_array($normalized, ['midtrans', 'pg-midtrans', 'payment-midtrans'], true)
            || !ctype_digit((string) $id) && isset(config('ppob.payment_gateways')[$normalized]);
    }

    protected function normalizePartnerStatusFilter(mixed $status): ?string
    {
        if ($status === null || $status === '' || strcasecmp((string) $status, 'All') === 0) {
            return null;
        }

        $s = strtolower(trim((string) $status));

        return match ($s) {
            'online', 'active', 'on' => 'online',
            'maintenance' => 'maintenance',
            'offline', 'inactive', 'off', 'disabled' => 'offline',
            'degraded' => 'online', // degraded API still counts as Online partner when powered on
            default => $s,
        };
    }

    /**
     * @return 'online'|'maintenance'|'offline'
     */
    protected function normalizePartnerStatusWrite(mixed $status): string
    {
        if (is_bool($status)) {
            return $status ? 'online' : 'offline';
        }

        $s = strtolower(trim((string) $status));

        return match ($s) {
            '1', 'true', 'online', 'active', 'on', 'tersedia' => 'online',
            'maintenance' => 'maintenance',
            '0', 'false', 'offline', 'inactive', 'off', 'disabled', 'gangguan' => 'offline',
            default => filter_var($status, FILTER_VALIDATE_BOOLEAN) ? 'online' : 'offline',
        };
    }
}
