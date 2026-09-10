<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserDevice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * P0 #4 — anonymous / cross-user device & push-token ownership.
 */
class DevicePushAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected User $userA;

    protected User $userB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userA = User::create([
            'name' => 'Device User A',
            'email' => 'device-a@gurkypay.com',
            'phone_number' => '081234567810',
            'password' => Hash::make('password123'),
        ]);

        $this->userB = User::create([
            'name' => 'Device User B',
            'email' => 'device-b@gurkypay.com',
            'phone_number' => '081234567811',
            'password' => Hash::make('password123'),
        ]);
    }

    public function test_a_anonymous_register_rejected(): void
    {
        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'anon-uuid-1',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[anon]',
            'push_provider' => 'expo',
        ])->assertUnauthorized();

        $this->assertDatabaseMissing('user_devices', ['device_uuid' => 'anon-uuid-1']);
    }

    public function test_b_anonymous_push_token_rejected(): void
    {
        UserDevice::create([
            'user_id' => $this->userA->id,
            'device_uuid' => 'owned-uuid',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[a]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        $this->postJson('/api/v1/devices/push-token', [
            'device_uuid' => 'owned-uuid',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[stolen]',
            'push_provider' => 'expo',
        ])->assertUnauthorized();

        $this->assertDatabaseHas('user_devices', [
            'device_uuid' => 'owned-uuid',
            'user_id' => $this->userA->id,
            'push_token' => 'ExponentPushToken[a]',
        ]);
    }

    public function test_c_user_a_register_device_success(): void
    {
        Sanctum::actingAs($this->userA);

        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'uuid-a-1',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[a1]',
            'push_provider' => 'expo',
        ])->assertCreated();

        $this->assertDatabaseHas('user_devices', [
            'device_uuid' => 'uuid-a-1',
            'user_id' => $this->userA->id,
            'push_provider' => 'expo',
            'is_active' => 1,
        ]);
    }

    public function test_d_user_b_cannot_take_over_user_a_device(): void
    {
        UserDevice::create([
            'user_id' => $this->userA->id,
            'device_uuid' => 'shared-hijack',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[a]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        Sanctum::actingAs($this->userB);
        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'shared-hijack',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[b]',
            'push_provider' => 'expo',
        ])->assertForbidden();

        $device = UserDevice::where('device_uuid', 'shared-hijack')->first();
        $this->assertSame($this->userA->id, $device->user_id);
        $this->assertSame('ExponentPushToken[a]', $device->push_token);
    }

    public function test_e_user_a_update_push_token_success(): void
    {
        Sanctum::actingAs($this->userA);
        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'uuid-token-a',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[old]',
            'push_provider' => 'expo',
        ])->assertCreated();

        $this->postJson('/api/v1/devices/push-token', [
            'device_uuid' => 'uuid-token-a',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[new]',
            'push_provider' => 'expo',
        ])->assertOk();

        $this->assertDatabaseHas('user_devices', [
            'device_uuid' => 'uuid-token-a',
            'user_id' => $this->userA->id,
            'push_token' => 'ExponentPushToken[new]',
        ]);
    }

    public function test_f_user_b_push_token_on_a_uuid_denied(): void
    {
        UserDevice::create([
            'user_id' => $this->userA->id,
            'device_uuid' => 'uuid-token-protect',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[keep]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        Sanctum::actingAs($this->userB);
        $this->postJson('/api/v1/devices/push-token', [
            'device_uuid' => 'uuid-token-protect',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[attacker]',
            'push_provider' => 'expo',
        ])->assertNotFound();

        $this->assertDatabaseHas('user_devices', [
            'device_uuid' => 'uuid-token-protect',
            'user_id' => $this->userA->id,
            'push_token' => 'ExponentPushToken[keep]',
        ]);
    }

    public function test_g_body_user_id_owner_id_cannot_set_ownership(): void
    {
        Sanctum::actingAs($this->userA);

        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'uuid-ignore-ids',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[a]',
            'push_provider' => 'expo',
            'user_id' => $this->userB->id,
            'owner_id' => $this->userB->id,
        ])->assertStatus(422);

        Sanctum::actingAs($this->userA);
        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'uuid-ignore-ids',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[a]',
            'push_provider' => 'expo',
        ])->assertCreated();

        $this->assertDatabaseHas('user_devices', [
            'device_uuid' => 'uuid-ignore-ids',
            'user_id' => $this->userA->id,
        ]);
        $this->assertDatabaseMissing('user_devices', [
            'device_uuid' => 'uuid-ignore-ids',
            'user_id' => $this->userB->id,
        ]);
    }

    public function test_h_account_switch_after_disassociate_allows_claim(): void
    {
        Sanctum::actingAs($this->userA);
        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'switch-device',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[a]',
            'push_provider' => 'expo',
        ])->assertCreated();

        $this->postJson('/api/v1/devices/disassociate', [
            'device_uuid' => 'switch-device',
            'platform' => 'android',
        ])->assertOk();

        $unbound = UserDevice::where('device_uuid', 'switch-device')->first();
        $this->assertNull($unbound->user_id);
        $this->assertNull($unbound->push_token);

        Sanctum::actingAs($this->userB);
        $this->postJson('/api/v1/devices/register', [
            'device_uuid' => 'switch-device',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[b]',
            'push_provider' => 'expo',
        ])->assertCreated();

        $device = UserDevice::where('device_uuid', 'switch-device')->first();
        $this->assertSame($this->userB->id, $device->user_id);
        $this->assertSame('ExponentPushToken[b]', $device->push_token);
    }

    public function test_i_legacy_refresh_cannot_steal_other_user_device(): void
    {
        UserDevice::create([
            'user_id' => $this->userA->id,
            'device_uuid' => 'refresh-steal',
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[a]',
            'push_provider' => 'expo',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        Sanctum::actingAs($this->userB);
        $this->postJson('/api/v1/auth/refresh', [], [
            'X-Device-UUID' => 'refresh-steal',
            'X-Platform' => 'android',
        ])->assertOk();

        $device = UserDevice::where('device_uuid', 'refresh-steal')->first();
        $this->assertSame($this->userA->id, $device->user_id);
        $this->assertSame('ExponentPushToken[a]', $device->push_token);
    }

    public function test_register_idempotent_for_same_owner(): void
    {
        Sanctum::actingAs($this->userA);
        $payload = [
            'device_uuid' => 'idem-uuid',
            'platform' => 'android',
            'device_model' => 'Pixel',
        ];
        $this->postJson('/api/v1/devices/register', $payload)->assertCreated();
        $this->postJson('/api/v1/devices/register', array_merge($payload, [
            'device_model' => 'Pixel 8',
        ]))->assertCreated();

        $this->assertSame(1, UserDevice::where('device_uuid', 'idem-uuid')->count());
        $this->assertSame('Pixel 8', UserDevice::where('device_uuid', 'idem-uuid')->value('device_model'));
        $this->assertSame($this->userA->id, (int) UserDevice::where('device_uuid', 'idem-uuid')->value('user_id'));
    }
}
