<?php

namespace App\Console\Commands;

use App\Actions\Admin\Operations\RunAutomaticCatalogSyncAction;
use App\Jobs\RunAutomaticCatalogSyncJob;
use Illuminate\Console\Command;

class RunAutomaticCatalogSyncCommand extends Command
{
    protected $signature = 'ppob:catalog-auto-sync
                            {--force : Run even when automatic sync is disabled in config/settings}
                            {--queue : Dispatch to the queue instead of running inline}';

    protected $description = 'Automatic Digiflazz + VIPayment catalog synchronization (scheduler / production)';

    public function handle(RunAutomaticCatalogSyncAction $action): int
    {
        $options = [
            'force' => (bool) $this->option('force'),
            'source' => 'scheduler',
        ];

        if ($this->option('queue')) {
            RunAutomaticCatalogSyncJob::dispatch($options);
            $this->info('Automatic catalog sync job dispatched to the queue.');

            return self::SUCCESS;
        }

        $this->info('Starting Automatic Product Provider Synchronization...');

        try {
            $result = $action->execute($options);
            $status = (string) ($result['status'] ?? 'unknown');
            $this->info($result['message'] ?? 'Done.');

            $rows = [
                ['Status', $status],
                ['Duration (sec)', $result['duration_sec'] ?? '-'],
            ];
            foreach (($result['providers'] ?? []) as $code => $meta) {
                if (! is_array($meta) || ! isset($meta['status'])) {
                    continue;
                }
                if (in_array($code, ['digiflazz_prepaid', 'digiflazz_pasca'], true)) {
                    continue;
                }
                $rows[] = [
                    strtoupper((string) $code),
                    ($meta['status'] ?? '-').' | SKU '.($meta['provider_sku_total'] ?? '-').'/'.($meta['database_sku_total'] ?? '-'),
                ];
            }
            $this->table(['Metric', 'Value'], $rows);

            return in_array($status, ['failed'], true) ? self::FAILURE : self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Automatic catalog sync failed: '.$e->getMessage());

            return self::FAILURE;
        }
    }
}
