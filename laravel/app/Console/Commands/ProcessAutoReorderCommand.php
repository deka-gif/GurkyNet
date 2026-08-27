<?php

namespace App\Console\Commands;

use App\Services\Subscriptions\AutoReorderService;
use Illuminate\Console\Command;

/** FR-DIFF-02 — process due auto-reorder subscriptions (skips when PURCHASE_ENABLED=false). */
class ProcessAutoReorderCommand extends Command
{
    protected $signature = 'subscriptions:process-auto-reorder';

    protected $description = 'Process due FR-DIFF-02 auto-reorder subscriptions';

    public function handle(AutoReorderService $service): int
    {
        $stats = $service->processDue();
        $this->info('Auto-reorder: '.json_encode($stats));

        return self::SUCCESS;
    }
}
