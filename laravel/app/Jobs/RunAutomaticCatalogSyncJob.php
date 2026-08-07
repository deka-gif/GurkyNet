<?php

namespace App\Jobs;

use App\Actions\Admin\Operations\RunAutomaticCatalogSyncAction;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RunAutomaticCatalogSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    /** Digiflazz cooldown (~5m) + retries + VIP — allow long runtime. */
    public int $timeout = 1800;

    /**
     * @param  array{force?:bool, source?:string}  $options
     */
    public function __construct(
        public array $options = []
    ) {}

    public function handle(RunAutomaticCatalogSyncAction $action): void
    {
        try {
            $result = $action->execute($this->options);
            Log::info('Automatic catalog sync job completed', [
                'status' => $result['status'] ?? null,
                'duration_sec' => $result['duration_sec'] ?? null,
            ]);
        } catch (\Throwable $e) {
            Log::error('Automatic catalog sync job failed', [
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
