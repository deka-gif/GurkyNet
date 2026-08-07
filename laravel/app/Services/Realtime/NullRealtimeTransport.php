<?php

namespace App\Services\Realtime;

use App\Contracts\Realtime\RealtimeTransport;

/** No-op transport for unit tests when SSE side-effects are not needed. */
class NullRealtimeTransport implements RealtimeTransport
{
    public function publish(string $channel, string $event, array $payload = []): void
    {
        // intentionally empty
    }
}
