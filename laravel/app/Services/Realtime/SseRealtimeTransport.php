<?php

namespace App\Services\Realtime;

use App\Contracts\Realtime\RealtimeTransport;
use Illuminate\Support\Facades\Cache;

/**
 * SSE-backed transport: append events to a short-lived channel buffer.
 * Clients poll/stream via RealtimeController.
 */
class SseRealtimeTransport implements RealtimeTransport
{
    public const BUFFER_PREFIX = 'realtime:channel:';

    public const REVISION_PREFIX = 'realtime:rev:';

    public const BUFFER_TTL = 120;

    public const BUFFER_MAX = 100;

    public function publish(string $channel, string $event, array $payload = []): void
    {
        $entry = [
            'id' => (string) str()->uuid(),
            'event' => $event,
            'channel' => $channel,
            'payload' => $payload,
            'at' => now()->toIso8601String(),
        ];

        $key = self::BUFFER_PREFIX.$channel;
        $buffer = Cache::get($key, []);
        if (! is_array($buffer)) {
            $buffer = [];
        }
        $buffer[] = $entry;
        if (count($buffer) > self::BUFFER_MAX) {
            $buffer = array_slice($buffer, -self::BUFFER_MAX);
        }
        Cache::put($key, $buffer, self::BUFFER_TTL);
        Cache::increment(self::REVISION_PREFIX.$channel);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function drain(string $channel, ?string $afterId = null): array
    {
        $buffer = Cache::get(self::BUFFER_PREFIX.$channel, []);
        if (! is_array($buffer) || $buffer === []) {
            return [];
        }

        if (! $afterId) {
            return array_values($buffer);
        }

        $out = [];
        $seen = false;
        foreach ($buffer as $entry) {
            if ($seen) {
                $out[] = $entry;
            }
            if (($entry['id'] ?? null) === $afterId) {
                $seen = true;
            }
        }

        // If afterId not found, return all (client reconnect)
        return $seen ? $out : array_values($buffer);
    }

    public static function revision(string $channel): int
    {
        return (int) Cache::get(self::REVISION_PREFIX.$channel, 0);
    }
}
