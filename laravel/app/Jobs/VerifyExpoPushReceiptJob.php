<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\UserDevice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Query Expo Push Receipt API after a ticket was accepted.
 * // FR notification delivery observability — prove push outcome (ok/error), not silent success
 */
class VerifyExpoPushReceiptJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    /**
     * @param  array{
     *   ticket_id: string,
     *   device_id: int,
     *   user_id?: int|null,
     *   notification_id?: int|null,
     *   transaction_id?: int|string|null,
     *   invoice_number?: string|null,
     * }  $context
     */
    public function __construct(public array $context) {}

    public function handle(): void
    {
        $ticketId = (string) ($this->context['ticket_id'] ?? '');
        if ($ticketId === '') {
            Log::warning('Expo push receipt skipped: missing ticket_id', [
                'context' => $this->context,
            ]);

            return;
        }

        $url = (string) config(
            'services.expo.receipts_url',
            'https://exp.host/--/api/v2/push/getReceipts'
        );

        $response = Http::acceptJson()
            ->asJson()
            ->timeout(30)
            ->post($url, [
                'ids' => [$ticketId],
            ]);

        if (! $response->successful()) {
            Log::warning('Expo push receipt HTTP failed', [
                'ticket_id' => $ticketId,
                'device_id' => $this->context['device_id'] ?? null,
                'user_id' => $this->context['user_id'] ?? null,
                'notification_id' => $this->context['notification_id'] ?? null,
                'transaction_id' => $this->context['transaction_id'] ?? null,
                'invoice_number' => $this->context['invoice_number'] ?? null,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return;
        }

        $receipt = $response->json('data.'.$ticketId);
        if (! is_array($receipt)) {
            Log::warning('Expo push receipt missing for ticket', [
                'ticket_id' => $ticketId,
                'device_id' => $this->context['device_id'] ?? null,
                'user_id' => $this->context['user_id'] ?? null,
                'notification_id' => $this->context['notification_id'] ?? null,
                'transaction_id' => $this->context['transaction_id'] ?? null,
                'invoice_number' => $this->context['invoice_number'] ?? null,
                'raw' => $response->json(),
            ]);

            return;
        }

        $status = (string) ($receipt['status'] ?? '');
        $message = $receipt['message'] ?? null;
        $details = $receipt['details'] ?? null;
        $errorCode = is_array($details) ? ($details['error'] ?? null) : null;

        if ($status === 'ok') {
            Log::info('Expo push receipt ok', [
                'ticket_id' => $ticketId,
                'device_id' => $this->context['device_id'] ?? null,
                'user_id' => $this->context['user_id'] ?? null,
                'notification_id' => $this->context['notification_id'] ?? null,
                'transaction_id' => $this->context['transaction_id'] ?? null,
                'invoice_number' => $this->context['invoice_number'] ?? null,
                'receipt_status' => $status,
            ]);
        } else {
            Log::warning('Expo push receipt error', [
                'ticket_id' => $ticketId,
                'device_id' => $this->context['device_id'] ?? null,
                'user_id' => $this->context['user_id'] ?? null,
                'notification_id' => $this->context['notification_id'] ?? null,
                'transaction_id' => $this->context['transaction_id'] ?? null,
                'invoice_number' => $this->context['invoice_number'] ?? null,
                'receipt_status' => $status !== '' ? $status : 'unknown',
                'message' => $message,
                'details' => $details,
                'error_code' => $errorCode,
            ]);
        }

        $this->persistReceiptOnNotification($ticketId, $status, $message, $details);

        if ($errorCode === 'DeviceNotRegistered') {
            $deviceId = (int) ($this->context['device_id'] ?? 0);
            if ($deviceId > 0) {
                UserDevice::where('id', $deviceId)->update([
                    'is_active' => false,
                    'push_token' => null,
                ]);
                Log::warning('Expo DeviceNotRegistered — device deactivated', [
                    'device_id' => $deviceId,
                    'ticket_id' => $ticketId,
                ]);
            }
        }
    }

    protected function persistReceiptOnNotification(
        string $ticketId,
        string $status,
        mixed $message,
        mixed $details
    ): void {
        $notificationId = (int) ($this->context['notification_id'] ?? 0);
        if ($notificationId <= 0) {
            return;
        }

        $notification = Notification::query()->find($notificationId);
        if (! $notification) {
            return;
        }

        $payload = is_array($notification->payload) ? $notification->payload : [];
        $tickets = is_array($payload['expo_push_tickets'] ?? null) ? $payload['expo_push_tickets'] : [];
        $updated = false;
        foreach ($tickets as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            if (($row['ticket_id'] ?? null) !== $ticketId) {
                continue;
            }
            $tickets[$i]['receipt_status'] = $status !== '' ? $status : 'unknown';
            $tickets[$i]['receipt_message'] = is_string($message) ? $message : null;
            $tickets[$i]['receipt_details'] = $details;
            $tickets[$i]['receipt_checked_at'] = now()->toIso8601String();
            $updated = true;
            break;
        }

        if (! $updated) {
            return;
        }

        $payload['expo_push_tickets'] = $tickets;
        $notification->payload = $payload;
        $notification->save();
    }
}
