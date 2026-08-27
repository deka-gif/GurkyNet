<?php

namespace App\Console\Commands;

use App\Jobs\DeliverPartnerWebhookJob;
use App\Models\ApiWebhookDelivery;
use Illuminate\Console\Command;

/** FR-API-07 — re-queue due partner webhook retries. */
class ProcessPartnerWebhookRetriesCommand extends Command
{
    protected $signature = 'partner-api:process-webhook-retries';

    protected $description = 'Dispatch due Partner H2H webhook deliveries (SRS 30 / FR-API-07)';

    public function handle(): int
    {
        $due = ApiWebhookDelivery::query()
            ->where('status', ApiWebhookDelivery::STATUS_PENDING)
            ->where(function ($q) {
                $q->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', now());
            })
            ->limit(100)
            ->get();

        foreach ($due as $row) {
            DeliverPartnerWebhookJob::dispatch($row->id);
        }

        $this->info('Dispatched '.$due->count().' webhook deliveries.');

        return self::SUCCESS;
    }
}
