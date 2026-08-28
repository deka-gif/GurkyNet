<?php

namespace App\Jobs;

use App\Actions\Admin\Operations\SyncVipCatalogAction;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Standalone queued VIPayment catalog sync — mirrors SyncDigiflazzCatalogJob for
 * command/job parity between the two providers (Phase 4).
 */
class SyncVipCatalogJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 300;

    /**
     * @param  array{include_game?: bool}  $options
     */
    public function __construct(
        public array $options = []
    ) {}

    public function handle(SyncVipCatalogAction $action): void
    {
        try {
            $options = $this->options;
            $options['triggered_by'] = $options['triggered_by'] ?? 'queued';
            $result = $action->execute($options);
            Log::info('VIP catalog sync job completed', $result);
        } catch (\Throwable $e) {
            Log::error('VIP catalog sync job failed', [
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
