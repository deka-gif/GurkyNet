<?php

namespace App\Console\Commands;

use App\Actions\Admin\Operations\SyncVipCatalogAction;
use App\Jobs\SyncVipCatalogJob;
use Illuminate\Console\Command;

/**
 * Mirrors digiflazz:sync for command/job parity between the two providers (Phase 4)
 * — same pipeline shape (fetch → normalize → upsert → deactivate missing), no second
 * conceptually-different sync engine.
 */
class SyncVipCatalogCommand extends Command
{
    protected $signature = 'vip:sync
                            {--no-game : Skip the VIP game-feature catalog, sync prepaid only}
                            {--queue : Dispatch sync to the queue instead of running inline}';

    protected $description = 'Synchronize VIPayment product catalog (prices, availability, status) into the master products table';

    public function handle(SyncVipCatalogAction $action): int
    {
        $options = ['include_game' => ! $this->option('no-game')];

        if ($this->option('queue')) {
            SyncVipCatalogJob::dispatch($options);
            $this->info('VIP catalog sync job dispatched to the queue.');
            return self::SUCCESS;
        }

        $this->info('Starting VIP catalog sync...');

        try {
            $result = $action->execute($options);
            $this->info($result['message'] ?? 'Sync completed.');
            $this->table(
                ['Metric', 'Value'],
                [
                    ['Imported', $result['imported'] ?? 0],
                    ['Updated', $result['updated'] ?? 0],
                    ['Skipped', $result['skipped'] ?? 0],
                    ['Failed', $result['failed'] ?? 0],
                    ['Disabled', $result['disabled'] ?? 0],
                    ['Active DB SKUs', $result['product_count'] ?? '-'],
                ]
            );

            return ($result['failed'] ?? 0) > 0 ? self::FAILURE : self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('VIP sync failed: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
