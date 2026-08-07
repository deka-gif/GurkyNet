<?php

namespace App\Console\Commands;

use App\Services\Integration\IntegrationService;
use Illuminate\Console\Command;

class IntegrationPaymentStatusCommand extends Command
{
    protected $signature = 'integration:payment-status {--force : Bypass rate limit}';

    protected $description = 'Probe payment gateway health + settlement signals (rate-limited 1m)';

    public function handle(IntegrationService $integration): int
    {
        $result = $integration->probePaymentGateways((bool) $this->option('force'));
        if ($result['skipped'] ?? false) {
            $this->warn($result['reason'] ?? 'Skipped');

            return self::SUCCESS;
        }
        $this->info('Payment gateways probed: '.count($result['gateways'] ?? []));

        return self::SUCCESS;
    }
}
