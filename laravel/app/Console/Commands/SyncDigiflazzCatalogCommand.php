<?php

namespace App\Console\Commands;

use App\Actions\Admin\Operations\SyncDigiflazzCatalogAction;
use App\Jobs\SyncDigiflazzCatalogJob;
use Illuminate\Console\Command;

class SyncDigiflazzCatalogCommand extends Command
{
    protected $signature = 'digiflazz:sync
                            {--cmd=* : Price-list commands to sync (prepaid, pasca). Defaults to prepaid. Multi-cmd defers remaining after 5m (RC83).}
                            {--queue : Dispatch sync to the queue instead of running inline}';

    protected $description = 'Synchronize Digiflazz product catalog (prices, availability, status) into the master products table';

    public function handle(SyncDigiflazzCatalogAction $action): int
    {
        $cmds = $this->option('cmd');
        if (empty($cmds)) {
            // Default prepaid-only: Digiflazz RC83 blocks a second full pricelist within ~5 minutes.
            $cmds = ['prepaid'];
        }

        $options = ['cmd' => $cmds];

        if ($this->option('queue')) {
            SyncDigiflazzCatalogJob::dispatch($options);
            $this->info('Digiflazz catalog sync job dispatched to the queue.');
            return self::SUCCESS;
        }

        $this->info('Starting Digiflazz catalog sync (' . implode(', ', $cmds) . ')...');

        try {
            $result = $action->execute($options);
            $this->info($result['message'] ?? 'Sync completed.');
            $pipeline = $result['pipeline'] ?? [];
            $this->table(
                ['Metric', 'Value'],
                [
                    ['Status', $result['status'] ?? '-'],
                    ['Total Response', $pipeline['total_response'] ?? '-'],
                    ['After Filtering', $pipeline['after_filtering'] ?? '-'],
                    ['Active (provider)', $result['provider_sku_total'] ?? '-'],
                    ['DB active', $result['database_sku_total'] ?? '-'],
                    ['DB rows', $result['database_sku_rows_total'] ?? '-'],
                    ['Inserted', $result['inserted'] ?? 0],
                    ['Updated', $result['updated'] ?? 0],
                    ['Disabled', $result['disabled'] ?? 0],
                    ['Skipped', $result['skipped'] ?? 0],
                    ['Difference', $result['difference'] ?? '-'],
                    ['Deferred cmds', implode(', ', $pipeline['cmds_deferred'] ?? []) ?: '-'],
                    ['Last sync', $result['last_sync_at'] ?? '-'],
                ]
            );

            return ($result['status'] ?? '') === 'failed' ? self::FAILURE : self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Digiflazz sync failed: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
