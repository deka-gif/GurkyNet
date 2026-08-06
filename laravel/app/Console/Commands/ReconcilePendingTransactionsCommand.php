<?php

namespace App\Console\Commands;

use App\Services\Transactions\TransactionTimeoutService;
use Illuminate\Console\Command;

/**
 * Safety net when delayed jobs were lost (queue restart). Re-dispatches final checks.
 */
class ReconcilePendingTransactionsCommand extends Command
{
    protected $signature = 'transactions:reconcile-pending {--limit=100}';

    protected $description = 'Re-queue overdue pending/processing PPOB transactions for timeout settlement';

    public function handle(TransactionTimeoutService $timeoutService): int
    {
        $count = $timeoutService->reconcileOverdue((int) $this->option('limit'));
        $this->info("Dispatched timeout checks for {$count} overdue transaction(s).");

        return self::SUCCESS;
    }
}
