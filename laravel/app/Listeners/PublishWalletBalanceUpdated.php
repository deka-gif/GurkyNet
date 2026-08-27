<?php

namespace App\Listeners;

use App\Contracts\Realtime\RealtimeTransport;
use App\Events\WalletCredited;
use Illuminate\Support\Facades\Log;

/**
 * Sprint 11 / SRS 16.3 — publish balance_updated to wallet.{userId} via SSE.
 * Realtime is notification-only; database wallet remains source of truth.
 */
class PublishWalletBalanceUpdated
{
    public function __construct(protected RealtimeTransport $realtime) {}

    public function handle(WalletCredited $event): void
    {
        $wallet = $event->wallet->fresh() ?? $event->wallet;
        $userId = (int) $wallet->user_id;
        if ($userId <= 0) {
            return;
        }

        $channel = 'wallet.'.$userId;
        $payload = [
            'balance' => (float) $wallet->balance,
            'delta' => (float) $event->amount,
            'reason' => $event->reason,
            'transaction_id' => $event->referenceId,
            'wallet_number' => $wallet->wallet_number,
            'at' => now()->toIso8601String(),
        ];

        $this->realtime->publish($channel, 'balance_updated', $payload);

        Log::info('WALLET REALTIME — balance_updated published', [
            'channel' => $channel,
            'user_id' => $userId,
            'transaction_id' => $event->referenceId,
            // Never log secrets; balance is user-owned financial state, OK at info level without keys.
        ]);
    }
}
