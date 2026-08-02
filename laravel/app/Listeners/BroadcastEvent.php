<?php

namespace App\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class BroadcastEvent implements ShouldQueue
{
    use InteractsWithQueue;

    /**
     * Handle the event.
     */
    public function handle(mixed $event): void
    {
        $eventName = str_replace('App\\Events\\', '', get_class($event));
        
        Log::info("Broadcasting event via WebSocket (Laravel Reverb / Pusher Prep)", [
            'event' => $eventName,
            'channels' => ['user-channel.' . ($event->transaction->user_id ?? $event->wallet->user_id ?? 'global')],
            'payload' => $this->serializeEvent($event),
        ]);
    }

    /**
     * Serialize event data.
     */
    protected function serializeEvent(mixed $event): array
    {
        if (isset($event->transaction)) {
            return [
                'type' => 'transaction',
                'invoice_number' => $event->transaction->invoice_number,
                'status' => $event->transaction->status,
                'amount' => $event->transaction->amount,
            ];
        }

        if (isset($event->wallet)) {
            return [
                'type' => 'wallet',
                'wallet_number' => $event->wallet->wallet_number,
                'amount' => $event->amount,
                'reason' => $event->reason,
            ];
        }

        return [];
    }
}
