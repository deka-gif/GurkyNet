<?php

namespace App\Actions\Admin\Operations;

use App\Exceptions\ProviderCatalogException;
use App\Models\ActivityLog;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Services\ProductProviders\AutomaticCatalogSyncService;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Nightly (or on-demand) orchestrator:
 * Digiflazz prepaid → Digiflazz cooldown → Digiflazz pasca → VIPayment.
 *
 * Manual Sync Now on Control Center remains independent.
 */
class RunAutomaticCatalogSyncAction
{
    public function __construct(
        protected AutomaticCatalogSyncService $autoSync,
        protected SyncDigiflazzCatalogAction $syncDigiflazz,
        protected SyncVipCatalogAction $syncVip,
    ) {}

    /**
     * @param  array{force?:bool, source?:string}  $options
     * @return array<string, mixed>
     */
    public function execute(array $options = []): array
    {
        $cfg = $this->autoSync->resolvedConfig();
        $source = (string) ($options['source'] ?? 'scheduler');
        $force = (bool) ($options['force'] ?? false);
        $triggeredBy = $source === 'scheduler' ? 'scheduled' : $source;

        if (! $cfg['enabled'] && ! $force) {
            return [
                'status' => 'skipped',
                'message' => 'Automatic catalog sync is disabled.',
                'autoSync' => $this->autoSync->statusPayload(),
            ];
        }

        if (! $this->autoSync->acquireLock()) {
            return [
                'status' => 'skipped',
                'message' => 'Automatic catalog sync already running.',
                'autoSync' => $this->autoSync->statusPayload(),
            ];
        }

        $startedAt = now();
        $steps = [];
        $providerResults = [];
        $overallOk = true;
        $lastError = null;

        $this->autoSync->patchState([
            'status' => 'running',
            'source' => $source,
            'started_at' => $startedAt->toIso8601String(),
            'finished_at' => null,
            'duration_sec' => null,
            'step' => 'Starting Automatic Synchronization...',
            'steps' => $steps,
            'providers' => [],
            'last_error' => null,
            'message' => null,
        ]);

        ActivityLog::create([
            'user_id' => null,
            'activity' => 'AUTO_PRODUCT_PROVIDER_SYNC_STARTED',
            'payload' => [
                'source' => $source,
                'started_at' => $startedAt->toIso8601String(),
                'schedule' => $cfg['daily_at'],
                'providers' => $cfg['providers'],
            ],
        ]);

        try {
            if (in_array('digiflazz', $cfg['providers'], true)) {
                $prepaid = $this->runWithRetry(
                    label: 'Digiflazz Prepaid',
                    step: 'Synchronizing Digiflazz Prepaid...',
                    steps: $steps,
                    fn: fn () => $this->syncDigiflazz->execute([
                        'cmd' => ['prepaid'],
                        'inline_all_cmds' => true,
                        'source' => 'auto_sync',
                        'triggered_by' => $triggeredBy,
                    ]),
                    retryable: true
                );
                $steps = $prepaid['steps'];
                $providerResults['digiflazz_prepaid'] = $prepaid['result'];
                if (! $prepaid['ok']) {
                    $overallOk = false;
                    $lastError = $prepaid['error'];
                    $providerResults['digiflazz'] = [
                        'status' => 'failed',
                        'stage' => 'prepaid',
                        'error' => $prepaid['error'],
                        'provider_code' => $prepaid['provider_code'] ?? null,
                        'retry_at' => $prepaid['retry_at'] ?? null,
                    ];
                } else {
                    $this->setStep('Waiting Digiflazz cooldown (RC83 window)...', $steps);
                    $this->cooldown($cfg['digiflazz_cooldown_minutes']);

                    $pasca = $this->runWithRetry(
                        label: 'Digiflazz Pascabayar',
                        step: 'Synchronizing Digiflazz Pascabayar...',
                        steps: $steps,
                        fn: fn () => $this->syncDigiflazz->execute([
                            'cmd' => ['pasca'],
                            'inline_all_cmds' => true,
                            'source' => 'auto_sync',
                            'triggered_by' => $triggeredBy,
                        ]),
                        retryable: true
                    );
                    $steps = $pasca['steps'];
                    $providerResults['digiflazz_pasca'] = $pasca['result'];

                    if (! $pasca['ok']) {
                        $overallOk = false;
                        $lastError = $pasca['error'];
                        $providerResults['digiflazz'] = [
                            'status' => 'partial',
                            'stage' => 'pasca',
                            'prepaid' => 'success',
                            'error' => $pasca['error'],
                            'provider_code' => $pasca['provider_code'] ?? null,
                            'retry_at' => $pasca['retry_at'] ?? null,
                            'provider_sku_total' => $prepaid['result']['provider_sku_total'] ?? null,
                            'database_sku_total' => $prepaid['result']['database_sku_total'] ?? null,
                            'duration_sec' => ($prepaid['result']['duration_sec'] ?? 0)
                                + ($pasca['result']['duration_sec'] ?? 0),
                        ];
                    } else {
                        $digi = ProductProvider::digiflazz();
                        $dbActive = $digi
                            ? ProductProviderSku::where('product_provider_id', $digi->id)->where('is_active', true)->count()
                            : 0;
                        $providerResults['digiflazz'] = [
                            'status' => 'success',
                            // After prepaid+pasca, active DB SKUs are the authoritative parity figure.
                            'provider_sku_total' => $dbActive,
                            'database_sku_total' => $dbActive,
                            'duration_sec' => round(
                                (float) ($prepaid['result']['duration_sec'] ?? 0)
                                + (float) ($pasca['result']['duration_sec'] ?? 0),
                                1
                            ),
                        ];
                    }
                }
            }

            if (in_array('vip', $cfg['providers'], true)) {
                $vip = $this->runWithRetry(
                    label: 'VIPayment',
                    step: 'Synchronizing VIPayment...',
                    steps: $steps,
                    fn: fn () => $this->syncVip->execute([
                        'include_game' => true,
                        'source' => 'auto_sync',
                        'triggered_by' => $triggeredBy,
                    ]),
                    retryable: true
                );
                $steps = $vip['steps'];

                if (! $vip['ok']) {
                    $overallOk = false;
                    $lastError = $vip['error'];
                    $providerResults['vip'] = [
                        'status' => 'failed',
                        'error' => $vip['error'],
                        'provider_code' => $vip['provider_code'] ?? null,
                        'retry_at' => $vip['retry_at'] ?? null,
                    ];
                } else {
                    $vipProvider = ProductProvider::vip();
                    $dbActive = $vipProvider
                        ? ProductProviderSku::where('product_provider_id', $vipProvider->id)->where('is_active', true)->count()
                        : (int) ($vip['result']['product_count'] ?? 0);
                    $providerResults['vip'] = [
                        'status' => 'success',
                        'provider_sku_total' => $dbActive,
                        'database_sku_total' => $dbActive,
                        'imported' => $vip['result']['imported'] ?? 0,
                        'updated' => $vip['result']['updated'] ?? 0,
                        'skipped' => $vip['result']['skipped'] ?? 0,
                        'duration_sec' => isset($vip['result']['api_latency_ms'])
                            ? round(((int) $vip['result']['api_latency_ms']) / 1000, 1)
                            : null,
                    ];
                }
            }

            $this->setStep('Updating Database...', $steps);
            $this->setStep('Finishing Automatic Synchronization...', $steps);

            $finishedAt = now();
            $durationSec = round($finishedAt->diffInMilliseconds($startedAt) / 1000, 1);
            $status = $overallOk ? 'success' : 'failed';
            $message = $overallOk
                ? 'Automatic Synchronization completed successfully.'
                : ('Automatic Synchronization finished with failures: '.($lastError ?? 'unknown'));

            $this->autoSync->patchState([
                'status' => $status,
                'last_status' => $status,
                'finished_at' => $finishedAt->toIso8601String(),
                'duration_sec' => $durationSec,
                'step' => null,
                'steps' => $steps,
                'providers' => $providerResults,
                'last_error' => $lastError,
                'message' => $message,
            ]);

            ActivityLog::create([
                'user_id' => null,
                'activity' => $overallOk
                    ? 'AUTO_PRODUCT_PROVIDER_SYNC_FINISHED'
                    : 'AUTO_PRODUCT_PROVIDER_SYNC_FAILED',
                'payload' => [
                    'source' => $source,
                    'started_at' => $startedAt->toIso8601String(),
                    'finished_at' => $finishedAt->toIso8601String(),
                    'duration_sec' => $durationSec,
                    'status' => $status,
                    'providers' => [
                        'digiflazz' => $providerResults['digiflazz']['status'] ?? 'skipped',
                        'vip' => $providerResults['vip']['status'] ?? 'skipped',
                    ],
                    'details' => $providerResults,
                    'error' => $lastError,
                ],
            ]);

            Log::info('Automatic catalog sync finished', [
                'status' => $status,
                'duration_sec' => $durationSec,
                'providers' => $providerResults,
            ]);

            return [
                'status' => $status,
                'message' => $message,
                'duration_sec' => $durationSec,
                'providers' => $providerResults,
                'autoSync' => $this->autoSync->statusPayload(),
            ];
        } catch (Throwable $e) {
            $finishedAt = now();
            $durationSec = round($finishedAt->diffInMilliseconds($startedAt) / 1000, 1);
            $this->autoSync->patchState([
                'status' => 'failed',
                'last_status' => 'failed',
                'finished_at' => $finishedAt->toIso8601String(),
                'duration_sec' => $durationSec,
                'step' => null,
                'steps' => $steps,
                'providers' => $providerResults,
                'last_error' => $e->getMessage(),
                'message' => 'Automatic Synchronization crashed: '.$e->getMessage(),
            ]);

            ActivityLog::create([
                'user_id' => null,
                'activity' => 'AUTO_PRODUCT_PROVIDER_SYNC_FAILED',
                'payload' => [
                    'source' => $source,
                    'started_at' => $startedAt->toIso8601String(),
                    'finished_at' => $finishedAt->toIso8601String(),
                    'duration_sec' => $durationSec,
                    'error' => $e->getMessage(),
                    'details' => $providerResults,
                ],
            ]);

            Log::error('Automatic catalog sync crashed', [
                'message' => $e->getMessage(),
            ]);

            throw $e;
        } finally {
            $this->autoSync->releaseLock();
        }
    }

