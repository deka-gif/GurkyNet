<?php

namespace App\Listeners;

use App\Events\TransactionSuccess;
use App\Services\Loyalty\LoyaltyPointService;
use Illuminate\Support\Facades\Log;

/** FR-DIFF-01 — award points on SUCCESS product purchase (idempotent). */
class AwardLoyaltyPoints
{
    public function __construct(
        protected LoyaltyPointService $loyalty
    ) {}

    public function handle(TransactionSuccess $event): void
    {
        try {
            $this->loyalty->awardForSuccessfulTransaction($event->transaction);
        } catch (\Throwable $e) {
            Log::error('AwardLoyaltyPoints failed', [
                'transaction_id' => $event->transaction->id ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
