<?php

namespace App\Listeners;

use App\Events\TransactionCreated;
use App\Events\TransactionProcessing;
use App\Events\TransactionSuccess;
use App\Events\TransactionFailed;
use App\Events\WalletCredited;
use App\Events\WalletDebited;
use App\Events\PaymentSettled;
use App\Models\ActivityLog;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class WriteAuditLog implements ShouldQueue
{
    use InteractsWithQueue;

    /**
     * Handle the event.
     */
    public function handle(mixed $event): void
    {
        $userId = null;
        $activity = '';
        $payload = [];

        // Determine logging attributes
        if ($event instanceof TransactionCreated) {
            $userId = $event->transaction->user_id;
            $activity = 'transaction_created';
            $payload = [
                'invoice_number' => $event->transaction->invoice_number,
                'amount' => $event->transaction->amount,
                'service_name' => $event->transaction->service_name,
            ];
        } elseif ($event instanceof TransactionProcessing) {
            $userId = $event->transaction->user_id;
            $activity = 'transaction_processing';
            $payload = [
                'invoice_number' => $event->transaction->invoice_number,
            ];
        } elseif ($event instanceof TransactionSuccess) {
            $userId = $event->transaction->user_id;
            $activity = 'transaction_success';
            $payload = [
                'invoice_number' => $event->transaction->invoice_number,
                'amount' => $event->transaction->amount,
            ];
        } elseif ($event instanceof TransactionFailed) {
            $userId = $event->transaction->user_id;
            $activity = 'transaction_failed';
            $payload = [
                'invoice_number' => $event->transaction->invoice_number,
                'reason' => $event->transaction->notes,
            ];
        } elseif ($event instanceof WalletCredited) {
            $userId = $event->wallet->user_id;
            $activity = 'wallet_credited';
            $payload = [
                'wallet_number' => $event->wallet->wallet_number,
                'amount' => $event->amount,
                'reason' => $event->reason,
                'reference_id' => $event->referenceId,
            ];
        } elseif ($event instanceof WalletDebited) {
            $userId = $event->wallet->user_id;
            $activity = 'wallet_debited';
            $payload = [
                'wallet_number' => $event->wallet->wallet_number,
                'amount' => $event->amount,
                'reason' => $event->reason,
                'reference_id' => $event->referenceId,
            ];
        } elseif ($event instanceof PaymentSettled) {
            $userId = $event->transaction->user_id;
            $activity = 'payment_settled';
            $payload = [
                'invoice_number' => $event->transaction->invoice_number,
                'payload' => $event->payload,
            ];
        }

        // Trace and Correlation Context extraction
        $correlationId = request()->header('X-Correlation-ID') ?: (session()->get('correlation_id') ?: 'corr-' . uniqid());
        $requestId = request()->header('X-Request-ID') ?: 'req-' . uniqid();
        $providerId = $payload['provider_id'] ?? ($event->transaction->payment_method ?? 'system');

        $payload['trace_context'] = [
            'correlation_id' => $correlationId,
            'request_id' => $requestId,
            'provider_id' => $providerId,
        ];

        // Write to database audit log
        ActivityLog::create([
            'user_id' => $userId,
            'activity' => $activity,
            'payload' => $payload,
        ]);

        // Write structured JSON log to stdout/file for observability systems
        Log::info(json_encode([
            'message' => "Audit log written: {$activity}",
            'activity' => $activity,
            'user_id' => $userId,
            'correlation_id' => $correlationId,
            'request_id' => $requestId,
            'provider_id' => $providerId,
            'timestamp' => now()->toIso8601String(),
            'payload' => $payload,
        ]));
    }
}
