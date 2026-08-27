<?php

namespace App\Console\Commands;

use App\Services\Finance\Reconciliation\DailyClosingService;
use App\Services\Finance\Reconciliation\InternalWalletReconciliationService;
use App\Services\Finance\Reconciliation\MidtransReconciliationService;
use App\Services\Finance\Reconciliation\ProviderDailyReconciliationService;
use Illuminate\Console\Command;

/**
 * Sprint 7 / SRS Bagian 18 — reconciliation job runner.
 */
class RunReconciliationCommand extends Command
{
    protected $signature = 'finance:reconcile
        {mode : internal|provider|midtrans|midtrans-pending|closing|all}
        {--date= : Optional Y-m-d for daily jobs}';

    protected $description = 'Run zero-loss reconciliation jobs (SRS Bagian 18)';

    public function handle(
        InternalWalletReconciliationService $internal,
        ProviderDailyReconciliationService $provider,
        MidtransReconciliationService $midtrans,
        DailyClosingService $closing
    ): int {
        $mode = $this->argument('mode');
        $date = $this->option('date') ? new \DateTimeImmutable((string) $this->option('date')) : null;

        $result = match ($mode) {
            'internal' => $internal->run(),
            'provider' => $provider->run($date),
            'midtrans' => $midtrans->runDailySettlement($date),
            'midtrans-pending' => $midtrans->pollPendingDeposits(),
            'closing' => ['closing_id' => $closing->run($date)->id],
            'all' => [
                'internal' => $internal->run(),
                'provider' => $provider->run($date),
                'midtrans' => $midtrans->runDailySettlement($date),
            ],
            default => null,
        };

        if ($result === null) {
            $this->error('Unknown mode. Use internal|provider|midtrans|midtrans-pending|closing|all');

            return self::FAILURE;
        }

        $this->info(json_encode($result, JSON_PRETTY_PRINT));

        return self::SUCCESS;
    }
}
