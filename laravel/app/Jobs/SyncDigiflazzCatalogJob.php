<?php

namespace App\Jobs;

use App\Actions\Admin\Operations\SyncDigiflazzCatalogAction;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncDigiflazzCatalogJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 300;

    /**
     * @param  array{cmd?: string|string[]}  $options
     */
    public function __construct(
        public array $options = []
    ) {}

    public function handle(SyncDigiflazzCatalogAction $action): void
    {
        try {
            $result = $action->execute($this->options);
            Log::info('Digiflazz catalog sync job completed', $result);
        } catch (\Throwable $e) {
            Log::error('Digiflazz catalog sync job failed', [
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
