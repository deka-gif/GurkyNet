<?php

namespace App\Actions\Admin\Operations;

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
        // Power (is_active) does not gate sync — visibility is independent of catalog sync.

        if (!$this->digiflazzService->isConfigured()) {
            $result = $this->persistSyncMeta([
                'status' => 'failed',
                'message' => 'Digiflazz credentials are not configured.',
                'synced_count' => 0,
                'failed_count' => 1,
            ]);

            throw new \RuntimeException($result['message']);
        }

        $cmds = $options['cmd'] ?? ['prepaid', 'pasca'];
        if (!is_array($cmds)) {
            $cmds = [$cmds];
        }

        $normalized = [];
        $seenSkusByListType = [];
        $errors = [];

        foreach ($cmds as $cmd) {
            $cmd = (string) $cmd;
            try {
                $response = $this->digiflazzService->fetchPriceList($cmd);
                $rows = $response['data'] ?? null;

                if (!is_array($rows)) {
                    $errors[] = "Digiflazz {$cmd} price-list returned no data.";
                    continue;
                }

                if ($this->isDigiflazzRcErrorPayload($rows)) {
                    $classifier = DigiflazzResponseCodeClassifier::fromResponseData($rows);
                    Log::warning('Digiflazz price-list RC error', array_merge(
                        ['cmd' => $cmd],
                        $classifier->toOfficialMetadata()
                    ));
                    $message = trim((string) ($rows['message'] ?? ''));
                    if ($message === '' && ! $classifier->isUnknown()) {
                        $message = $classifier->message;
                    }
                    $errors[] = "Digiflazz {$cmd} price-list RC {$classifier->code}"
                        .($message !== '' ? ": {$message}" : '');
                    continue;
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

                // Only mark this list_type as successfully observed when Digiflazz returned a data array.
                $seenSkusByListType[$cmd] = array_values(array_unique($seenForCmd));
            } catch (\Throwable $e) {
                Log::error('Digiflazz catalog sync fetch failed', [
                    'cmd' => $cmd,
                    'message' => $e->getMessage(),
                ]);
                $errors[] = "{$cmd}: " . $e->getMessage();
            }
        }

        if (empty($normalized) && !empty($errors)) {
            $result = $this->persistSyncMeta([
                'status' => 'failed',
                'message' => implode(' | ', $errors),
                'synced_count' => 0,
                'failed_count' => count($errors),
            ]);

            throw new \RuntimeException($result['message']);
        }

        $products = array_values($normalized);
        $this->providerRepository->syncWithDigiflazz($products, $seenSkusByListType);

        Cache::forget('digiflazz_balance');
        // Invalidate User Dashboard catalog caches immediately after sync.
        \App\Services\ProductProviders\ProductCatalogCache::bump();

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
     * Normalize Digiflazz price-list row to the shape expected by ProviderRepository::syncWithDigiflazz.
     * Includes official Digiflazz prepaid + pasca fields without changing GurkyNet pricing inputs.
     *
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

    /**
     * Persist sync metadata into settings (single source for Operations / Owner dashboards).
     */
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
