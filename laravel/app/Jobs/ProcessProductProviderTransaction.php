<?php

namespace App\Jobs;

use App\Models\Transaction;
use App\Services\ProductProviders\ProductProviderFulfillmentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Multi Product Provider fulfillment job (Digiflazz + VipPulsa + future).
 * Replaces hardwired Digiflazz-only dispatch while preserving Digiflazz behavior
 * when Digiflazz is the selected / only enabled provider.
 */
class ProcessProductProviderTransaction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $transactionId;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [30, 60, 120];

    public int $timeout = 120;

    public function __construct(int $transactionId)
    {
        $this->transactionId = $transactionId;
    }

    public function handle(ProductProviderFulfillmentService $fulfillment): void
    {
        $transaction = Transaction::with(['items', 'user'])->find($this->transactionId);
        if (!$transaction) {
            Log::error('ProcessProductProviderTransaction: Transaction not found', [
                'id' => $this->transactionId,
            ]);

            return;
        }

        $fulfillment->fulfill($transaction);
    }

    public function failed(?\Throwable $exception): void
    {
        $transaction = Transaction::with('user')->find($this->transactionId);
        if (!$transaction) {
            return;
        }

        app(ProductProviderFulfillmentService::class)->onJobExhausted($transaction, $exception);

        Log::error('ProcessProductProviderTransaction permanently failed', [
            'transaction_id' => $this->transactionId,
            'error' => $exception?->getMessage(),
        ]);
    }
}
