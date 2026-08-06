<?php

namespace App\Jobs;

use App\Services\Transactions\TransactionTimeoutService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Async pending/processing watcher — never blocks HTTP.
 * Idempotent settlement (success/refund) makes duplicate polls safe.
 */
class WatchPendingTransactionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 60;

    public function __construct(
        public int $transactionId,
        public int $checkIndex = 0,
    ) {}

    public function handle(TransactionTimeoutService $timeoutService): void
    {
        Log::info('TX TIMEOUT — job handle / CHECK STATUS', [
            'transaction_id' => $this->transactionId,
            'check_index' => $this->checkIndex,
        ]);

        $timeoutService->handleCheck($this->transactionId, $this->checkIndex);
    }
}
