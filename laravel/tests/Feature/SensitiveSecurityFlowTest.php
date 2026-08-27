<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\UserDevice;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SensitiveSecurityFlowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Security User',
            'email' => 'security@gurkynet.test',
            'phone_number' => '081234567890',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('482951'),
            'pin_updated_at' => now()->subDay(),
            'role' => UserRole::USER,
            'email_verified_at' => now(),
        ]);

        Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W30001',
            'balance' => 100000,
            'status' => 'active',
        ]);
    }

    public function test_registration_otp_and_finalize_pin_flow(): void
    {
        $register = $this->postJson('/api/v1/auth/register', [
            'name' => 'Pending User',
            'email' => 'pending@gurkynet.test',
            'phone_number' => '081555444333',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $register->assertStatus(201);
        $otp = $register->json('data.dummy_sent_code');
        $onboardingId = $register->json('data.onboarding_id');

        $this->postJson('/api/v1/auth/otp/verify', [
            'onboarding_id' => $onboardingId,
            'code' => $otp,
            'action' => 'onboarding_registration',
        ])->assertStatus(200);

        $this->postJson('/api/v1/auth/register/finalize', [
            'onboarding_id' => $onboardingId,
            'pin' => '482951',
            'pin_confirmation' => '482951',
            'accept_policies' => true,
        ], [
            'X-Device-UUID' => 'device-onboard-1',
            'X-Platform' => 'web',
        ])->assertStatus(200)
            ->assertJsonStructure(['data' => ['token', 'user']]);

        $this->assertDatabaseHas('users', [
            'email' => 'pending@gurkynet.test',
            'phone_number' => '081555444333',
        ]);
    }

    public function test_login_pin_requires_trusted_device(): void
    {
        UserDevice::create([
            'user_id' => $this->user->id,
            'device_uuid' => 'trusted-device-1',
            'platform' => 'web',
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        $this->postJson('/api/v1/auth/login/pin', [
            'identity' => $this->user->email,
            'pin' => '482951',
        ], [
            'X-Device-UUID' => 'trusted-device-1',
            'X-Platform' => 'web',
        ])->assertStatus(200);

        $this->postJson('/api/v1/auth/login/pin', [
            'identity' => $this->user->email,
            'pin' => '482951',
        ], [
            'X-Device-UUID' => 'new-device-2',
            'X-Platform' => 'web',
        ])->assertStatus(403);
    }

    public function test_change_password_flow(): void
    {
        Sanctum::actingAs($this->user);

        $request = $this->postJson('/api/v1/account-security/password/change/request', [
            'old_password' => 'password123',
            'pin' => '482951',
        ]);

        $otp = $request->json('data.dummy_sent_code');

        $this->postJson('/api/v1/account-security/password/change/confirm', [
            'otp_code' => $otp,
            'new_password' => 'password456',
            'new_password_confirmation' => 'password456',
        ], [
            'X-Device-UUID' => 'device-current',
        ])->assertStatus(200);

        $this->user->refresh();
        $this->assertTrue(Hash::check('password456', $this->user->password));
        $this->assertDatabaseHas('activity_logs', ['user_id' => $this->user->id, 'activity' => 'password_changed']);
    }

    public function test_forgot_password_flow(): void
    {
        $request = $this->postJson('/api/v1/auth/password/forgot/request', [
            'email' => $this->user->email,
        ]);

        $otp = $request->json('data.dummy_sent_code');

        $this->postJson('/api/v1/auth/password/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => $otp,
            'new_password' => 'password789',
            'new_password_confirmation' => 'password789',
        ])->assertStatus(200);

        $this->user->refresh();
        $this->assertTrue(Hash::check('password789', $this->user->password));
        $this->assertDatabaseHas('activity_logs', ['user_id' => $this->user->id, 'activity' => 'password_reset']);
    }

    public function test_change_pin_and_forgot_pin_flows(): void
    {
        Sanctum::actingAs($this->user);

        $request = $this->postJson('/api/v1/account-security/pin/change/request', [
            'old_pin' => '482951',
        ]);
        $otp = $request->json('data.dummy_sent_code');

        $this->postJson('/api/v1/account-security/pin/change/confirm', [
            'otp_code' => $otp,
            'pin' => '482963',
            'pin_confirmation' => '482963',
        ])->assertStatus(200);

        $this->user->refresh();
        $this->assertTrue(Hash::check('482963', $this->user->transaction_pin));

        $requestForgot = $this->postJson('/api/v1/auth/pin/forgot/request', [
            'email' => $this->user->email,
        ]);
        $forgotOtp = $requestForgot->json('data.dummy_sent_code');

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => $forgotOtp,
            'pin' => '482974',
            'pin_confirmation' => '482974',
        ])->assertStatus(200);

        $this->user->refresh();
        $this->assertTrue(Hash::check('482974', $this->user->transaction_pin));
    }

    public function test_change_email_and_phone_flows(): void
    {
        Sanctum::actingAs($this->user);

        $request = $this->postJson('/api/v1/account-security/email/change/request', [
            'password' => 'password123',
            'pin' => '482951',
            'new_email' => 'new-security@gurkynet.test',
        ]);
        $oldOtp = $request->json('data.dummy_sent_code');

        $requestNew = $this->postJson('/api/v1/account-security/email/change/verify-old', [
            'otp_code' => $oldOtp,
            'new_email' => 'new-security@gurkynet.test',
        ]);
        $newOtp = $requestNew->json('data.dummy_sent_code');

        $this->postJson('/api/v1/account-security/email/change/verify-new', [
            'new_email' => 'new-security@gurkynet.test',
            'otp_code' => $newOtp,
        ])->assertStatus(200);

        $this->user->refresh();
        $this->assertSame('new-security@gurkynet.test', $this->user->email);

        $phoneRequest = $this->postJson('/api/v1/account-security/phone/change/request', [
            'password' => 'password123',
            'pin' => '482951',
            'new_phone' => '081234567891',
        ]);
        $phoneOtp = $phoneRequest->json('data.dummy_sent_code');

        $this->postJson('/api/v1/account-security/phone/change/confirm', [
            'otp_code' => $phoneOtp,
            'new_phone' => '081234567891',
        ])->assertStatus(200);

        $this->user->refresh();
        $this->assertSame('081234567891', $this->user->phone_number);
    }
}
