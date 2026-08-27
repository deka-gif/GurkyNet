<?php

namespace App\Console\Commands;

use App\Services\Loyalty\LoyaltyPointService;
use Illuminate\Console\Command;

/** FR-DIFF-01 — expire loyalty point batches older than 12 months. */
class ExpireLoyaltyPointsCommand extends Command
{
    protected $signature = 'loyalty:expire-points {--user= : Optional user id}';

    protected $description = 'Expire loyalty points past 12-month earn window (FR-DIFF-01)';

    public function handle(LoyaltyPointService $loyalty): int
    {
        $userId = $this->option('user') !== null ? (int) $this->option('user') : null;
        $count = $loyalty->expirePoints($userId);
        $this->info("Expired batches processed: {$count}");

        return self::SUCCESS;
    }
}
