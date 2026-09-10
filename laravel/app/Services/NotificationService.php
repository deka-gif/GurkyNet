<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\UserNotification;
use App\Models\User;
use App\Models\UserDevice;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;

/**
 * Customer notification infrastructure.
 *
 * Inbox (database) = source of truth for customer history.
 * Push = delivery channel only; push failure must never erase inbox rows.
 *
 * Customer-facing categories: transaction | announcement | promotion
 * (Division Marketing/Admin will call notifyAnnouncement / notifyPromotion later.)
 */
class NotificationService
{
    public const CATEGORY_TRANSACTION = 'transaction';

    public const CATEGORY_ANNOUNCEMENT = 'announcement';

    public const CATEGORY_PROMOTION = 'promotion';

    /**
     * Send notification to multiple channels.
     * Default: database (in-app). Push is attempted when devices exist + provider is configured.
     *
     * @param  array<string, mixed>|null  $payload  Optional structured meta (e.g. transaction_id, invoice_number, dedupe_key, deep_link).
     * @return array<string, bool>
     */
    public function send(User $user, string $title, string $message, string $type = 'info', array $channels = ['database'], ?array $payload = null): array
    {
        $results = [];
        $dbMeta = null;
        $payload = $this->normalizePayload($type, $payload);

        foreach ($channels as $channel) {
            try {
                $channel = strtolower($channel);
                switch ($channel) {
                    case 'database':
                        $dbMeta = $this->sendDatabase($user, $title, $message, $type, $payload);
                        $results['database'] = (bool) ($dbMeta['ok'] ?? false);
                        break;
                    case 'email':
                        $results['email'] = $this->sendEmail($user, $title, $message);
                        break;
                    case 'push':
                        // Skip push when inbox insert was a dedupe reuse (same customer event).
                        if (is_array($dbMeta) && ($dbMeta['created'] ?? true) === false) {
                            Log::info('Push skipped: duplicate customer notification (dedupe reuse)', [
                                'user_id' => $user->id,
                                'notification_id' => $dbMeta['notification_id'] ?? null,
                                'dedupe_key' => $payload['dedupe_key'] ?? null,
                            ]);
                            $results['push'] = false;
                            break;
                        }
                        if (! $this->userAllowsPush($user, $this->resolveCategory($type, $payload))) {
                            Log::info('Push skipped: user preference off', [
                                'user_id' => $user->id,
                                'category' => $this->resolveCategory($type, $payload),
                            ]);
                            $results['push'] = false;
                            break;
                        }
                        $results['push'] = $this->sendPush(
                            $user,
                            $title,
                            $message,
                            $type,
                            $payload,
                            is_array($dbMeta) ? $dbMeta : null
                        );
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
     * Create a customer announcement notification for one user.
     * Boundary for Admin/Operations (later) — no CMS in this layer.
     *
     * @param  array<string, mixed>|null  $payload  announcement_id, deep_link, dedupe_key, image_url, …
     * @return array<string, bool>
     */
    public function notifyAnnouncement(
        User $user,
        string $title,
        string $message,
        ?array $payload = null,
        array $channels = ['database', 'push']
    ): array {
        $payload = array_merge($payload ?? [], [
            'category' => self::CATEGORY_ANNOUNCEMENT,
        ]);

        return $this->send(
            $user,
            $title,
            $message,
            self::CATEGORY_ANNOUNCEMENT,
            $channels,
            $payload
        );
    }

    /**
     * Create a customer promotion notification for one user.
     * Boundary for Marketing (later) — no campaign engine in this layer.
     *
     * @param  array<string, mixed>|null  $payload  campaign_id, deep_link, dedupe_key, image_url, …
     * @return array<string, bool>
     */
    public function notifyPromotion(
        User $user,
        string $title,
        string $message,
        ?array $payload = null,
        array $channels = ['database', 'push']
    ): array {
        $payload = array_merge($payload ?? [], [
            'category' => self::CATEGORY_PROMOTION,
        ]);

        return $this->send(
            $user,
            $title,
            $message,
            self::CATEGORY_PROMOTION,
            $channels,
            $payload
        );
    }

    /**
     * Fan-out announcement to many users (service boundary for later divisions).
     *
     * @param  iterable<int, User>|Collection<int, User>  $users
     * @param  array<string, mixed>|null  $payload
     * @return array{notification_id:int|null, delivered:int}
     */
    public function notifyAnnouncementToUsers(
        iterable $users,
        string $title,
        string $message,
        ?array $payload = null,
        array $channels = ['database', 'push']
    ): array {
        $delivered = 0;
        $lastId = null;
        foreach ($users as $user) {
            if (! $user instanceof User) {
                continue;
            }
            $result = $this->notifyAnnouncement($user, $title, $message, $payload, $channels);
            if (! empty($result['database'])) {
                $delivered++;
            }
        }

        if (! empty($payload['dedupe_key']) && Schema::hasColumn('notifications', 'dedupe_key')) {
            $lastId = Notification::query()->where('dedupe_key', (string) $payload['dedupe_key'])->value('id');
        }

        return ['notification_id' => $lastId ? (int) $lastId : null, 'delivered' => $delivered];
    }

    /**
     * Fan-out promotion to many users (service boundary for later Marketing).
     *
     * @param  iterable<int, User>|Collection<int, User>  $users
     * @param  array<string, mixed>|null  $payload
     * @return array{notification_id:int|null, delivered:int}
     */
    public function notifyPromotionToUsers(
        iterable $users,
        string $title,
        string $message,
        ?array $payload = null,
        array $channels = ['database', 'push']
    ): array {
        $delivered = 0;
        $lastId = null;
        foreach ($users as $user) {
            if (! $user instanceof User) {
                continue;
            }
            $result = $this->notifyPromotion($user, $title, $message, $payload, $channels);
            if (! empty($result['database'])) {
                $delivered++;
            }
        }

        if (! empty($payload['dedupe_key']) && Schema::hasColumn('notifications', 'dedupe_key')) {
            $lastId = Notification::query()->where('dedupe_key', (string) $payload['dedupe_key'])->value('id');
        }

        return ['notification_id' => $lastId ? (int) $lastId : null, 'delivered' => $delivered];
    }

    /**
     * Broadcast marketing / system announcement to all active users' inboxes.
     */
    public function broadcast(string $title, string $message, string $type = 'broadcast', array $channels = ['database']): Notification
    {
        $category = $this->resolveCategory($type, ['category' => $type === 'broadcast' ? self::CATEGORY_PROMOTION : $type]);
        $payload = [
            'category' => $category,
        ];

        $attrs = [
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'is_active' => true,
        ];
        if (Schema::hasColumn('notifications', 'payload')) {
            $attrs['payload'] = $payload;
        }

        $notification = Notification::create($attrs);

        User::query()->select('id', 'notify_announcements', 'notify_promotions', 'notify_transactions')
            ->orderBy('id')
            ->chunkById(200, function ($users) use ($notification, $title, $message, $channels, $type, $payload, $category) {
                foreach ($users as $user) {
                    UserNotification::firstOrCreate(
                        [
                            'user_id' => $user->id,
                            'notification_id' => $notification->id,
                        ],
                        ['is_read' => false]
                    );

                    if (in_array('push', $channels, true) && $this->userAllowsPush($user, $category)) {
                        $this->sendPush($user, $title, $message, $type, $payload, [
                            'ok' => true,
                            'created' => true,
                            'notification_id' => $notification->id,
                            'user_notification_id' => null,
                        ]);
                    }
                }
            });

        return $notification;
    }

    /**
     * Persist an in-app notification.
     *
     * When payload.dedupe_key is set and notifications.dedupe_key exists, insert is
     * protected by a UNIQUE constraint — concurrent/retry finals cannot create duplicates.
     *
     * @param  array<string, mixed>|null  $payload
     * @return array{ok:bool,created:bool,notification_id:?int,user_notification_id:?int}
     */
    protected function sendDatabase(User $user, string $title, string $message, string $type, ?array $payload = null): array
    {
        $dedupeKey = (is_array($payload) && ! empty($payload['dedupe_key']))
            ? (string) $payload['dedupe_key']
            : null;

        $hasPayloadCol = Schema::hasColumn('notifications', 'payload');
        $hasDedupeCol = Schema::hasColumn('notifications', 'dedupe_key');

        // Non-keyed path (broadcast-style / legacy): unchanged create-always behavior.
        if ($dedupeKey === null || ! $hasDedupeCol) {
            $attrs = [
                'title' => $title,
                'message' => $message,
                'type' => $type,
            ];
            if (is_array($payload) && $hasPayloadCol) {
                $attrs['payload'] = $payload;
            }

            $notification = Notification::create($attrs);

            $userNotification = UserNotification::create([
                'user_id' => $user->id,
                'notification_id' => $notification->id,
                'is_read' => false,
            ]);

            return [
                'ok' => true,
                'created' => true,
                'notification_id' => (int) $notification->id,
                'user_notification_id' => (int) $userNotification->id,
            ];
        }

        // FR-TOPUP-UX-01 — atomic insert-or-reuse via UNIQUE(dedupe_key).
        try {
            $meta = null;
            DB::transaction(function () use ($user, $title, $message, $type, $payload, $dedupeKey, $hasPayloadCol, &$meta) {
                $attrs = [
                    'title' => $title,
                    'message' => $message,
                    'type' => $type,
                    'dedupe_key' => $dedupeKey,
                ];
                if ($hasPayloadCol) {
                    $attrs['payload'] = $payload;
                }

                $notification = Notification::create($attrs);

                $userNotification = UserNotification::create([
                    'user_id' => $user->id,
                    'notification_id' => $notification->id,
                    'is_read' => false,
                ]);

                $meta = [
                    'ok' => true,
                    'created' => true,
                    'notification_id' => (int) $notification->id,
                    'user_notification_id' => (int) $userNotification->id,
                ];
            });

            return $meta ?? ['ok' => true, 'created' => true, 'notification_id' => null, 'user_notification_id' => null];
        } catch (UniqueConstraintViolationException $e) {
            $existing = Notification::query()
                ->where('dedupe_key', $dedupeKey)
                ->first();

            if (! $existing) {
                Log::warning('NotificationService: unique violation without existing dedupe_key row', [
                    'user_id' => $user->id,
                    'dedupe_key' => $dedupeKey,
                    'error' => $e->getMessage(),
                ]);

                throw $e;
            }

            $userNotification = UserNotification::firstOrCreate(
                [
                    'user_id' => $user->id,
                    'notification_id' => $existing->id,
                ],
                ['is_read' => false]
            );

            Log::info('NotificationService: skipped duplicate database notification (unique dedupe_key)', [
                'user_id' => $user->id,
                'dedupe_key' => $dedupeKey,
                'notification_id' => $existing->id,
            ]);

            return [
                'ok' => true,
                'created' => false,
                'notification_id' => (int) $existing->id,
                'user_notification_id' => (int) $userNotification->id,
            ];
        }
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
     * Deliver push to registered device tokens (FCM and/or Expo Push API).
     * Failure here must not affect inbox persistence.
     *
     * @param  array<string, mixed>|null  $payload
     * @param  array{ok?:bool,created?:bool,notification_id?:?int,user_notification_id?:?int}|null  $dbMeta
     */
    protected function sendPush(
        User $user,
        string $title,
        string $message,
        string $type = 'info',
        ?array $payload = null,
        ?array $dbMeta = null
    ): bool {
        $devices = UserDevice::where('user_id', $user->id)
            ->where('is_active', true)
            ->whereNotNull('push_token')
            ->get();

        if ($devices->isEmpty()) {
            Log::info('Push skipped: no registered device tokens', ['user_id' => $user->id]);

            return false;
        }

        $category = $this->resolveCategory($type, $payload);
        $data = $this->buildPushData($category, $type, $payload, $dbMeta);

        $delivered = 0;
        foreach ($devices as $device) {
            try {
                $token = (string) $device->push_token;
                // Route by token shape to avoid Expo API + FCM token mismatch.
                // Mobile registers ExponentPushToken[...] with push_provider=expo.
                $isExpo = str_starts_with($token, 'ExponentPushToken')
                    || str_starts_with($token, 'ExpoPushToken');

                $ok = $isExpo
                    ? $this->deliverExpoPush($device->id, $token, $title, $message, $data)
                    : $this->deliverFcmPush($device->id, $token, $title, $message, $data, (string) $device->platform);

                if ($ok) {
                    $delivered++;
                }
            } catch (\Throwable $e) {
                Log::warning('Push request exception', [
                    'device_id' => $device->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $delivered > 0;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function deliverExpoPush(int $deviceId, string $token, string $title, string $message, array $data): bool
    {
        // Expo Push API — no FCM_SERVER_KEY required.
        // channelId must match mobile Android channel + app.json defaultChannel.
        $response = Http::acceptJson()
            ->asJson()
            ->post('https://exp.host/--/api/v2/push/send', [
                'to' => $token,
                'title' => $title,
                'body' => $message,
                'sound' => 'default',
                'channelId' => 'default',
                'priority' => 'high',
                'data' => $data,
            ]);

        if (! $response->successful()) {
            Log::warning('Expo push delivery failed', [
                'device_id' => $deviceId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        }

        $payload = $response->json();
        $ticket = $payload['data'] ?? null;
        // Single-send returns object; batch returns array.
        if (is_array($ticket) && array_is_list($ticket)) {
            $ticket = $ticket[0] ?? null;
        }
        if (is_array($ticket) && ($ticket['status'] ?? null) === 'error') {
            Log::warning('Expo push ticket error', [
                'device_id' => $deviceId,
                'message' => $ticket['message'] ?? null,
                'details' => $ticket['details'] ?? null,
            ]);

            return false;
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function deliverFcmPush(
        int $deviceId,
        string $token,
        string $title,
        string $message,
        array $data,
        string $platform
    ): bool {
        $serverKey = config('services.fcm.server_key') ?: env('FCM_SERVER_KEY');
        if (! $serverKey) {
            Log::warning('Push notification channel is not configured (missing FCM_SERVER_KEY)', [
                'device_id' => $deviceId,
            ]);

            return false;
        }

        $response = Http::withHeaders([
            'Authorization' => 'key='.$serverKey,
            'Content-Type' => 'application/json',
        ])->post('https://fcm.googleapis.com/fcm/send', [
            'to' => $token,
            'notification' => [
                'title' => $title,
                'body' => $message,
            ],
            'data' => array_merge($data, [
                'platform' => $platform,
            ]),
        ]);

        if ($response->successful()) {
            return true;
        }

        Log::warning('FCM delivery failed', [
            'device_id' => $deviceId,
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        return false;
    }

    protected function sendSms(User $user, string $message): bool
    {
        Log::warning('SMS notification channel is not configured; message not delivered', [
            'phone' => $user->phone_number,
        ]);

        return false;
    }

    /**
     * @param  array<string, mixed>|null  $payload
     */
    public function resolveCategory(string $type, ?array $payload = null): string
    {
        $fromPayload = strtolower((string) ($payload['category'] ?? ''));
        if (in_array($fromPayload, [self::CATEGORY_TRANSACTION, self::CATEGORY_ANNOUNCEMENT, self::CATEGORY_PROMOTION], true)) {
            return $fromPayload;
        }

        $raw = strtolower($type);
        if (
            str_contains($raw, 'transaction')
            || $raw === 'transaksi'
            || $raw === 'success'
            || $raw === 'failed'
            || $raw === 'timeout'
        ) {
            return self::CATEGORY_TRANSACTION;
        }
        if ($raw === self::CATEGORY_ANNOUNCEMENT || $raw === 'info' || $raw === 'maintenance') {
            return self::CATEGORY_ANNOUNCEMENT;
        }
        if ($raw === self::CATEGORY_PROMOTION || $raw === 'promo' || $raw === 'broadcast') {
            return self::CATEGORY_PROMOTION;
        }

        if (! empty($payload['transaction_id']) || ! empty($payload['invoice_number'])) {
            return self::CATEGORY_TRANSACTION;
        }
        if (! empty($payload['campaign_id'])) {
            return self::CATEGORY_PROMOTION;
        }
        if (! empty($payload['announcement_id'])) {
            return self::CATEGORY_ANNOUNCEMENT;
        }

        return self::CATEGORY_ANNOUNCEMENT;
    }

    public function userAllowsPush(User $user, string $category): bool
    {
        return match ($category) {
            self::CATEGORY_TRANSACTION => ($user->notify_transactions ?? true) !== false,
            self::CATEGORY_ANNOUNCEMENT => ($user->notify_announcements ?? true) !== false,
            self::CATEGORY_PROMOTION => ($user->notify_promotions ?? true) !== false,
            default => true,
        };
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @return array<string, mixed>
     */
    protected function normalizePayload(string $type, ?array $payload): array
    {
        $payload = is_array($payload) ? $payload : [];
        $category = $this->resolveCategory($type, $payload);
        $payload['category'] = $category;

        if ($category === self::CATEGORY_TRANSACTION
            && empty($payload['deep_link'])
            && ! empty($payload['transaction_id'])
        ) {
            $payload['deep_link'] = '/riwayat/'.$payload['transaction_id'];
        }

        return $payload;
    }

    /**
     * Structured push data for mobile navigation (do not parse title).
     *
     * @param  array<string, mixed>|null  $payload
     * @param  array{notification_id?:?int,user_notification_id?:?int}|null  $dbMeta
     * @return array<string, string>
     */
    protected function buildPushData(string $category, string $type, ?array $payload, ?array $dbMeta): array
    {
        $payload = is_array($payload) ? $payload : [];

        // FCM data values must be strings.
        $data = [
            'type' => $category,
            'raw_type' => (string) $type,
            'category' => $category,
        ];

        $notificationId = $dbMeta['user_notification_id'] ?? $dbMeta['notification_id'] ?? null;
        if ($notificationId !== null) {
            $data['notification_id'] = (string) $notificationId;
        }
        if (! empty($payload['transaction_id'])) {
            $data['transaction_id'] = (string) $payload['transaction_id'];
        }
        if (! empty($payload['invoice_number'])) {
            $data['invoice_number'] = (string) $payload['invoice_number'];
        }
        if (! empty($payload['announcement_id'])) {
            $data['announcement_id'] = (string) $payload['announcement_id'];
        }
        if (! empty($payload['campaign_id'])) {
            $data['campaign_id'] = (string) $payload['campaign_id'];
        }
        if (! empty($payload['deep_link'])) {
            $data['deep_link'] = (string) $payload['deep_link'];
        }
        if (! empty($payload['image_url'])) {
            $data['image_url'] = (string) $payload['image_url'];
        }

        return $data;
    }
}
