<?php

namespace App\Contracts\Realtime;

/**
 * Transport-agnostic realtime publisher.
 * Sprint 8.0: SseRealtimeTransport. Later: ReverbRealtimeTransport — same interface.
 */
interface RealtimeTransport
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function publish(string $channel, string $event, array $payload = []): void;
}
