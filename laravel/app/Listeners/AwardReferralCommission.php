<?php

namespace App\Listeners;

use App\Events\TransactionSuccess;
use App\Services\Referral\ReferralCommissionService;
use Illuminate\Support\Facades\Log;

/** SRS 31.4 / FR-REF-04 — award pending referral commission on SUCCESS (independent of loyalty). */
class AwardReferralCommission
{
    public function __construct(
        protected ReferralCommissionService $referral
    ) {}

    public function handle(TransactionSuccess $event): void
    {
        try {
            $this->referral->awardForSuccessfulTransaction($event->transaction);
        } catch (\Throwable $e) {
            Log::error('AwardReferralCommission failed', [
                'transaction_id' => $event->transaction->id ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
