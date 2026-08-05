<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\UserNotification;
use App\Models\User;
use App\Models\UserDevice;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    /**
     * Send notification to multiple channels.
     * Default: database (in-app). Push is attempted when devices exist + FCM is configured.
     */
    public function send(User $user, string $title, string $message, string $type = 'info', array $channels = ['database']): array
    {
        $results = [];

        foreach ($channels as $channel) {
            try {
                $channel = strtolower($channel);
                switch ($channel) {
                    case 'database':
                        $results['database'] = $this->sendDatabase($user, $title, $message, $type);
                        break;
                    case 'email':
                        $results['email'] = $this->sendEmail($user, $title, $message);
                        break;
                    case 'push':
                        $results['push'] = $this->sendPush($user, $title, $message, $type);
                        break;
                    case 'sms':
                        $results['sms'] = $this->sendSms($user, $message);
                        break;
                    default:
                        Log::warning("NotificationService: Unsupported channel: {$channel}");
                        break;
                }
            } catch (\Exception $e) {
                Log::error("NotificationService: Failed to send via {$channel}", [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
                $results[$channel] = false;
            }
        }

        return $results;
    }

    /**
     * Broadcast marketing / system announcement to all active users' inboxes.
     */
    public function broadcast(string $title, string $message, string $type = 'broadcast', array $channels = ['database']): Notification
    {
        $notification = Notification::create([
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'is_active' => true,
        ]);

        User::query()->select('id')->orderBy('id')->chunkById(200, function ($users) use ($notification, $title, $message, $channels) {
            foreach ($users as $user) {
                UserNotification::firstOrCreate(
                    [
                        'user_id' => $user->id,
                        'notification_id' => $notification->id,
                    ],
                    ['is_read' => false]
                );

                if (in_array('push', $channels, true)) {
                    $this->sendPush($user, $title, $message, $notification->type);
                }
            }
        });

        return $notification;
    }

    protected function sendDatabase(User $user, string $title, string $message, string $type): bool
    {
        $notification = Notification::create([
            'title' => $title,
            'message' => $message,
            'type' => $type,
        ]);

        UserNotification::create([
            'user_id' => $user->id,
            'notification_id' => $notification->id,
            'is_read' => false,
        ]);

        return true;
    }

    protected function sendEmail(User $user, string $title, string $message): bool
    {
        try {
            Mail::raw($message, function ($mail) use ($user, $title) {
                $mail->to($user->email)->subject($title);
            });

            return true;
        } catch (\Exception $e) {
            Log::warning('Email notification delivery failed', [
                'to' => $user->email,
                'subject' => $title,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Deliver push to registered device tokens.
     * Uses FCM HTTP v1 legacy server key when FCM_SERVER_KEY is configured.
     */
    protected function sendPush(User $user, string $title, string $message, string $type = 'info'): bool
    {
        $devices = UserDevice::where('user_id', $user->id)
            ->where('is_active', true)
            ->whereNotNull('push_token')
            ->get();

        if ($devices->isEmpty()) {
            Log::info('Push skipped: no registered device tokens', ['user_id' => $user->id]);
            return false;
        }

        $serverKey = config('services.fcm.server_key') ?: env('FCM_SERVER_KEY');
        if (!$serverKey) {
            Log::warning('Push notification channel is not configured (missing FCM_SERVER_KEY)', [
                'user_id' => $user->id,
                'devices' => $devices->count(),
            ]);
            return false;
        }

        $delivered = 0;
        foreach ($devices as $device) {
            try {
                $response = Http::withHeaders([
                    'Authorization' => 'key=' . $serverKey,
                    'Content-Type' => 'application/json',
                ])->post('https://fcm.googleapis.com/fcm/send', [
                    'to' => $device->push_token,
                    'notification' => [
                        'title' => $title,
                        'body' => $message,
                    ],
                    'data' => [
                        'type' => $type,
                        'platform' => $device->platform,
                    ],
                ]);

                if ($response->successful()) {
                    $delivered++;
                } else {
                    Log::warning('FCM delivery failed', [
                        'device_id' => $device->id,
                        'status' => $response->status(),
                        'body' => $response->body(),
                    ]);
                }
            } catch (\Throwable $e) {
                Log::warning('FCM request exception', [
                    'device_id' => $device->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $delivered > 0;
    }

    protected function sendSms(User $user, string $message): bool
    {
        Log::warning('SMS notification channel is not configured; message not delivered', [
            'phone' => $user->phone_number,
        ]);

        return false;
    }
}