    /**
     * @param  list<array<string, mixed>>  $steps
     * @return array{ok:bool, result:?array, error:?string, provider_code:?string, retry_at:?string, steps:list<array<string, mixed>>}
     */
    protected function runWithRetry(
        string $label,
        string $step,
        array $steps,
        callable $fn,
        bool $retryable = true
    ): array {
        $cfg = $this->autoSync->resolvedConfig();
        $maxAttempts = 1 + (int) $cfg['max_retries'];
        $delay = (int) $cfg['retry_delay_seconds'];
        if (app()->environment('testing')) {
            $delay = 0;
        }

        $attempt = 0;
        $lastError = null;
        $providerCode = null;
        $lastResult = null;

        while ($attempt < $maxAttempts) {
            $attempt++;
            $this->setStep($step.($attempt > 1 ? " (retry {$attempt}/{$maxAttempts})" : ''), $steps);

            try {
                $lastResult = $fn();
                $steps[] = [
                    'label' => $label,
                    'status' => 'success',
                    'attempt' => $attempt,
                    'at' => now()->toIso8601String(),
                ];
                $this->autoSync->patchState(['steps' => $steps, 'step' => $step]);

                return [
                    'ok' => true,
                    'result' => is_array($lastResult) ? $lastResult : [],
                    'error' => null,
                    'provider_code' => null,
                    'retry_at' => null,
                    'steps' => $steps,
                ];
            } catch (ProviderCatalogException $e) {
                $lastError = $e->getMessage();
                $providerCode = $e->providerCode;
                $canRetry = $retryable && $e->retryable && $attempt < $maxAttempts;
                Log::warning('Automatic catalog sync step failed', [
                    'label' => $label,
                    'attempt' => $attempt,
                    'provider_code' => $providerCode,
                    'retry' => $canRetry,
                    'message' => $lastError,
                ]);

                if ($canRetry) {
                    $retryAt = now()->addSeconds($delay);
                    $this->setStep(
                        "Retry {$label} at ".$retryAt->timezone($cfg['timezone'])->format('H:i').'...',
                        $steps
                    );
                    if ($delay > 0) {
                        sleep($delay);
                    }
                    continue;
                }

                $steps[] = [
                    'label' => $label,
                    'status' => 'failed',
                    'attempt' => $attempt,
                    'error' => $lastError,
                    'provider_code' => $providerCode,
                    'at' => now()->toIso8601String(),
                ];

                return [
                    'ok' => false,
                    'result' => is_array($lastResult) ? $lastResult : null,
                    'error' => $lastError,
                    'provider_code' => $providerCode,
                    'retry_at' => null,
                    'steps' => $steps,
                ];
            } catch (Throwable $e) {
                $lastError = $e->getMessage();
                $isTransient = $this->isTransientError($e);
                $canRetry = $retryable && $isTransient && $attempt < $maxAttempts;

                Log::warning('Automatic catalog sync step exception', [
                    'label' => $label,
                    'attempt' => $attempt,
                    'retry' => $canRetry,
                    'message' => $lastError,
                ]);

                if ($canRetry) {
                    $retryAt = now()->addSeconds($delay);
                    $this->setStep(
                        "Retry {$label} at ".$retryAt->timezone($cfg['timezone'])->format('H:i').'...',
                        $steps
                    );
                    if ($delay > 0) {
                        sleep($delay);
                    }
                    continue;
                }

                $steps[] = [
                    'label' => $label,
                    'status' => 'failed',
                    'attempt' => $attempt,
                    'error' => $lastError,
                    'at' => now()->toIso8601String(),
                ];

                return [
                    'ok' => false,
                    'result' => null,
                    'error' => $lastError,
                    'provider_code' => null,
                    'retry_at' => null,
                    'steps' => $steps,
                ];
            }
        }

        return [
            'ok' => false,
            'result' => null,
            'error' => $lastError ?? 'Unknown failure',
            'provider_code' => $providerCode,
            'retry_at' => null,
            'steps' => $steps,
        ];
    }

    protected function isTransientError(Throwable $e): bool
    {
        $msg = strtolower($e->getMessage());

        return str_contains($msg, 'timeout')
            || str_contains($msg, 'timed out')
            || str_contains($msg, 'connection')
            || str_contains($msg, 'network')
            || str_contains($msg, 'rc83')
            || str_contains($msg, 'limitasi');
    }

    /**
     * @param  list<array<string, mixed>>  $steps
     */
    protected function setStep(string $step, array &$steps): void
    {
        $this->autoSync->patchState([
            'status' => 'running',
            'step' => $step,
            'steps' => $steps,
        ]);
    }

    protected function cooldown(int $minutes): void
    {
        if (app()->environment('testing')) {
            return;
        }

        $seconds = max(60, $minutes * 60);
        Log::info('Automatic catalog sync Digiflazz cooldown', [
            'seconds' => $seconds,
        ]);
        sleep($seconds);
    }
}
