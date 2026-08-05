<?php

namespace App\Console\Commands;

use App\Actions\Admin\Operations\SyncDigiflazzCatalogAction;
use App\Jobs\SyncDigiflazzCatalogJob;
use Illuminate\Console\Command;

class SyncDigiflazzCatalogCommand extends Command
{
    protected $signature = 'digiflazz:sync
                            {--cmd=* : Price-list commands to sync (prepaid, pasca). Defaults to both.}
                            {--queue : Dispatch sync to the queue instead of running inline}';

    protected $description = 'Synchronize Digiflazz product catalog (prices, availability, status) into the master products table';

    public function handle(SyncDigiflazzCatalogAction $action): int
    {
        $cmds = $this->option('cmd');
        if (empty($cmds)) {
            $cmds = ['prepaid', 'pasca'];
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
            $this->table(
                ['Metric', 'Value'],
                [
                    ['Status', $result['status'] ?? '-'],
                    ['Synced SKUs', $result['synced_count'] ?? 0],
                    ['Failed batches', $result['failed_count'] ?? 0],
                    ['Master products', $result['product_count'] ?? '-'],
                    ['Providers', $result['provider_count'] ?? '-'],
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
