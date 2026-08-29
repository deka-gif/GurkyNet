<?php

namespace App\Repositories\Eloquent;

use App\Models\Provider;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\DigiflazzProduct;
use App\Models\Setting;
use App\Repositories\Contracts\ProviderRepositoryInterface;
use App\Services\Catalog\VoucherInternetZoneLabelResolver;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

class ProviderRepository implements ProviderRepositoryInterface
{
    public function allActive(): Collection
    {
        return Provider::where('is_active', true)->orderBy('name', 'asc')->get();
    }

    public function findById(int $id): ?Provider
    {
        return Provider::find($id);
    }

    public function findByName(string $name): ?Provider
    {
        return Provider::where('name', $name)->first();
    }

    /**
     * Upsert Digiflazz catalog rows into digiflazz_products and the master products table.
     * Master `products` remains the single source of truth for Website / Ops / Checkout / Finance.
     *
     * @param  array<int, array<string, mixed>>  $digiflazzProducts
     * @param  array<string, list<string>>  $seenSkusByListType
     */
    public function syncWithDigiflazz(array $digiflazzProducts, array $seenSkusByListType = []): array
    {
        $defaultMargin = (float) (Setting::where('key', 'default_margin')->value('value') ?? 1500);
        $categoryMargins = collect(json_decode(Setting::where('key', 'category_margins')->value('value') ?? '[]', true) ?: [])
            ->keyBy(fn ($row) => Str::lower((string) ($row['category'] ?? '')));
        $providerMargins = collect(json_decode(Setting::where('key', 'provider_margins')->value('value') ?? '[]', true) ?: [])
            ->keyBy(fn ($row) => Str::lower((string) ($row['provider'] ?? '')));

        $digiflazzProvider = ProductProvider::digiflazz();
        if (! $digiflazzProvider) {
            $digiflazzProvider = ProductProvider::query()->updateOrCreate(
                ['code' => ProductProvider::CODE_DIGIFLAZZ],
                [
                    'name' => 'Digiflazz',
                    'is_active' => true,
                    'priority' => 1,
                    'api_status' => 'unknown',
                    'partner_status' => 'online',
                ]
            );
        }

        $inserted = 0;
        $updated = 0;
        $skipped = 0;
        $disabled = 0;

        foreach ($digiflazzProducts as $dp) {
            $sku = $dp['buyer_sku_code'] ?? null;
            if (!$sku) {
                $skipped++;
                continue;
            }

            $basePrice = (float) ($dp['seller_price'] ?? $dp['price'] ?? 0);
            $buyerStatus = (bool) ($dp['buyer_product_status'] ?? true);
            $sellerStatus = (bool) ($dp['seller_product_status'] ?? true);
            $isActive = $buyerStatus && $sellerStatus;

            // 1. Sync DigiflazzProduct mirror (supplier cache) — keep all official Digiflazz fields
            DigiflazzProduct::updateOrCreate(
                ['buyer_sku_code' => $sku],
                [
                    'list_type' => $dp['list_type'] ?? null,
                    'product_name' => $dp['product_name'],
                    'category' => $dp['category'],
                    'brand' => $dp['brand'],
                    'type' => $dp['type'] ?? null,
                    'seller_name' => $dp['seller_name'] ?? null,
                    'seller_price' => $basePrice,
                    'admin' => $this->nullableInt($dp['admin'] ?? null),
                    'commission' => $this->nullableInt($dp['commission'] ?? null),
                    'buyer_product_status' => $buyerStatus,
                    'seller_product_status' => $sellerStatus,
                    'unlimited_stock' => (bool) ($dp['unlimited_stock'] ?? true),
                    'stock' => isset($dp['stock']) ? (string) $dp['stock'] : null,
                    'multi' => array_key_exists('multi', $dp) ? (bool) $dp['multi'] : null,
                    'start_cut_off' => $dp['start_cut_off'] ?? null,
                    'end_cut_off' => $dp['end_cut_off'] ?? null,
                    'desc' => $dp['desc'] ?? null,
                ]
            );

            // 2. Map Digiflazz category/brand → GurkyNet IA category (never store raw Digi trees for UI)
            $mapped = app(\App\Services\Catalog\ProductMappingService::class)->map(
                'digiflazz',
                (string) ($dp['category'] ?? 'Umum'),
                (string) ($dp['brand'] ?? ''),
                (string) ($dp['product_name'] ?? '')
            );
            $category = ProductCategory::updateOrCreate(
                ['slug' => $mapped['slug']],
                [
                    'name' => $mapped['name'],
                    'icon' => 'box',
                ]
            );

            $zoneResolver = app(VoucherInternetZoneLabelResolver::class);
            $zoneLabel = $zoneResolver->appliesToCategorySlug($mapped['slug'])
                ? $zoneResolver->fromDigiflazzType($dp['type'] ?? null, (string) ($dp['product_name'] ?? ''))
                : null;

            // 3. Map & Sync Provider (brand)
            $provider = Provider::updateOrCreate(
                ['name' => $dp['brand']],
                [
                    'logo' => Str::slug($dp['brand']) . '.png',
                    'is_active' => true,
                ]
            );

            // 4. Map & Sync master Product — preserve existing margin when updating cost
            $existing = Product::withTrashed()->where('sku_code', $sku)->first();
            $wasNew = false;

            if ($existing) {
                if ($existing->trashed()) {
                    $existing->restore();
                    $wasNew = true; // restored counts as insert for ops visibility
                }

                $adminFee = (float) $existing->admin_fee;
                $previousMargin = (float) $existing->sell_price - (float) $existing->base_price - $adminFee;
                if ($previousMargin < 0) {
                    $previousMargin = $this->resolveMargin(
                        $defaultMargin,
                        $categoryMargins,
                        $providerMargins,
                        $dp['category'] ?? '',
                        $dp['brand'] ?? ''
                    );
                }

                $existing->fill([
                    'product_category_id' => $category->id,
                    'category_mapping_source' => $mapped['source'],
                    'provider_id' => $provider->id,
                    'product_provider_id' => $digiflazzProvider->id,
                    'name' => $dp['product_name'],
                    'zone_label' => $zoneLabel,
                    'base_price' => $basePrice,
                    'sell_price' => $basePrice + $previousMargin + $adminFee,
                    'status' => $isActive,
                ]);
                $existing->save();
                if ($wasNew) {
                    $inserted++;
                } else {
                    $updated++;
                }
            } else {
                $margin = $this->resolveMargin(
                    $defaultMargin,
                    $categoryMargins,
                    $providerMargins,
                    $dp['category'] ?? '',
                    $dp['brand'] ?? ''
                );

                Product::create([
                    'product_category_id' => $category->id,
                    'category_mapping_source' => $mapped['source'],
                    'provider_id' => $provider->id,
                    'product_provider_id' => $digiflazzProvider->id,
                    'sku_code' => $sku,
                    'name' => $dp['product_name'],
                    'zone_label' => $zoneLabel,
                    'base_price' => $basePrice,
                    'sell_price' => $basePrice + $margin,
                    'admin_fee' => 0.00,
                    'status' => $isActive,
                ]);
                $inserted++;
            }

            // 5. Upsert Digiflazz SKU offer mapping (internal SKU → provider SKU)
            $master = Product::withTrashed()->where('sku_code', $sku)->first();
            if ($master) {
                ProductProviderSku::updateOrCreate(
                    [
                        'product_id' => $master->id,
                        'product_provider_id' => $digiflazzProvider->id,
                    ],
                    [
                        'provider_sku' => $sku,
                        'base_price' => $basePrice,
                        'is_preferred' => true,
                        'is_active' => $isActive,
                    ]
                );
            }
        }

        $disabled = $this->deactivateMissingDigiflazzSkus($seenSkusByListType, $digiflazzProvider);

        // Ops parity: product_count / database audit use ACTIVE Digiflazz SKUs only.
        $dbSkuRows = ProductProviderSku::where('product_provider_id', $digiflazzProvider->id)->count();
        $dbSkuActive = ProductProviderSku::where('product_provider_id', $digiflazzProvider->id)
            ->where('is_active', true)
            ->count();
        $providerActive = 0;
        foreach ($digiflazzProducts as $dp) {
            if (($dp['buyer_product_status'] ?? false) && ($dp['seller_product_status'] ?? false)) {
                $providerActive++;
            }
        }

        $digiflazzProvider->forceFill([
            'last_sync_at' => now(),
            'product_count' => $dbSkuActive,
        ])->save();

        return [
            'inserted' => $inserted,
            'updated' => $updated,
            'skipped' => $skipped,
            'disabled' => $disabled,
            'provider_sku_total' => $providerActive,
            'provider_sku_raw_total' => count($digiflazzProducts),
            'database_sku_total' => $dbSkuActive,
            'database_sku_rows_total' => $dbSkuRows,
            'difference' => $providerActive - $dbSkuActive,
        ];
    }

