<?php

namespace App\Jobs;

use App\Models\ApiWebhookDelivery;
use App\Services\PartnerApi\PartnerWebhookService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/** FR-API-07 — deliver partner webhook with scheduled retries. */
class DeliverPartnerWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public int $deliveryId) {}

    public function handle(PartnerWebhookService $webhooks): void
    {
        $delivery = ApiWebhookDelivery::find($this->deliveryId);
        if (! $delivery) {
            return;
        }
        $webhooks->attempt($delivery);
    }
}
