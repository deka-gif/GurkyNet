<?php

namespace App\Listeners;

use App\Events\TransactionFailed;
use App\Events\TransactionSuccess;
use App\Services\PartnerApi\PartnerWebhookService;

/** FR-API-07 — notify partner on final status (reuse existing events). */
class DispatchPartnerWebhook
{
    public function __construct(protected PartnerWebhookService $webhooks) {}

    public function handleSuccess(TransactionSuccess $event): void
    {
        $this->webhooks->queueForTransaction($event->transaction);
    }

    public function handleFailed(TransactionFailed $event): void
    {
        $this->webhooks->queueForTransaction($event->transaction);
    }
}
