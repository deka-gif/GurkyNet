<?php

namespace App\Console\Commands;

use App\Services\Integration\IntegrationService;
use Illuminate\Console\Command;

class IntegrationHealthProbeCommand extends Command
{
    protected $signature = 'integration:health-probe {--force : Bypass rate limit}';

    protected $description = 'Probe product provider health via IntegrationService (rate-limited 1m)';

    public function handle(IntegrationService $integration): int
    {
        $result = $integration->probeHealth((bool) $this->option('force'));
        if ($result['skipped'] ?? false) {
            $this->warn($result['reason'] ?? 'Skipped');

            return self::SUCCESS;
        }
        $this->info('Provider health probed.');

        return self::SUCCESS;
    }
}
