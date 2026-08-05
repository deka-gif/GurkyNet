<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\UserNotification;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    /**
     * Send notification to multiple channels.
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
                        $results['push'] = $this->sendPush($user, $title, $message);
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
     * Send Database Notification.
     */
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

        Log::info("Database notification sent", [
            'user_id' => $user->id,
            'notification_id' => $notification->id,
        ]);

        return true;
    }

    /**
     * Send Email Notification via the configured mailer.
     * Returns false when delivery fails instead of pretending success.
     */
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
     * Push notifications are not wired to a provider (FCM/APNs) yet.
     * Report failure honestly instead of a fake success.
     */
    protected function sendPush(User $user, string $title, string $message): bool
    {
        Log::warning('Push notification channel is not configured; message not delivered', [
            'user_id' => $user->id,
            'title' => $title,
        ]);

        return false;
    }

    /**
     * SMS is not wired to a gateway yet.
     * Report failure honestly instead of a fake success.
     */
    protected function sendSms(User $user, string $message): bool
    {
        Log::warning('SMS notification channel is not configured; message not delivered', [
            'phone' => $user->phone_number,
        ]);

        return false;
    }
}
