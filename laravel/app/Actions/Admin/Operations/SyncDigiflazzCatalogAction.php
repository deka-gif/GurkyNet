<?php

namespace App\Actions\Admin\Operations;

use App\Exceptions\ProviderCatalogException;
use App\Models\ActivityLog;
use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\Provider;
use App\Models\Setting;
use App\Repositories\Contracts\ProviderRepositoryInterface;
use App\Services\DigiflazzService;
use App\Services\ProductProviders\DigiflazzResponseCodeClassifier;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SyncDigiflazzCatalogAction
{
    public function __construct(
        protected DigiflazzService $digiflazzService,
        protected ProviderRepositoryInterface $providerRepository
    ) {}

    /**
     * Fetch Digiflazz price lists and upsert into digiflazz_products + master products.
     *
     * @param  array{cmd?: string|string[], async?: bool}  $options
     */
    public function execute(array $options = []): array
    {
        $startedAt = microtime(true);

        if (!$this->digiflazzService->isConfigured()) {
            $result = $this->persistSyncMeta([
                'status' => 'failed',
                'message' => 'Digiflazz credentials are not configured.',
                'synced_count' => 0,
                'failed_count' => 1,
            ]);

            throw new ProviderCatalogException(
                $result['message'],
                'Digiflazz',
                'CONFIG',
                false,
                $result
            );
        }

        $cmds = $options['cmd'] ?? ['prepaid', 'pasca'];
        if (!is_array($cmds)) {
            $cmds = [$cmds];
        }

        $normalized = [];
        $seenSkusByListType = [];
        $errors = [];
        $rateLimited = null;

        foreach ($cmds as $cmd) {
            $cmd = (string) $cmd;
            $attempt = 0;
            $maxAttempts = 2;

            while ($attempt < $maxAttempts) {
                $attempt++;
                try {
                    $response = $this->digiflazzService->fetchPriceList($cmd);
                    $rows = $response['data'] ?? null;

                    if (!is_array($rows)) {
                        $errors[] = "Digiflazz {$cmd} price-list returned no data.";
                        break;
                    }

                    if ($this->isDigiflazzRcErrorPayload($rows)) {
                        $classifier = DigiflazzResponseCodeClassifier::fromResponseData($rows);
                        Log::warning('Digiflazz price-list RC error', array_merge(
                            ['cmd' => $cmd, 'attempt' => $attempt],
                            $classifier->toOfficialMetadata()
                        ));
                        $message = trim((string) ($rows['message'] ?? ''));
                        if ($message === '' && ! $classifier->isUnknown()) {
                            $message = $classifier->message;
                        }

                        if ($classifier->isRateLimited()) {
                            $rateLimited = [
                                'code' => $classifier->code,
                                'message' => $message !== ''
                                    ? $message
                                    : 'Anda telah mencapai limitasi pengecekan pricelist.',
                                'cmd' => $cmd,
                                'retryable' => true,
                            ];
                            $errors[] = "Digiflazz {$cmd} price-list RC {$classifier->code}"
                                .($message !== '' ? ": {$message}" : '');
                            break;
                        }

                        if ($classifier->shouldRetry && $attempt < $maxAttempts) {
                            usleep(2_000_000);
                            continue;
                        }

                        $errors[] = "Digiflazz {$cmd} price-list RC {$classifier->code}"
                            .($message !== '' ? ": {$message}" : '');
                        break;
                    }

                    $seenForCmd = [];

                    foreach ($rows as $row) {
                        if (!is_array($row)) {
                            continue;
                        }

                        $sku = $row['buyer_sku_code'] ?? null;
                        if (!$sku) {
                            continue;
                        }

                        $sku = (string) $sku;
                        $normalized[$sku] = $this->normalizeDigiflazzRow($row, $cmd);
                        $seenForCmd[] = $sku;
                    }

                    $seenSkusByListType[$cmd] = array_values(array_unique($seenForCmd));
                    break;
                } catch (ProviderCatalogException $e) {
                    throw $e;
                } catch (\Throwable $e) {
                    Log::error('Digiflazz catalog sync fetch failed', [
                        'cmd' => $cmd,
                        'attempt' => $attempt,
                        'message' => $e->getMessage(),
                    ]);
                    if ($attempt < $maxAttempts) {
                        usleep(2_000_000);
                        continue;
                    }
                    $errors[] = "{$cmd}: " . $e->getMessage();
                    break;
                }
            }
        }

        if (empty($normalized) && !empty($errors)) {
            $result = $this->persistSyncMeta([
                'status' => 'failed',
                'message' => implode(' | ', $errors),
                'synced_count' => 0,
                'failed_count' => count($errors),
            ]);

            if ($rateLimited) {
                throw new ProviderCatalogException(
                    $rateLimited['message'],
                    'Digiflazz',
                    (string) $rateLimited['code'],
                    true,
                    array_merge($result, [
                        'steps' => ['Connecting Provider', 'Authenticating', 'Downloading Pricelist'],
                        'provider_rc' => $rateLimited,
                    ])
                );
            }

            throw new ProviderCatalogException(
                $result['message'],
                'Digiflazz',
                'SYNC_FAILED',
                true,
                $result
            );
        }

        $products = array_values($normalized);
        $stats = $this->providerRepository->syncWithDigiflazz($products, $seenSkusByListType);

        Cache::forget('digiflazz_balance');
        \App\Services\ProductProviders\ProductCatalogCache::bump();

        $durationMs = (int) round((microtime(true) - $startedAt) * 1000);

        $result = $this->persistSyncMeta([
            'status' => empty($errors) ? 'success' : 'partial',
            'message' => empty($errors)
                ? 'Digiflazz catalog synchronized successfully.'
                : 'Catalog synced with warnings: ' . implode(' | ', $errors),
            'synced_count' => count($products),
            'failed_count' => count($errors),
            'product_count' => Product::count(),
            'provider_count' => Provider::count(),
            'digiflazz_product_count' => DigiflazzProduct::count(),
            'inserted' => $stats['inserted'] ?? 0,
            'updated' => $stats['updated'] ?? 0,
            'skipped' => $stats['skipped'] ?? 0,
            'disabled' => $stats['disabled'] ?? 0,
            'provider_sku_total' => $stats['provider_sku_total'] ?? count($products),
            'database_sku_total' => $stats['database_sku_total'] ?? 0,
            'difference' => $stats['difference'] ?? 0,
            'duration_ms' => $durationMs,
            'duration_sec' => round($durationMs / 1000, 1),
            'next_recommended_sync_at' => now()->addMinutes(30)->toIso8601String(),
        ]);

        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => 'SYNC_DIGIFLAZZ_CATALOG_OPERATIONS',
            'payload' => $result,
        ]);

        return $result;
    }

    /**
     * Digiflazz price-list error payloads nest RC under `data` (associative), not a product list.
     *
     * @param  array<string, mixed>  $data
     */
    protected function isDigiflazzRcErrorPayload(array $data): bool
    {
        if (! array_key_exists('rc', $data)) {
            return false;
        }

        return ! array_is_list($data);
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    protected function normalizeDigiflazzRow(array $row, string $listType): array
    {
        $price = $row['seller_price'] ?? $row['price'] ?? 0;

        return [
            'buyer_sku_code' => (string) $row['buyer_sku_code'],
            'list_type' => $listType,
            'product_name' => (string) ($row['product_name'] ?? $row['buyer_sku_code']),
            'category' => (string) ($row['category'] ?? 'Umum'),
            'brand' => (string) ($row['brand'] ?? 'Unknown'),
            'type' => isset($row['type']) ? (string) $row['type'] : null,
            'seller_name' => isset($row['seller_name']) ? (string) $row['seller_name'] : null,
            'seller_price' => (float) $price,
            'admin' => array_key_exists('admin', $row) ? $row['admin'] : null,
            'commission' => array_key_exists('commission', $row) ? $row['commission'] : null,
            'buyer_product_status' => (bool) ($row['buyer_product_status'] ?? true),
            'seller_product_status' => (bool) ($row['seller_product_status'] ?? true),
            'unlimited_stock' => (bool) ($row['unlimited_stock'] ?? true),
            'stock' => array_key_exists('stock', $row) ? (string) $row['stock'] : null,
            'multi' => array_key_exists('multi', $row) ? (bool) $row['multi'] : null,
            'start_cut_off' => isset($row['start_cut_off']) ? (string) $row['start_cut_off'] : null,
            'end_cut_off' => isset($row['end_cut_off']) ? (string) $row['end_cut_off'] : null,
            'desc' => $row['desc'] ?? null,
        ];
    }

    protected function persistSyncMeta(array $meta): array
    {
        $payload = array_merge([
            'status' => 'unknown',
            'message' => null,
            'synced_count' => 0,
            'failed_count' => 0,
            'last_sync_at' => now()->toIso8601String(),
        ], $meta);

        Setting::updateOrCreate(
            ['key' => 'digiflazz_last_sync_at'],
            ['value' => $payload['last_sync_at']]
        );
        Setting::updateOrCreate(
            ['key' => 'digiflazz_last_sync_status'],
            ['value' => (string) $payload['status']]
        );
        Setting::updateOrCreate(
            ['key' => 'digiflazz_last_sync_count'],
            ['value' => (string) ($payload['synced_count'] ?? 0)]
        );
        Setting::updateOrCreate(
            ['key' => 'digiflazz_last_sync_failed'],
            ['value' => (string) ($payload['failed_count'] ?? 0)]
        );
        Setting::updateOrCreate(
            ['key' => 'digiflazz_last_sync_message'],
            ['value' => (string) ($payload['message'] ?? '')]
        );
        Setting::updateOrCreate(
            ['key' => 'digiflazz_last_sync_summary'],
            ['value' => json_encode([
                'inserted' => $payload['inserted'] ?? 0,
                'updated' => $payload['updated'] ?? 0,
                'skipped' => $payload['skipped'] ?? 0,
                'disabled' => $payload['disabled'] ?? 0,
                'duration_sec' => $payload['duration_sec'] ?? null,
                'provider_sku_total' => $payload['provider_sku_total'] ?? null,
                'database_sku_total' => $payload['database_sku_total'] ?? null,
                'difference' => $payload['difference'] ?? null,
            ])]
        );

        if (($payload['status'] ?? '') === 'failed') {
            $failedTotal = (int) (Setting::where('key', 'digiflazz_failed_sync_total')->value('value') ?? 0);
            Setting::updateOrCreate(
                ['key' => 'digiflazz_failed_sync_total'],
                ['value' => (string) ($failedTotal + 1)]
            );
            $payload['failed_sync_total'] = $failedTotal + 1;
        } else {
            $payload['failed_sync_total'] = (int) (Setting::where('key', 'digiflazz_failed_sync_total')->value('value') ?? 0);
        }

        return $payload;
    }
}
