<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use App\Models\UserDevice;
use App\Models\UserNotification;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Notification infrastructure foundation:
 * categories (transaction/announcement/promotion), preferences, device token ownership,
 * push gating, inbox vs push separation.
 */
class NotificationInfrastructureTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Notif Infra User',
            'email' => 'notif-infra@gurkypay.com',
            'phone_number' => '081234567800',
            'password' => Hash::make('password123'),
            'notify_transactions' => true,
            'notify_announcements' => true,
            'notify_promotions' => true,
        ]);
    }

    public function test_announcement_creates_inbox_notification(): void
    {
        $svc = resolve(NotificationService::class);
        $result = $svc->notifyAnnouncement(
            $this->user,
            'Pemeliharaan Sistem',
            'GurkyNet akan melakukan pemeliharaan sistem pada pukul 00.00–02.00 WIB.',
            [
                'announcement_id' => 'maint-1',
                'deep_link' => '/pengumuman/maint-1',
                'dedupe_key' => 'announcement:maint-1:user:'.$this->user->id,
            ],
            ['database']
        );

        $this->assertTrue($result['database']);
        $this->assertDatabaseHas('notifications', [
            'type' => 'announcement',
            'title' => 'Pemeliharaan Sistem',
        ]);
        $notification = Notification::where('title', 'Pemeliharaan Sistem')->first();
        $this->assertSame('announcement', $notification->payload['category'] ?? null);
        $this->assertSame('/pengumuman/maint-1', $notification->payload['deep_link'] ?? null);
        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $this->user->id,
            'notification_id' => $notification->id,
        ]);
    }

    public function test_promotion_creates_inbox_notification(): void
    {
        $svc = resolve(NotificationService::class);
        $result = $svc->notifyPromotion(
            $this->user,
            'Promo Pulsa Mingguan',
            'Nikmati penawaran spesial untuk pembelian pulsa pilihan minggu ini.',
            [
                'campaign_id' => 'camp-pulsa-1',
                'deep_link' => '/promo/camp-pulsa-1',
                'image_url' => 'https://cdn.example/promo.png',
                'dedupe_key' => 'promotion:camp-pulsa-1:user:'.$this->user->id,
            ],
            ['database']
        );

        $this->assertTrue($result['database']);
        $notification = Notification::where('type', 'promotion')->first();
        $this->assertNotNull($notification);
        $this->assertSame('camp-pulsa-1', $notification->payload['campaign_id'] ?? null);
        $this->assertSame('https://cdn.example/promo.png', $notification->payload['image_url'] ?? null);
    }

    public function test_announcement_dedupe_keeps_one_row_per_key(): void
    {
        $svc = resolve(NotificationService::class);
        $payload = [
            'announcement_id' => 'a-1',
            'dedupe_key' => 'announcement:a-1:user:'.$this->user->id,
        ];
        $svc->notifyAnnouncement($this->user, 'Informasi Layanan', 'Gangguan sementara.', $payload, ['database']);
        $svc->notifyAnnouncement($this->user, 'Informasi Layanan', 'Gangguan sementara.', $payload, ['database']);

        $this->assertSame(1, Notification::where('dedupe_key', $payload['dedupe_key'])->count());
        $this->assertSame(1, UserNotification::where('user_id', $this->user->id)->count());
    }

    public function test_profile_notification_preferences_update(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->putJson('/api/v1/profile/notification-preference', [
            'notify_transactions' => true,
            'notify_announcements' => false,
            'notify_promotions' => false,
        ]);

        $response->assertOk();
        $this->user->refresh();
        $this->assertTrue((bool) $this->user->notify_transactions);
        $this->assertFalse((bool) $this->user->notify_announcements);
        $this->assertFalse((bool) $this->user->notify_promotions);
        $response->assertJsonPath('data.notify_announcements', false);
        $response->assertJsonPath('data.notify_promotions', false);
    }

    public function test_promotion_push_skipped_when_preference_off_but_inbox_remains(): void
    {
        Http::fake();
        $this->user->forceFill(['notify_promotions' => false])->save();

        UserDevice::create([
            'user_id' => $this->user->id,
            'device_uuid' => 'device-promo-off',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[test-token]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        $svc = resolve(NotificationService::class);
        $result = $svc->notifyPromotion(
            $this->user,
            'Promo Off',
            'Should stay inbox-only.',
            ['campaign_id' => 'c-off', 'dedupe_key' => 'promotion:c-off:user:'.$this->user->id],
            ['database', 'push']
        );

        $this->assertTrue($result['database']);
        $this->assertFalse($result['push']);
        $this->assertDatabaseHas('notifications', ['title' => 'Promo Off']);
        Http::assertNothingSent();
    }

    public function test_announcement_push_skipped_when_preference_off(): void
    {
        Http::fake();
        $this->user->forceFill(['notify_announcements' => false])->save();

        UserDevice::create([
            'user_id' => $this->user->id,
            'device_uuid' => 'device-ann-off',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[ann]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        $svc = resolve(NotificationService::class);
        $result = $svc->notifyAnnouncement(
            $this->user,
            'Info Off',
            'Inbox only.',
            ['announcement_id' => 'a-off', 'dedupe_key' => 'announcement:a-off:user:'.$this->user->id],
            ['database', 'push']
        );

        $this->assertTrue($result['database']);
        $this->assertFalse($result['push']);
        Http::assertNothingSent();
    }

    public function test_push_failure_does_not_remove_inbox(): void
    {
        Http::fake([
            'exp.host/*' => Http::response(['errors' => [['message' => 'fail']]], 500),
        ]);

        UserDevice::create([
            'user_id' => $this->user->id,
            'device_uuid' => 'device-push-fail',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[fail]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        $svc = resolve(NotificationService::class);
        $result = $svc->notifyAnnouncement(
            $this->user,
            'Push Fail Inbox Keep',
            'Inbox must remain.',
            ['announcement_id' => 'pf-1', 'dedupe_key' => 'announcement:pf-1:user:'.$this->user->id],
            ['database', 'push']
        );

        $this->assertTrue($result['database']);
        $this->assertFalse($result['push']);
        $this->assertDatabaseHas('notifications', ['title' => 'Push Fail Inbox Keep']);
        $this->assertSame(1, UserNotification::where('user_id', $this->user->id)->count());
    }

    public function test_device_register_accepts_expo_provider_and_binds_user(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'uuid-expo-1',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[abc]',
            'push_provider' => 'expo',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('user_devices', [
            'device_uuid' => 'uuid-expo-1',
            'user_id' => $this->user->id,
            'push_provider' => 'expo',
            'is_active' => 1,
        ]);
    }

    public function test_device_disassociate_clears_user_and_token(): void
    {
        Sanctum::actingAs($this->user);

        UserDevice::create([
            'user_id' => $this->user->id,
            'device_uuid' => 'uuid-disassoc',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[keep]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/devices/disassociate', [
            'device_uuid' => 'uuid-disassoc',
            'platform' => 'android',
        ]);

        $response->assertOk();
        $device = UserDevice::where('device_uuid', 'uuid-disassoc')->first();
        $this->assertNotNull($device);
        $this->assertNull($device->user_id);
        $this->assertNull($device->push_token);
        $this->assertFalse((bool) $device->is_active);
    }

    public function test_account_switch_requires_disassociate_before_rebinding(): void
    {
        $userB = User::create([
            'name' => 'User B',
            'email' => 'user-b@gurkypay.com',
            'phone_number' => '081234567801',
            'password' => Hash::make('password123'),
        ]);

        UserDevice::create([
            'user_id' => $this->user->id,
            'device_uuid' => 'shared-device',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[shared]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        // P0 #4 — B cannot steal while A still owns the row.
        Sanctum::actingAs($userB);
        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'shared-device',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[shared-b]',
            'push_provider' => 'expo',
        ])->assertForbidden();

        $this->assertSame($this->user->id, UserDevice::where('device_uuid', 'shared-device')->value('user_id'));

        Sanctum::actingAs($this->user);
        $this->postJson('/api/v1/devices/disassociate', [
            'device_uuid' => 'shared-device',
            'platform' => 'android',
        ])->assertOk();

        Sanctum::actingAs($userB);
        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'shared-device',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[shared-b]',
            'push_provider' => 'expo',
        ])->assertCreated();

        $device = UserDevice::where('device_uuid', 'shared-device')->first();
        $this->assertSame($userB->id, $device->user_id);
        $this->assertSame('ExponentPushToken[shared-b]', $device->push_token);
    }

    public function test_register_without_push_token_does_not_wipe_existing_token(): void
    {
        Sanctum::actingAs($this->user);

        UserDevice::create([
            'user_id' => $this->user->id,
            'device_uuid' => 'uuid-keep-token',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[keep-me]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'uuid-keep-token',
            'platform' => 'android',
        ])->assertCreated();

        $device = UserDevice::where('device_uuid', 'uuid-keep-token')->first();
        $this->assertSame('ExponentPushToken[keep-me]', $device->push_token);
    }

    public function test_notification_resource_exposes_category_and_deep_link(): void
    {
        Sanctum::actingAs($this->user);
        $svc = resolve(NotificationService::class);
        $svc->notifyAnnouncement(
            $this->user,
            'Informasi Layanan',
            'Beberapa layanan sedang mengalami gangguan.',
            [
                'announcement_id' => 'svc-1',
                'deep_link' => '/pengumuman/svc-1',
                'dedupe_key' => 'announcement:svc-1:user:'.$this->user->id,
            ],
            ['database']
        );

        $response = $this->getJson('/api/v1/notifications');
        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('title', 'Informasi Layanan');
        $this->assertNotNull($row);
        $this->assertSame('announcement', $row['type']);
        $this->assertSame('announcement', $row['category']);
        $this->assertSame('/pengumuman/svc-1', $row['deepLink']);
        $this->assertSame('svc-1', $row['announcementId']);
    }

    public function test_expo_push_succeeds_without_fcm_server_key(): void
    {
        Http::fake([
            'exp.host/*' => Http::response(['data' => ['status' => 'ok', 'id' => 'ticket-1']], 200),
        ]);

        // Ensure FCM path is not required for Expo tokens.
        config(['services.fcm.server_key' => null]);

        UserDevice::create([
            'user_id' => $this->user->id,
            'device_uuid' => 'device-expo-ok',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[audit-ok]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        $svc = resolve(NotificationService::class);
        $result = $svc->notifyAnnouncement(
            $this->user,
            'Expo Push OK',
            'Should use Expo API only.',
            ['announcement_id' => 'expo-ok', 'dedupe_key' => 'announcement:expo-ok:user:'.$this->user->id],
            ['database', 'push']
        );

        $this->assertTrue($result['database']);
        $this->assertTrue($result['push']);
        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'exp.host')
                && ($request['to'] ?? null) === 'ExponentPushToken[audit-ok]'
                && ($request['channelId'] ?? null) === 'default'
                && ($request['data']['type'] ?? null) === 'announcement';
        });
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'fcm.googleapis.com'));
    }

    public function test_duplicate_dedupe_skips_second_push(): void
    {
        Http::fake([
            'exp.host/*' => Http::response(['data' => ['status' => 'ok', 'id' => 'ticket-dup']], 200),
        ]);

        UserDevice::create([
            'user_id' => $this->user->id,
            'device_uuid' => 'device-dedupe-push',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[dedupe]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        $svc = resolve(NotificationService::class);
        $payload = [
            'category' => 'transaction',
            'transaction_id' => 99,
            'invoice_number' => 'INV-DEDUP',
            'deep_link' => '/riwayat/99',
            'dedupe_key' => 'customer_final:99',
        ];

        $first = $svc->send($this->user, 'Pembelian Berhasil', 'OK', 'transaction_success', ['database', 'push'], $payload);
        $second = $svc->send($this->user, 'Pembelian Berhasil', 'OK again', 'transaction_success', ['database', 'push'], $payload);

        $this->assertTrue($first['database']);
        $this->assertTrue($first['push']);
        $this->assertTrue($second['database']);
        $this->assertFalse($second['push']);
        $this->assertSame(1, Notification::where('dedupe_key', 'customer_final:99')->count());
        Http::assertSentCount(1);
    }
}