    /**
     * Soft-deactivate Digiflazz SKUs missing from a successful price-list response.
     * Never deletes rows — transaction history stays intact.
     *
     * Also cleans legacy rows with NULL/empty list_type and stale ProductProviderSku
     * that are not present in the authoritative seen set for fetched cmds.
     *
     * @param  array<string, list<string>>  $seenSkusByListType
     */
    protected function deactivateMissingDigiflazzSkus(array $seenSkusByListType, ?ProductProvider $digiflazzProvider): int
    {
        $disabled = 0;
        if ($seenSkusByListType === []) {
            return 0;
        }

        $allSeen = [];
        foreach ($seenSkusByListType as $seenSkus) {
            if (! is_array($seenSkus)) {
                continue;
            }
            foreach ($seenSkus as $sku) {
                $allSeen[(string) $sku] = true;
            }
        }
        $allSeenList = array_keys($allSeen);

        foreach ($seenSkusByListType as $listType => $seenSkus) {
            $listType = (string) $listType;
            if ($listType === '' || ! is_array($seenSkus)) {
                continue;
            }

            $seenSkus = array_values(array_unique(array_map('strval', $seenSkus)));

            $query = DigiflazzProduct::query()->where('list_type', $listType);
            if ($seenSkus !== []) {
                $query->whereNotIn('buyer_sku_code', $seenSkus);
            }

            $missingSkus = $query->pluck('buyer_sku_code')->all();
            $disabled += $this->softDisableDigiflazzSkus($missingSkus, $digiflazzProvider);
        }

        if ($allSeenList === []) {
            return $disabled;
        }

        // Legacy DigiflazzProduct without list_type
        $orphanSkus = DigiflazzProduct::query()
            ->where(function ($q) {
                $q->whereNull('list_type')->orWhere('list_type', '');
            })
            ->whereNotIn('buyer_sku_code', $allSeenList)
            ->pluck('buyer_sku_code')
            ->all();
        $disabled += $this->softDisableDigiflazzSkus($orphanSkus, $digiflazzProvider);

        if (! $digiflazzProvider) {
            return $disabled;
        }

        $fetchedTypes = array_keys($seenSkusByListType);
        $staleSkus = ProductProviderSku::query()
            ->where('product_provider_id', $digiflazzProvider->id)
            ->where('is_active', true)
            ->whereNotIn('provider_sku', $allSeenList)
            ->pluck('provider_sku')
            ->all();

        if ($staleSkus === []) {
            return $disabled;
        }

        $eligible = DigiflazzProduct::query()
            ->whereIn('buyer_sku_code', $staleSkus)
            ->where(function ($q) use ($fetchedTypes) {
                $q->whereIn('list_type', $fetchedTypes)
                    ->orWhereNull('list_type')
                    ->orWhere('list_type', '');
            })
            ->pluck('buyer_sku_code')
            ->all();

        $mirrored = DigiflazzProduct::whereIn('buyer_sku_code', $staleSkus)->pluck('buyer_sku_code')->all();
        $missingMirror = array_values(array_diff($staleSkus, $mirrored));
        $toDisable = array_values(array_unique(array_merge($eligible, $missingMirror)));

        if ($toDisable !== []) {
            $disabled += $this->softDisableDigiflazzSkus($toDisable, $digiflazzProvider);
        }

        return $disabled;
    }

