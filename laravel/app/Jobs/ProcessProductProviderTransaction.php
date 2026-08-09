<?php

namespace App\Jobs;

use App\Models\Transaction;
use App\Services\ProductProviders\ProductProviderFulfillmentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Multi Product Provider fulfillment job (Digiflazz + VipPulsa + future).
 * Replaces hardwired Digiflazz-only dispatch while preserving Digiflazz behavior
 * when Digiflazz is the selected / only enabled provider.
 *
 * Sprint 3 (SRS 15.3) — ShouldBeUnique (keyed by transaction id) prevents two queued
 * instances of this job from ever running concurrently for the same transaction, on top
 * of the atomic `provider_dispatch_started_at` claim inside ProductProviderFulfillmentService.
 */
class ProcessProductProviderTransaction implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $transactionId;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [30, 60, 120];

    public int $timeout = 120;

    /**
     * Unique lock lifetime — matches $timeout so the lock never outlives a single attempt.
     */
    public int $uniqueFor = 120;

    public function __construct(int $transactionId)
    {
        $this->transactionId = $transactionId;
    }

    public function uniqueId(): string
    {
        return (string) $this->transactionId;
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
