<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class IntegrationRetryFailedCommand extends Command
{
    protected $signature = 'integration:retry-failed';

    protected $description = 'Retry failed sync hygiene — prune stale locks / requeue reconcile (every 15m)';

    public function handle(): int
    {
        // Soft retry: re-run pending transaction reconcile once
        Artisan::call('transactions:reconcile-pending');
        $this->info(trim(Artisan::output()) ?: 'Reconcile invoked.');

        if (Schema::hasTable('failed_jobs')) {
            $count = (int) DB::table('failed_jobs')->count();
            $this->line("failed_jobs count: {$count}");
        }

        return self::SUCCESS;
    }
}
