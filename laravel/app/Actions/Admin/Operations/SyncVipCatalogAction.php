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
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

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
     *   failed:int,
     *   api_latency_ms:int,
     *   api_response_status:?int,
     *   product_count:int,
     *   first_sku_id:?int
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

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $failed = 0;
        $firstSkuId = null;
        $latencies = [];
        $httpStatuses = [];

        // —— Prepaid catalog ——
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

        // Stage 1 — inspect exact VIP JSON shape (from raw HTTP body)
        $this->logStage1ResponseKeys('prepaid', $prepaid['raw'] ?? []);

        $rows = $this->rowsFromVipResponse($prepaid, 'prepaid');

        // —— Game catalog (optional) ——
        $includeGame = (bool) ($options['include_game'] ?? true);
        if ($includeGame) {
            try {
                $game = $this->vipService->gameServices();
                $latencies[] = (int) ($game['latency_ms'] ?? 0);
                $httpStatuses[] = $game['http_status'] ?? null;

                if ($game['success']) {
                    $this->logStage1ResponseKeys('game-feature', $game['raw'] ?? []);
                    foreach ($this->rowsFromVipResponse($game, 'game-feature') as $gRow) {
                        $gRow['_catalog'] = 'game-feature';
                        $rows[] = $gRow;
                    }
                } else {
                    Log::info('VIP SYNC TRACE — Stage 4 Skipped catalog source', [
                        'reason' => 'game_catalog_api_failed',
                        'message' => $game['message'] ?? null,
                    ]);
                }
            } catch (Throwable $e) {
                Log::info('VIP SYNC TRACE — Stage 4 Skipped catalog source', [
                    'reason' => 'game_catalog_exception',
                    'message' => $e->getMessage(),
                ]);
            }
        }

        // Stage 2 — before foreach
        Log::info('VIP SYNC TRACE — Stage 2 Total rows detected', [
            'count' => count($rows),
        ]);

        if (count($rows) === 0) {
            Log::error('VIP SYNC TRACE — STOP before Product::create()', [
                'reason' => 'total_rows_detected_is_zero',
                'hint' => 'VIP JSON returned but flatten found no product rows with code/service/sku',
            ]);
        }

        $defaultMargin = (float) (Setting::where('key', 'default_margin')->value('value') ?? 1500);
        $digiflazzId = ProductProvider::digiflazz()?->id;

        foreach ($rows as $index => $row) {
            if (!is_array($row)) {
                $skipped++;
                Log::info('VIP SYNC TRACE — Stage 4 Skipped', [
                    'reason' => 'invalid_payload',
                    'index' => $index,
                ]);
                continue;
            }

            $providerSku = trim((string) ($row['code'] ?? $row['service'] ?? $row['sku'] ?? ''));
            $providerName = trim((string) ($row['name'] ?? $row['product_name'] ?? ''));
            $game = trim((string) ($row['game'] ?? ''));
            $brand = trim((string) ($row['brand'] ?? $row['operator'] ?? ''));
            if ($brand === '' && $game !== '') {
                $brand = $game;
            }
            if ($brand === '') {
                $brand = 'VIP';
            }

            $categoryName = trim((string) ($row['type'] ?? $row['category'] ?? ($row['_catalog'] ?? '')));
            if ($categoryName === '') {
                $categoryName = $game !== '' ? 'game' : 'prepaid';
            }
            // Align VIP catalog families with Digiflazz / User Dashboard slugs so
            // findMatchingMasterProduct can attach VIP SKUs onto Digi masters and
            // GET /products?category=pulsa returns VIP offers when Digi is off.
            $categoryName = $this->normalizeVipCategoryName($categoryName, $game !== '');

            $statusRaw = strtolower(trim((string) ($row['status'] ?? 'available')));
            $providerPrice = $this->extractPrice($row); // NEVER (float)$row['price'] when array

            // Stage 3 — every row
            Log::info('VIP SYNC TRACE — Stage 3 Row', [
                'index' => $index,
                'provider_code' => $providerSku !== '' ? $providerSku : null,
                'game' => $game !== '' ? $game : null,
                'brand' => $brand,
                'category' => $categoryName,
                'price' => $providerPrice,
                'price_raw' => $row['price'] ?? null,
                'status' => $statusRaw,
            ]);

            // Stage 4 — skips with exact reason
            if ($providerSku === '') {
                $skipped++;
                Log::info('VIP SYNC TRACE — Stage 4 Skipped', [
                    'reason' => 'missing_provider_code',
                    'index' => $index,
                    'row_keys' => array_keys($row),
                ]);
                continue;
            }

            if ($providerName === '') {
                $providerName = $providerSku;
            }

            if ($providerPrice <= 0) {
                // Still import with 0 — do not skip solely on price; log validation
                Log::info('VIP SYNC TRACE — Stage 4 Validation note', [
                    'reason' => 'missing_price',
                    'provider_code' => $providerSku,
                    'price_raw' => $row['price'] ?? null,
                ]);
            }

            $isActive = !in_array($statusRaw, ['empty', 'unavailable', 'nonaktif', 'inactive', '0', 'false'], true);
            $internalSku = 'VIP-' . $providerSku;

            try {
                $collision = Product::withTrashed()->where('sku_code', $internalSku)->first();
                if ($collision && $digiflazzId && (int) $collision->product_provider_id === (int) $digiflazzId) {
                    $skipped++;
                    Log::info('VIP SYNC TRACE — Stage 4 Skipped', [
                        'reason' => 'duplicate',
                        'detail' => 'digiflazz_owns_internal_sku',
                        'sku' => $internalSku,
                    ]);
                    continue;
                }

                $category = $this->upsertCategory($categoryName);
                $operator = $this->upsertOperator($brand);

                // Prefer attaching VIP offer onto an existing Digiflazz/master product (same brand+name).
                $matched = $this->findMatchingMasterProduct($category->id, $operator->id, $providerName);
                if ($matched) {
                    if ($matched->trashed()) {
                        $matched->restore();
                    }
                    $product = $matched;
                    $updated++;
                    Log::info('VIP SYNC TRACE — Stage 5 Matched existing master product (no duplicate Product)', [
                        'product_id' => $product->id,
                        'sku_code' => $product->sku_code,
                        'vip_provider_sku' => $providerSku,
                    ]);
                } else {
                    $existing = Product::withTrashed()->where('sku_code', $internalSku)->first();

                    if ($existing) {
                        if ($digiflazzId && (int) $existing->product_provider_id === (int) $digiflazzId) {
                            $skipped++;
                            Log::info('VIP SYNC TRACE — Stage 4 Skipped', [
                                'reason' => 'duplicate',
                                'detail' => 'digiflazz_ownership',
                                'sku' => $internalSku,
                            ]);
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

                        $updatePayload = [
                            'product_category_id' => $category->id,
                            'provider_id' => $operator->id,
                            'product_provider_id' => $vipProvider->id,
                            'name' => $providerName,
                            'base_price' => $providerPrice,
                            'sell_price' => $providerPrice + $previousMargin + $adminFee,
                            'status' => $isActive,
                        ];

                        Log::info('VIP SYNC TRACE — Stage 5 Before Product update', $updatePayload + [
                            'product_id' => $existing->id,
                            'sku_code' => $internalSku,
                        ]);

                        $existing->fill($updatePayload);
                        $existing->save();
                        $product = $existing;
                        $updated++;

                        Log::info('VIP SYNC TRACE — Stage 6 After Product update', [
                            'Inserted Product ID' => $product->id,
                        ]);
                    } else {
                        $createPayload = [
                            'product_category_id' => $category->id,
                            'provider_id' => $operator->id,
                            'product_provider_id' => $vipProvider->id,
                            'sku_code' => $internalSku,
                            'name' => $providerName,
                            'base_price' => $providerPrice,
                            'sell_price' => $providerPrice + $defaultMargin,
                            'admin_fee' => 0.00,
                            'status' => $isActive,
                        ];

                        Log::info('VIP SYNC TRACE — Stage 5 Before Product::create()', $createPayload);

                        $product = Product::create($createPayload);
                        $imported++;

                        Log::info('VIP SYNC TRACE — Stage 6 After Product::create()', [
                            'Inserted Product ID' => $product->id,
                        ]);
                    }
                }

                $skuAttributes = [
                    'product_id' => $product->id,
                    'product_provider_id' => $vipProvider->id,
                ];
                $skuValues = [
                    'provider_sku' => $providerSku,
                    'provider_name' => $providerName,
                    'base_price' => $providerPrice,
                    'provider_price' => $providerPrice,
                    'provider_status' => $statusRaw !== '' ? $statusRaw : ($isActive ? 'available' : 'empty'),
                    'is_preferred' => false,
                    'is_active' => $isActive,
                ];

                Log::info('VIP SYNC TRACE — Stage 7 Before ProductProviderSku::updateOrCreate()', array_merge($skuAttributes, $skuValues));

                $skuRow = ProductProviderSku::updateOrCreate($skuAttributes, $skuValues);

                Log::info('VIP SYNC TRACE — Stage 7 After ProductProviderSku::updateOrCreate()', [
                    'Inserted Mapping ID' => $skuRow->id,
                    'was_recently_created' => $skuRow->wasRecentlyCreated,
                ]);

                if ($firstSkuId === null) {
                    $firstSkuId = (int) $skuRow->id;
                }
            } catch (QueryException $e) {
                $failed++;
                $this->logQueryFailure($e, $providerSku, $index);
            } catch (Throwable $e) {
                $failed++;
                Log::error('VIP SYNC TRACE — Stage 4/Exception', [
                    'reason' => 'exception',
                    'provider_code' => $providerSku,
                    'class' => $e::class,
                    'message' => $e->getMessage(),
                    'line' => $e->getLine(),
                    'file' => $e->getFile(),
                ]);
            }
        }

        // Stage 8
        Log::info('VIP SYNC TRACE — Stage 8 Counters', [
            'Imported' => $imported,
            'Updated' => $updated,
            'Skipped' => $skipped,
            'Failed' => $failed,
            'first_sku_id' => $firstSkuId,
        ]);

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
                'VIPAYMENT sync selesai. Imported: %d, Updated: %d, Skipped: %d, Failed: %d.',
                $imported,
                $updated,
                $skipped,
                $failed
            ),
            'imported' => $imported,
            'updated' => $updated,
            'skipped' => $skipped,
            'failed' => $failed,
            'api_latency_ms' => $totalLatency,
            'api_response_status' => $lastHttp,
            'product_count' => $count,
            'synced_count' => $imported + $updated,
            'first_sku_id' => $firstSkuId,
        ];

        ProductProviderLog::create([
            'product_provider_id' => $vipProvider->id,
            'event_type' => 'sync',
            'selected_provider_code' => ProductProvider::CODE_VIP,
            'success' => ($imported + $updated) > 0,
            'reason' => ($imported + $updated) > 0 ? 'sync_completed' : 'sync_zero_rows',
            'response_time_ms' => $totalLatency,
            'meta' => $result,
        ]);

        return $result;
    }

    /**
     * Stage 1 — log exact VIP response key structure.
     *
     * @param  array<string,mixed>  $raw
     */
    protected function logStage1ResponseKeys(string $source, array $raw): void
    {
        $data = $raw['data'] ?? null;
        $dataKeys = is_array($data) ? array_slice(array_keys($data), 0, 30) : null;

        Log::info('VIP SYNC TRACE — Stage 1 Response keys', [
            'source' => $source,
            'top_level_keys' => array_keys($raw),
            'result' => $raw['result'] ?? null,
            'status' => $raw['status'] ?? null,
            'message' => $raw['message'] ?? null,
            'has_data' => array_key_exists('data', $raw),
            'data_type' => gettype($data),
            'data_keys_or_indexes_sample' => $dataKeys,
            'data_services_present' => is_array($data) && array_key_exists('services', $data),
            'data_game_present' => is_array($data) && array_key_exists('game', $data),
            'data_games_present' => is_array($data) && array_key_exists('games', $data),
            'first_data_element_keys' => $this->firstElementKeys($data),
        ]);
    }

    /**
     * Build product rows from VipService response using raw JSON (not the wrapper).
     *
     * @param  array<string,mixed>  $response
     * @return list<array<string,mixed>>
     */
    protected function rowsFromVipResponse(array $response, string $source): array
    {
        $raw = is_array($response['raw'] ?? null) ? $response['raw'] : [];
        $node = $raw['data'] ?? $response['data'] ?? [];

        // Nested wrappers: data.services / data.game / data.games / data.items
        if (is_array($node) && !$this->isList($node) && !$this->looksLikeProductRow($node)) {
            foreach (['services', 'game', 'games', 'prepaid', 'items', 'list', 'products'] as $key) {
                if (isset($node[$key]) && is_array($node[$key])) {
                    Log::info('VIP SYNC TRACE — Stage 1 Nested path selected', [
                        'source' => $source,
                        'path' => 'data.' . $key,
                    ]);
                    $node = $node[$key];
                    break;
                }
            }
        }

        $rows = $this->flattenCatalogRows($node);

        Log::info('VIP SYNC TRACE — Stage 1 Flattened row count', [
            'source' => $source,
            'count' => count($rows),
        ]);

        return $rows;
    }

    /**
     * @param  mixed  $data
     * @return list<string>|null
     */
    protected function firstElementKeys(mixed $data): ?array
    {
        if (!is_array($data) || $data === []) {
            return null;
        }

        $first = reset($data);
        if (!is_array($first)) {
            return null;
        }

        // Grouped list: first value is list of products
        if ($this->isList($first) && isset($first[0]) && is_array($first[0])) {
            return array_keys($first[0]);
        }

        return array_keys($first);
    }

    /**
     * Flatten VIP catalog payloads — iterate ONLY product rows, never the wrapper.
     *
     * @param  mixed  $data
     * @return list<array<string,mixed>>
     */
    protected function flattenCatalogRows(mixed $data): array
    {
        if (!is_array($data)) {
            return [];
        }

        // Single product object
        if ($this->looksLikeProductRow($data)) {
            return [$data];
        }

        $out = [];

        foreach ($data as $item) {
            if (!is_array($item)) {
                continue;
            }

            if ($this->looksLikeProductRow($item)) {
                $out[] = $item;
                continue;
            }

            // Grouped by game/brand: "Zepeto" => [ products... ]
            if ($this->isList($item)) {
                foreach ($item as $inner) {
                    if (is_array($inner) && $this->looksLikeProductRow($inner)) {
                        $out[] = $inner;
                    }
                }
                continue;
            }

            // Nested object wrapper inside an element
            foreach ($item as $nested) {
                if (!is_array($nested)) {
                    continue;
                }
                if ($this->looksLikeProductRow($nested)) {
                    $out[] = $nested;
                } elseif ($this->isList($nested)) {
                    foreach ($nested as $inner) {
                        if (is_array($inner) && $this->looksLikeProductRow($inner)) {
                            $out[] = $inner;
                        }
                    }
                }
            }
        }

        return $out;
    }

    /**
     * @param  array<string,mixed>  $row
     */
    protected function looksLikeProductRow(array $row): bool
    {
        return isset($row['code']) || isset($row['service']) || isset($row['sku']);
    }

    /**
     * @param  array<mixed>  $value
     */
    protected function isList(array $value): bool
    {
        if ($value === []) {
            return true;
        }

        return array_keys($value) === range(0, count($value) - 1);
    }

    /**
     * Resolve VIP price. MUST NOT cast array price with (float)$row['price'].
     * Order: basic → premium → special → numeric price → harga.
     *
     * @param  array<string,mixed>  $row
     */
    protected function extractPrice(array $row): float
    {
        $price = $row['price'] ?? null;

        if (is_array($price)) {
            foreach (['basic', 'premium', 'special'] as $tier) {
                if (isset($price[$tier]) && is_numeric($price[$tier])) {
                    return (float) $price[$tier];
                }
            }

            return 0.0;
        }

        if (is_numeric($price)) {
            return (float) $price;
        }

        if (isset($row['harga']) && is_numeric($row['harga'])) {
            return (float) $row['harga'];
        }

        return 0.0;
    }

    /**
     * Map VIP Reseller category labels onto Digiflazz / dashboard families.
     * Without this, VIP rows land in slug "prepaid" while the User Dashboard
     * requests category=pulsa — Digi OFF + VIP ON then returns an empty list.
     */
    protected function normalizeVipCategoryName(string $categoryName, bool $isGame): string
    {
        $raw = Str::lower(trim($categoryName));

        if ($isGame || in_array($raw, ['game', 'game-feature', 'voucher'], true)) {
            return 'Voucher';
        }

        return match ($raw) {
            'prepaid', 'pulsa', 'pulse', 'phone credit' => 'Pulsa',
            'data', 'paket data', 'paket-data', 'internet' => 'Data',
            'pln', 'token pln', 'token-pln', 'listrik', 'electricity' => 'PLN',
            'pdam', 'bpjs' => Str::title($raw),
            default => $categoryName !== '' ? $categoryName : 'Pulsa',
        };
    }

    protected function upsertCategory(string $categoryName): ProductCategory
    {
        $slug = Str::slug($categoryName) ?: 'vip';
        $category = ProductCategory::withTrashed()->firstOrNew(['slug' => $slug]);
        if ($category->trashed()) {
            $category->restore();
        }
        $category->fill([
            'name' => $categoryName !== '' ? $categoryName : 'VIP',
            'icon' => $category->icon ?: 'box',
        ]);
        $category->save();

        return $category;
    }

    /**
     * Find an existing non-VIP master product to attach a VIP offer (enables failover + catalog merge).
     */
    protected function findMatchingMasterProduct(int $categoryId, int $operatorId, string $name): ?Product
    {
        $normalized = Str::lower(trim($name));
        if ($normalized === '') {
            return null;
        }

        return Product::withTrashed()
            ->where('product_category_id', $categoryId)
            ->where('provider_id', $operatorId)
            ->whereRaw('LOWER(TRIM(name)) = ?', [$normalized])
            ->where('sku_code', 'not like', 'VIP-%')
            ->orderBy('id')
            ->first();
    }

    protected function upsertOperator(string $brand): Provider
    {
        $name = $brand !== '' ? $brand : 'VIP';
        $operator = Provider::withTrashed()->firstOrNew(['name' => $name]);
        if ($operator->trashed()) {
            $operator->restore();
        }
        $operator->fill([
            'logo' => $operator->logo ?: (Str::slug($name) . '.png'),
            'is_active' => true,
        ]);
        $operator->save();

        return $operator;
    }

    protected function logQueryFailure(QueryException $e, string $providerSku, int|string $index): void
    {
        $sqlState = $e->errorInfo[0] ?? null;
        $driverCode = $e->errorInfo[1] ?? null;
        $message = $e->getMessage();
        $lower = strtolower($message);

        $reason = 'database_query_exception';
        if ($sqlState === '23000' || $driverCode === 1062 || str_contains($lower, 'duplicate')) {
            $reason = 'duplicate';
        } elseif ($driverCode === 1452 || str_contains($lower, 'foreign key')) {
            $reason = 'foreign_key_violation';
        } elseif (str_contains($lower, 'rollback')) {
            $reason = 'transaction_rollback';
        } elseif (str_contains($lower, 'mass assignment') || str_contains($lower, 'fillable')) {
            $reason = 'mass_assignment_failure';
        }

        Log::error('VIP SYNC TRACE — Stage 4 Skipped', [
            'reason' => $reason,
            'index' => $index,
            'provider_code' => $providerSku,
            'sql_state' => $sqlState,
            'driver_code' => $driverCode,
            'message' => $message,
        ]);
    }
}
