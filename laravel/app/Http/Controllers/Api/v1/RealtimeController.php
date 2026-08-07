<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Services\Realtime\RealtimeChannelAuthorizer;
use App\Services\Realtime\SseRealtimeTransport;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * SSE stream — Sprint 8.0 Phase 1 realtime transport.
 * GET /api/v1/realtime/stream?channels[]=chat.agents&channels[]=...
 */
class RealtimeController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected RealtimeChannelAuthorizer $authorizer
    ) {}

    public function stream(Request $request): StreamedResponse
    {
        $user = $request->user();
        $channels = array_values(array_unique(array_filter((array) $request->input('channels', []))));

        if ($channels === []) {
            abort(422, 'channels required');
        }

        foreach ($channels as $channel) {
            if (! is_string($channel) || ! $this->authorizer->canSubscribe($user, $channel)) {
                abort(403, 'Unauthorized channel: '.$channel);
            }
        }

        $lastIds = [];
        foreach ($channels as $ch) {
            $lastIds[$ch] = null;
        }

        return response()->stream(function () use ($channels, $lastIds) {
            // Disable buffering
            if (function_exists('apache_setenv')) {
                @apache_setenv('no-gzip', '1');
            }
            @ini_set('zlib.output_compression', '0');
            @ini_set('implicit_flush', '1');

            $started = time();
            $maxSeconds = 55; // stay under typical proxy timeouts; client reconnects

            echo ": connected\n\n";
            if (ob_get_level() > 0) {
                @ob_flush();
            }
            @flush();

            while (! connection_aborted() && (time() - $started) < $maxSeconds) {
                $emitted = false;
                foreach ($channels as $channel) {
                    $events = SseRealtimeTransport::drain($channel, $lastIds[$channel] ?? null);
                    foreach ($events as $entry) {
                        $lastIds[$channel] = $entry['id'] ?? $lastIds[$channel];
                        echo 'id: '.($entry['id'] ?? '')."\n";
                        echo 'event: '.($entry['event'] ?? 'message')."\n";
                        echo 'data: '.json_encode([
                            'channel' => $channel,
                            'event' => $entry['event'] ?? 'message',
                            'payload' => $entry['payload'] ?? [],
                            'at' => $entry['at'] ?? null,
                        ], JSON_UNESCAPED_UNICODE)."\n\n";
                        $emitted = true;
                    }
                }

                if ($emitted) {
                    if (ob_get_level() > 0) {
                        @ob_flush();
                    }
                    @flush();
                } else {
                    echo ": heartbeat\n\n";
                    if (ob_get_level() > 0) {
                        @ob_flush();
                    }
                    @flush();
                    usleep(1_500_000);
                }

                if ($emitted) {
                    usleep(200_000);
                }
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /** Lightweight poll fallback for environments that block SSE. */
    public function poll(Request $request)
    {
        $user = $request->user();
        $channels = array_values(array_unique(array_filter((array) $request->input('channels', []))));
        $after = (array) $request->input('after', []);

        if ($channels === []) {
            return $this->errorResponse('channels required', 422);
        }

        $events = [];
        foreach ($channels as $channel) {
            if (! is_string($channel) || ! $this->authorizer->canSubscribe($user, $channel)) {
                return $this->errorResponse('Unauthorized channel: '.$channel, 403);
            }
            $afterId = is_string($after[$channel] ?? null) ? $after[$channel] : null;
            foreach (SseRealtimeTransport::drain($channel, $afterId) as $entry) {
                $events[] = $entry;
            }
        }

        return $this->successResponse('Realtime events.', ['events' => $events]);
    }
}
