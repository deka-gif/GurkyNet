<?php

namespace App\Console\Commands;

use App\Services\Integration\IntegrationService;
use Illuminate\Console\Command;

class IntegrationSyncBalancesCommand extends Command
{
    protected $signature = 'integration:sync-balances {--force : Bypass rate limit}';

    protected $description = 'Sync Digiflazz/VIP provider balances via IntegrationService (rate-limited 10m)';

    public function handle(IntegrationService $integration): int
    {
        $result = $integration->syncBalances((bool) $this->option('force'));
        if ($result['skipped'] ?? false) {
            $this->warn($result['reason'] ?? 'Skipped');

            return self::SUCCESS;
        }
        $this->info('Synced '.count($result['rows'] ?? []).' provider balances.');

        return self::SUCCESS;
    }
}