    /**
     * @param  list<string|int>  $skus
     */
    protected function softDisableDigiflazzSkus(array $skus, ?ProductProvider $digiflazzProvider): int
    {
        $skus = array_values(array_unique(array_map('strval', $skus)));
        if ($skus === []) {
            return 0;
        }

        DigiflazzProduct::whereIn('buyer_sku_code', $skus)->update([
            'buyer_product_status' => false,
            'seller_product_status' => false,
        ]);

        Product::whereIn('sku_code', $skus)
            ->when(
                $digiflazzProvider,
                fn ($q) => $q->where('product_provider_id', $digiflazzProvider->id)
            )
            ->update(['status' => false]);

        if (! $digiflazzProvider) {
            return count($skus);
        }

        return (int) ProductProviderSku::where('product_provider_id', $digiflazzProvider->id)
            ->whereIn('provider_sku', $skus)
            ->where('is_active', true)
            ->update(['is_active' => false]);
    }

    protected function nullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }

    /**
     * Resolve margin from provider → category → default settings.
     */
    protected function resolveMargin(
        float $defaultMargin,
        $categoryMargins,
        $providerMargins,
        string $category,
        string $brand
    ): float {
        $brandKey = Str::lower($brand);
        if ($providerMargins->has($brandKey)) {
            return (float) ($providerMargins[$brandKey]['margin'] ?? $defaultMargin);
        }

        $categoryKey = Str::lower($category);
        if ($categoryMargins->has($categoryKey)) {
            return (float) ($categoryMargins[$categoryKey]['margin'] ?? $defaultMargin);
        }

        return $defaultMargin;
    }
}
