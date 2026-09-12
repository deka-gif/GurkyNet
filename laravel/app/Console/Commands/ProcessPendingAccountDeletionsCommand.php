<?php

namespace App\Console\Commands;

use App\Services\AccountDeletion\AccountDeletionService;
use Illuminate\Console\Command;

class ProcessPendingAccountDeletionsCommand extends Command
{
    protected $signature = 'accounts:process-pending-deletions {--limit=100 : Max accounts per run}';

    protected $description = 'Anonymize + soft-delete customer accounts past 30-day deletion grace (idempotent).';

    public function handle(AccountDeletionService $service): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $done = $service->processDuePurges($limit);
        $this->info("Processed {$done} account deletion(s).");

        return self::SUCCESS;
    }
}
