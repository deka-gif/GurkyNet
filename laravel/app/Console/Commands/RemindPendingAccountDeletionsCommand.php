<?php

namespace App\Console\Commands;

use App\Services\AccountDeletion\AccountDeletionService;
use Illuminate\Console\Command;

class RemindPendingAccountDeletionsCommand extends Command
{
    protected $signature = 'accounts:remind-pending-deletions';

    protected $description = 'Send H-7 and H-1 account deletion reminders (once per stage).';

    public function handle(AccountDeletionService $service): int
    {
        $sent = $service->sendDueReminders();
        $this->info('Reminders sent H-7='.$sent['h7'].' H-1='.$sent['h1']);

        return self::SUCCESS;
    }
}
