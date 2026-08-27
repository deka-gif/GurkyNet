<?php

namespace App\Services\PartnerApi;

use App\Jobs\DeliverPartnerWebhookJob;
use App\Models\ApiCredential;
use App\Models\ApiWebhookDelivery;
use App\Models\Transaction;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * FR-API-07 — signed outbound webhook; max 3 retries at 1m / 5m / 30m; idempotent event_key.
 */
class PartnerWebhookService
{
    public function __construct(
        protected PartnerAuthService $auth
    ) {}

    public function queueForTransaction(Transaction $transaction): void
    {
        if (($transaction->channel ?? null) !== 'partner_api' || ! $transaction->partner_id) {
            return;
        }

        // Sandbox: no production financial webhook side effects.
        if (data_get($transaction->provider_response, 'sandbox')) {
            return;
        }

        $eventKey = $transaction->partner_id.':'.$transaction->id.':'.$transaction->status;
        $existing = ApiWebhookDelivery::where('event_key', $eventKey)->first();
        if ($existing) {
            return; // idempotent — one logical event
        }

        $credential = ApiCredential::query()
            ->where('partner_id', $transaction->partner_id)
            ->where('is_active', true)
            ->where('is_sandbox', false)
            ->whereNull('revoked_at')
            ->orderByDesc('id')
            ->first();

        if (! $credential || ! $credential->callback_url) {
            return;
        }

        $payload = [
            'event' => 'transaction.status',
            'partner_ref' => $transaction->partner_ref,
            'invoice_number' => $transaction->invoice_number,
            'status' => $transaction->status,
            'amount' => (float) $transaction->amount,
            'total_payment' => (float) $transaction->total_payment,
            'timestamp' => now()->timestamp,
        ];

        $delivery = ApiWebhookDelivery::create([
            'partner_id' => $transaction->partner_id,
            'transaction_id' => $transaction->id,
            'event_key' => $eventKey,
            'payload' => $payload,
            'retry_count' => 0,
            'status' => ApiWebhookDelivery::STATUS_PENDING,
            'next_retry_at' => now(),
        ]);

        DeliverPartnerWebhookJob::dispatch($delivery->id);
    }

    public function attempt(ApiWebhookDelivery $delivery): void
    {
        if ($delivery->status === ApiWebhookDelivery::STATUS_DELIVERED) {
            return;
        }

        $credential = ApiCredential::query()
            ->where('partner_id', $delivery->partner_id)
            ->where('is_active', true)
            ->whereNull('revoked_at')
            ->orderByDesc('id')
            ->first();

        if (! $credential || ! $credential->callback_url) {
            $delivery->update(['status' => ApiWebhookDelivery::STATUS_FAILED]);

            return;
        }

        $body = json_encode($delivery->payload, JSON_UNESCAPED_SLASHES);
        $signature = $this->auth->sign($body ?: '', $credential->plainSecret());

        try {
            $response = Http::timeout(15)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'X-API-Key' => $credential->api_key,
                    'X-Signature' => $signature,
                    'X-Timestamp' => (string) now()->timestamp,
                ])
                ->withBody($body ?: '{}', 'application/json')
                ->post($credential->callback_url);

            $delivery->http_status_response = $response->status();

            if ($response->successful()) {
                $delivery->status = ApiWebhookDelivery::STATUS_DELIVERED;
                $delivery->delivered_at = now();
                $delivery->next_retry_at = null;
                $delivery->save();

                return;
            }
        } catch (\Throwable $e) {
            Log::warning('Partner webhook delivery failed', [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage(),
            ]);
            $delivery->http_status_response = null;
        }

        $max = (int) config('partner_api.webhook_max_retries', 3);
        $delays = config('partner_api.webhook_retry_delays_seconds', [60, 300, 1800]);
        $nextAttempt = (int) $delivery->retry_count + 1;

        if ($nextAttempt > $max) {
            $delivery->status = ApiWebhookDelivery::STATUS_FAILED;
            $delivery->retry_count = $max;
            $delivery->next_retry_at = null;
            $delivery->save();

            return;
        }

        $delay = (int) ($delays[$nextAttempt - 1] ?? end($delays));
        $delivery->retry_count = $nextAttempt;
        $delivery->status = ApiWebhookDelivery::STATUS_PENDING;
        $delivery->next_retry_at = now()->addSeconds($delay);
        $delivery->save();

        DeliverPartnerWebhookJob::dispatch($delivery->id)->delay($delay);
    }
}
