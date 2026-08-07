<?php

namespace App\Actions\Admin\Operations;

use App\Exceptions\ProviderCatalogException;
use App\Jobs\SyncDigiflazzCatalogJob;
use App\Models\ActivityLog;
use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
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
     * Digiflazz RC83: full pricelist may only be requested once per ~5 minutes.
     * Calling prepaid + pasca back-to-back often rate-limits the second cmd — we fetch
     * sequentially, keep prior DB for failed cmds, and never treat RC as empty success.
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

        $digiflazzProvider = ProductProvider::digiflazz();
        $dbBefore = $digiflazzProvider
            ? ProductProviderSku::where('product_provider_id', $digiflazzProvider->id)->count()
            : 0;
        $dbActiveBefore = $digiflazzProvider
            ? ProductProviderSku::where('product_provider_id', $digiflazzProvider->id)->where('is_active', true)->count()
            : 0;

        $cmds = $options['cmd'] ?? ['prepaid'];
        if (!is_array($cmds)) {
            $cmds = [$cmds];
        }
        // Digiflazz RC83: full pricelist ≈1x / 5 minutes. Calling prepaid + pasca in one
        // request almost always rate-limits the second cmd (root cause of 72→62 gaps).
        // Default is prepaid-only; multi-cmd defers remaining cmds ≥5 minutes unless
        // inline_all_cmds=true (tests / explicit override).
        $cmds = array_values(array_unique(array_map('strval', $cmds)));
        $cmdsRequested = $cmds;
        $deferredCmds = [];
        $inlineAll = (bool) ($options['inline_all_cmds'] ?? false)
            || app()->environment('testing');
        if (! $inlineAll && count($cmds) > 1) {
            $deferredCmds = array_values(array_slice($cmds, 1));
            $cmds = [$cmds[0]];
        }

        $normalized = [];
        $seenSkusByListType = [];
        $errors = [];
        $rateLimited = null;
        $pipeline = [
            'endpoint' => 'POST https://api.digiflazz.com/v1/price-list',
            'payload_template' => ['cmd' => '(prepaid|pasca)', 'username' => '***', 'sign' => 'md5(username+apiKey+pricelist)'],
            'filters_applied' => 'none (full catalog; no category/brand/type/code filter)',
            'cmds_requested' => $cmdsRequested,
            'cmds_inline' => $cmds,
            'cmds_deferred' => $deferredCmds,
            'per_cmd' => [],
            'database_total_before' => $dbBefore,
            'database_active_before' => $dbActiveBefore,
        ];

        $totalResponseRows = 0;
        $skippedNoSku = 0;
        $skippedNotArray = 0;
        $duplicateSkuOverwrites = 0;
        $activeFromProvider = 0;
        $inactiveFromProvider = 0;

        foreach ($cmds as $cmdIndex => $cmd) {
            $cmd = (string) $cmd;
            $attempt = 0;
            $maxAttempts = 2;
            $cmdStats = [
                'cmd' => $cmd,
                'fetched' => false,
                'total_response' => 0,
                'after_filtering' => 0,
                'skipped_no_sku' => 0,
                'skipped_not_array' => 0,
                'active' => 0,
                'inactive' => 0,
                'rc' => null,
                'error' => null,
            ];

            // Digiflazz rate-limits full pricelist (~1x / 5 min). Spacing helps when
            // prepaid + pasca are requested together, but cannot guarantee both succeed.
            if ($cmdIndex > 0 && ! app()->environment('testing')) {
                usleep(1_500_000);
            }

            while ($attempt < $maxAttempts) {
                $attempt++;
                try {
                    Log::info('Digiflazz catalog sync — fetching', [
                        'cmd' => $cmd,
                        'attempt' => $attempt,
                        'endpoint' => '/price-list',
                        'filters' => 'none',
                    ]);

                    $response = $this->digiflazzService->fetchPriceList($cmd);
                    $rows = $response['data'] ?? null;

                    if (!is_array($rows)) {
                        $cmdStats['error'] = 'no data array';
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
                        $cmdStats['rc'] = $classifier->code;
                        $cmdStats['error'] = $message !== '' ? $message : 'RC '.$classifier->code;

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
                            // Do NOT mark this list_type as fetched — keep previous DB rows.
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

                    if (! array_is_list($rows)) {
                        // Unexpected associative payload without RC — treat as failure, not empty wipe.
                        $cmdStats['error'] = 'non-list data without RC';
                        $errors[] = "Digiflazz {$cmd} price-list returned unexpected object payload.";
                        break;
                    }

                    $cmdStats['total_response'] = count($rows);
                    $totalResponseRows += count($rows);
                    $seenForCmd = [];

                    foreach ($rows as $row) {
                        if (!is_array($row)) {
                            $skippedNotArray++;
                            $cmdStats['skipped_not_array']++;
                            continue;
                        }

                        $sku = $row['buyer_sku_code'] ?? null;
                        if ($sku === null || $sku === '') {
                            $skippedNoSku++;
                            $cmdStats['skipped_no_sku']++;
                            continue;
                        }

                        $sku = (string) $sku;
                        if (isset($normalized[$sku])) {
                            $duplicateSkuOverwrites++;
                        }

                        $normalizedRow = $this->normalizeDigiflazzRow($row, $cmd);
                        $normalized[$sku] = $normalizedRow;
                        $seenForCmd[] = $sku;

                        if ($normalizedRow['buyer_product_status'] && $normalizedRow['seller_product_status']) {
                            $cmdStats['active']++;
                        } else {
                            $cmdStats['inactive']++;
                        }
                    }

                    $seenForCmd = array_values(array_unique($seenForCmd));
                    $seenSkusByListType[$cmd] = $seenForCmd;
                    $cmdStats['after_filtering'] = count($seenForCmd);
                    $cmdStats['fetched'] = true;

                    Log::info('Digiflazz catalog sync — cmd fetched', $cmdStats);
                    break;
                } catch (ProviderCatalogException $e) {
                    throw $e;
                } catch (\Throwable $e) {
                    Log::error('Digiflazz catalog sync fetch failed', [
                        'cmd' => $cmd,
                        'attempt' => $attempt,
                        'message' => $e->getMessage(),
                    ]);
                    $cmdStats['error'] = $e->getMessage();
                    if ($attempt < $maxAttempts) {
                        usleep(2_000_000);
                        continue;
                    }
                    $errors[] = "{$cmd}: " . $e->getMessage();
                    break;
                }
            }

            $pipeline['per_cmd'][] = $cmdStats;
        }

        foreach ($normalized as $row) {
            if (($row['buyer_product_status'] ?? false) && ($row['seller_product_status'] ?? false)) {
                $activeFromProvider++;
            } else {
                $inactiveFromProvider++;
            }
        }

        $pipeline['total_response'] = $totalResponseRows;
        $pipeline['after_filtering'] = count($normalized);
        $pipeline['skipped_no_sku'] = $skippedNoSku;
        $pipeline['skipped_not_array'] = $skippedNotArray;
        $pipeline['duplicate_sku_overwrites'] = $duplicateSkuOverwrites;
        $pipeline['active_from_provider'] = $activeFromProvider;
        $pipeline['inactive_from_provider'] = $inactiveFromProvider;
        $pipeline['cmds_fetched'] = array_keys($seenSkusByListType);

        Log::info('Digiflazz catalog sync — pipeline summary (pre-upsert)', $pipeline);

        if (empty($normalized) && !empty($errors)) {
            $result = $this->persistSyncMeta([
                'status' => 'failed',
                'message' => implode(' | ', $errors),
                'synced_count' => 0,
                'failed_count' => count($errors),
                'pipeline' => $pipeline,
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
        $digiflazzProvider = ProductProvider::digiflazz();
        $dbAfter = $digiflazzProvider
            ? ProductProviderSku::where('product_provider_id', $digiflazzProvider->id)->count()
            : 0;
        $dbActiveAfter = $digiflazzProvider
            ? ProductProviderSku::where('product_provider_id', $digiflazzProvider->id)->where('is_active', true)->count()
            : 0;

        $pipeline['inserted'] = $stats['inserted'] ?? 0;
        $pipeline['updated'] = $stats['updated'] ?? 0;
        $pipeline['disabled'] = $stats['disabled'] ?? 0;
        $pipeline['skipped'] = ($stats['skipped'] ?? 0) + $skippedNoSku + $skippedNotArray;
        $pipeline['database_total_after'] = $dbAfter;
        $pipeline['database_active_after'] = $dbActiveAfter;

        Log::info('Digiflazz catalog sync — pipeline summary (post-upsert)', [
            'Fetched from Digiflazz' => $pipeline['cmds_fetched'],
            'Total Response' => $pipeline['total_response'],
            'After Filtering' => $pipeline['after_filtering'],
            'Active From Provider' => $activeFromProvider,
            'Inactive From Provider' => $inactiveFromProvider,
            'Inserted' => $pipeline['inserted'],
            'Updated' => $pipeline['updated'],
            'Disabled' => $pipeline['disabled'],
            'Skipped' => $pipeline['skipped'],
            'Database Total Before' => $dbBefore,
            'Database Active Before' => $dbActiveBefore,
            'Database Total After' => $dbAfter,
            'Database Active After' => $dbActiveAfter,
            'per_cmd' => $pipeline['per_cmd'],
        ]);

        $deferredAt = null;
        if ($deferredCmds !== []) {
            $deferredAt = now()->addMinutes(5);
            SyncDigiflazzCatalogJob::dispatch([
                'cmd' => $deferredCmds,
                'inline_all_cmds' => count($deferredCmds) <= 1,
            ])->delay($deferredAt);
            $pipeline['deferred_cmds'] = $deferredCmds;
            $pipeline['deferred_at'] = $deferredAt->toIso8601String();
            Log::info('Digiflazz catalog sync — deferred cmds scheduled (RC83 window)', [
                'cmds' => $deferredCmds,
                'deferred_at' => $pipeline['deferred_at'],
            ]);
        }

        $message = empty($errors)
            ? sprintf(
                'Digiflazz catalog synchronized. Provider active=%d, DB active=%d (rows=%d).',
                $activeFromProvider,
                $dbActiveAfter,
                $dbAfter
            )
            : 'Catalog synced with warnings: ' . implode(' | ', $errors);
        if ($deferredCmds !== []) {
            $message .= ' Deferred cmd(s) ['.implode(', ', $deferredCmds).'] scheduled at '
                .($pipeline['deferred_at'] ?? '≈5m').' to avoid Digiflazz RC83.';
        }

        // Provider SKU for ops audit = Digiflazz "aktif" (buyer∧seller), not raw row count.
        $providerSkuTotal = $activeFromProvider;
        $databaseSkuTotal = $dbActiveAfter;

        $result = $this->persistSyncMeta([
            'status' => empty($errors) ? 'success' : 'partial',
            'message' => $message,
            'synced_count' => count($products),
            'failed_count' => count($errors),
            'product_count' => Product::count(),
            'provider_count' => Provider::count(),
            'digiflazz_product_count' => DigiflazzProduct::count(),
            'inserted' => $stats['inserted'] ?? 0,
            'updated' => $stats['updated'] ?? 0,
            'skipped' => $pipeline['skipped'],
            'disabled' => $stats['disabled'] ?? 0,
            'provider_sku_total' => $providerSkuTotal,
            'provider_sku_raw_total' => count($products),
            'database_sku_total' => $databaseSkuTotal,
            'database_sku_rows_total' => $dbAfter,
            'difference' => $providerSkuTotal - $databaseSkuTotal,
            'duration_ms' => $durationMs,
            'duration_sec' => round($durationMs / 1000, 1),
            'next_recommended_sync_at' => ($deferredAt ?? now()->addMinutes(30))->toIso8601String(),
            'pipeline' => $pipeline,
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
                'pipeline' => $payload['pipeline'] ?? null,
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
