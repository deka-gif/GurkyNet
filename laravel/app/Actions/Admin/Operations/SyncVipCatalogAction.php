<?php

namespace App\Actions\Admin\Operations;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\Setting;
use App\Services\VipService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Sync VIPAYMENT (VIP Reseller) catalog into master products + product_provider_skus.
 * Never overwrites Digiflazz-owned products (product_provider_id = digiflazz).
 */
class SyncVipCatalogAction
{
    public function __construct(protected VipService $vipService) {}

    /**
     * @param  array{include_game?:bool}  $options
     * @return array{
     *   success:bool,
     *   message:string,
     *   imported:int,
     *   updated:int,
     *   skipped:int,
     *   api_latency_ms:int,
     *   api_response_status:?int,
     *   product_count:int
     * }
     */
    public function execute(array $options = []): array
    {
        $vipProvider = ProductProvider::vip();
        if (!$vipProvider) {
            throw new RuntimeException('VIPAYMENT product provider row is missing from product_providers.');
        }

        $cred = $this->vipService->credentialStatus();
        if (!$cred['ok']) {
            ProductProviderLog::create([
                'product_provider_id' => $vipProvider->id,
                'event_type' => 'sync',
                'selected_provider_code' => ProductProvider::CODE_VIP,
                'success' => false,
                'reason' => 'credentials_missing',
                'error_message' => $cred['message'],
                'meta' => ['missing' => $cred['missing']],
            ]);

            throw new RuntimeException($cred['message'] ?? 'VIP credentials missing');
        }

        $started = microtime(true);
        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $latencies = [];
        $httpStatuses = [];

        $prepaid = $this->vipService->prepaidServices();
        $latencies[] = (int) ($prepaid['latency_ms'] ?? 0);
        $httpStatuses[] = $prepaid['http_status'] ?? null;

        if (!$prepaid['success']) {
            ProductProviderLog::create([
                'product_provider_id' => $vipProvider->id,
                'event_type' => 'sync',
                'selected_provider_code' => ProductProvider::CODE_VIP,
                'success' => false,
                'reason' => $prepaid['api_status'] ?? 'sync_failed',
                'response_time_ms' => $prepaid['latency_ms'] ?? null,
                'error_message' => $prepaid['message'] ?? 'VIP prepaid services failed',
                'meta' => [
                    'http_status' => $prepaid['http_status'] ?? null,
                    'api_status' => $prepaid['api_status'] ?? null,
                ],
            ]);

            $vipProvider->forceFill([
                'api_status' => $prepaid['api_status'] ?? 'offline',
                'health_color' => $prepaid['health_color'] ?? 'red',
                'last_error' => $prepaid['message'] ?? null,
                'last_failure_at' => now(),
            ])->save();

            throw new RuntimeException($prepaid['message'] ?? 'VIP catalog sync failed');
        }

        $rows = $prepaid['data'] ?? [];

        $includeGame = (bool) ($options['include_game'] ?? true);
        if ($includeGame) {
            try {
                $game = $this->vipService->gameServices();
                $latencies[] = (int) ($game['latency_ms'] ?? 0);
                $httpStatuses[] = $game['http_status'] ?? null;
                if ($game['success'] && !empty($game['data'])) {
                    foreach ($game['data'] as $gRow) {
                        if (is_array($gRow)) {
                            $gRow['_catalog'] = 'game-feature';
                            $rows[] = $gRow;
                        }
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('VIP game catalog skipped', ['error' => $e->getMessage()]);
            }
        }

        $defaultMargin = (float) (Setting::where('key', 'default_margin')->value('value') ?? 1500);
        $digiflazzId = ProductProvider::digiflazz()?->id;

        foreach ($rows as $row) {
            if (!is_array($row)) {
                $skipped++;
                continue;
            }

            $providerSku = (string) ($row['code'] ?? $row['service'] ?? $row['sku'] ?? '');
            if ($providerSku === '') {
                $skipped++;
                continue;
            }

            $providerName = (string) ($row['name'] ?? $row['product_name'] ?? $providerSku);
            $providerPrice = (float) ($row['price'] ?? $row['price.basic'] ?? $row['harga'] ?? 0);
            $statusRaw = strtolower((string) ($row['status'] ?? 'available'));
            $isActive = !in_array($statusRaw, ['empty', 'unavailable', 'nonaktif', 'inactive', '0', 'false'], true);
            $brand = (string) ($row['brand'] ?? $row['operator'] ?? 'VIP');
            $categoryName = (string) ($row['type'] ?? $row['category'] ?? ($row['_catalog'] ?? 'prepaid'));

            // Internal SKU is namespaced so Digiflazz master rows are never overwritten.
            $internalSku = 'VIP-' . $providerSku;

            // Skip if a Digiflazz product already owns this exact internal sku (paranoia).
            $collision = Product::withTrashed()->where('sku_code', $internalSku)->first();
            if ($collision && $digiflazzId && (int) $collision->product_provider_id === (int) $digiflazzId) {
                $skipped++;
                Log::warning('VIP sync skipped Digiflazz collision', ['sku' => $internalSku]);
                continue;
            }

            $category = ProductCategory::updateOrCreate(
                ['slug' => Str::slug($categoryName) ?: 'vip'],
                [
                    'name' => $categoryName !== '' ? $categoryName : 'VIP',
                    'icon' => 'box',
                ]
            );

            $operator = Provider::updateOrCreate(
                ['name' => $brand !== '' ? $brand : 'VIP'],
                [
                    'logo' => Str::slug($brand !== '' ? $brand : 'vip') . '.png',
                    'is_active' => true,
                ]
            );

            $existing = Product::withTrashed()->where('sku_code', $internalSku)->first();

            if ($existing) {
                // Never steal Digiflazz ownership
                if ($digiflazzId && (int) $existing->product_provider_id === (int) $digiflazzId) {
                    $skipped++;
                    continue;
                }

                if ($existing->trashed()) {
                    $existing->restore();
                }

                $adminFee = (float) $existing->admin_fee;
                $previousMargin = (float) $existing->sell_price - (float) $existing->base_price - $adminFee;
                if ($previousMargin < 0) {
                    $previousMargin = $defaultMargin;
                }

                $existing->fill([
                    'product_category_id' => $category->id,
                    'provider_id' => $operator->id,
                    'product_provider_id' => $vipProvider->id,
                    'name' => $providerName,
                    'base_price' => $providerPrice,
                    'sell_price' => $providerPrice + $previousMargin + $adminFee,
                    'status' => $isActive,
                ]);
                $existing->save();
                $product = $existing;
                $updated++;
            } else {
                $product = Product::create([
                    'product_category_id' => $category->id,
                    'provider_id' => $operator->id,
                    'product_provider_id' => $vipProvider->id,
                    'sku_code' => $internalSku,
                    'name' => $providerName,
                    'base_price' => $providerPrice,
                    'sell_price' => $providerPrice + $defaultMargin,
                    'admin_fee' => 0.00,
                    'status' => $isActive,
                ]);
                $imported++;
            }

            ProductProviderSku::updateOrCreate(
                [
                    'product_provider_id' => $vipProvider->id,
                    'provider_sku' => $providerSku,
                ],
                [
                    'product_id' => $product->id,
                    'provider_name' => $providerName,
                    'base_price' => $providerPrice,
                    'provider_price' => $providerPrice,
                    'provider_status' => $statusRaw !== '' ? $statusRaw : ($isActive ? 'available' : 'empty'),
                    'is_preferred' => false,
                    'is_active' => $isActive,
                ]
            );
        }

        $count = ProductProviderSku::where('product_provider_id', $vipProvider->id)->where('is_active', true)->count();
        $totalLatency = (int) array_sum($latencies);
        $lastHttp = null;
        foreach (array_reverse($httpStatuses) as $st) {
            if ($st !== null) {
                $lastHttp = $st;
                break;
            }
        }

        $vipProvider->forceFill([
            'last_sync_at' => now(),
            'product_count' => $count,
            'api_status' => 'online',
            'health_color' => 'green',
            'avg_response_ms' => $totalLatency > 0 ? $totalLatency : $vipProvider->avg_response_ms,
            'last_error' => null,
            'is_active' => true,
        ])->save();

        $result = [
            'success' => true,
            'message' => sprintf(
                'VIPAYMENT sync selesai. Imported: %d, Updated: %d, Skipped: %d.',
                $imported,
                $updated,
                $skipped
            ),
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'api_latency_ms' => $totalLatency,
            'api_response_status' => $lastHttp,
            'product_count' => $count,
            'synced_count' => $imported + $updated,
        ];

        ProductProviderLog::create([
            'product_provider_id' => $vipProvider->id,
            'event_type' => 'sync',
            'selected_provider_code' => ProductProvider::CODE_VIP,
            'success' => true,
            'reason' => 'sync_completed',
            'response_time_ms' => $totalLatency,
            'meta' => $result,
        ]);

        return $result;
    }
}
