<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\OtpCode;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Forgot PIN OTP security — OTP must be backend-validated; wrong OTP never changes PIN.
 */
class ForgotPinSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Forgot Pin User',
            'email' => 'forgot-pin@gurkynet.test',
            'phone_number' => '081298765432',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('482951'),
            'pin_updated_at' => now()->subDay(),
            'role' => UserRole::USER,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);

        Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W90001',
            'balance' => 50000,
            'status' => 'active',
        ]);
    }

    protected function requestOtp(): string
    {
        $response = $this->postJson('/api/v1/auth/pin/forgot/request', [
            'email' => $this->user->email,
        ]);
        $response->assertStatus(200);
        $code = $response->json('data.dummy_sent_code');
        $this->assertNotEmpty($code);

        return (string) $code;
    }

    public function test_forgot_pin_otp_correct_then_new_pin_succeeds(): void
    {
        $otp = $this->requestOtp();

        $this->postJson('/api/v1/auth/pin/forgot/verify-otp', [
            'email' => $this->user->email,
            'otp_code' => $otp,
        ])->assertStatus(200)
            ->assertJsonPath('data.verified', true);

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => $otp,
            'pin' => '583962',
            'pin_confirmation' => '583962',
        ])->assertStatus(200);

        $this->user->refresh();
        $this->assertTrue(Hash::check('583962', $this->user->transaction_pin));
    }

    public function test_forgot_pin_otp_wrong_rejected_and_pin_unchanged(): void
    {
        $this->requestOtp();

        $this->postJson('/api/v1/auth/pin/forgot/verify-otp', [
            'email' => $this->user->email,
            'otp_code' => '000000',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => '000000',
            'pin' => '583962',
            'pin_confirmation' => '583962',
        ])->assertStatus(422);

        $this->user->refresh();
        $this->assertTrue(Hash::check('482951', $this->user->transaction_pin));
    }

    public function test_forgot_pin_otp_random_rejected(): void
    {
        $this->requestOtp();

        $this->postJson('/api/v1/auth/pin/forgot/verify-otp', [
            'email' => $this->user->email,
            'otp_code' => '999888',
        ])->assertStatus(422);

        $this->user->refresh();
        $this->assertTrue(Hash::check('482951', $this->user->transaction_pin));
    }

    public function test_forgot_pin_otp_expired_rejected(): void
    {
        $otp = $this->requestOtp();

        OtpCode::query()
            ->where('phone_number', $this->user->email)
            ->where('action', 'forgot_pin')
            ->where('is_used', false)
            ->update(['expires_at' => now()->subMinute()]);

        $this->postJson('/api/v1/auth/pin/forgot/verify-otp', [
            'email' => $this->user->email,
            'otp_code' => $otp,
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => $otp,
            'pin' => '583962',
            'pin_confirmation' => '583962',
        ])->assertStatus(422);

        $this->user->refresh();
        $this->assertTrue(Hash::check('482951', $this->user->transaction_pin));
    }

    public function test_forgot_pin_otp_cannot_be_reused_after_confirm(): void
    {
        $otp = $this->requestOtp();

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => $otp,
            'pin' => '583962',
            'pin_confirmation' => '583962',
        ])->assertStatus(200);

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => $otp,
            'pin' => '694073',
            'pin_confirmation' => '694073',
        ])->assertStatus(422);

        $this->user->refresh();
        $this->assertTrue(Hash::check('583962', $this->user->transaction_pin));
        $this->assertFalse(Hash::check('694073', $this->user->transaction_pin));
    }

    public function test_forgot_pin_email_mismatch_rejected(): void
    {
        $otp = $this->requestOtp();

        $this->postJson('/api/v1/auth/pin/forgot/verify-otp', [
            'email' => 'other@gurkynet.test',
            'otp_code' => $otp,
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => 'other@gurkynet.test',
            'otp_code' => $otp,
            'pin' => '583962',
            'pin_confirmation' => '583962',
        ])->assertStatus(422);

        $this->user->refresh();
        $this->assertTrue(Hash::check('482951', $this->user->transaction_pin));
    }

    public function test_forgot_pin_confirmation_mismatch_rejected(): void
    {
        $otp = $this->requestOtp();

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => $otp,
            'pin' => '583962',
            'pin_confirmation' => '583963',
        ])->assertStatus(422);

        $this->user->refresh();
        $this->assertTrue(Hash::check('482951', $this->user->transaction_pin));
    }

    public function test_client_cannot_bypass_otp_with_spoof_verified_flags(): void
    {
        $this->requestOtp();

        $this->postJson('/api/v1/auth/pin/forgot/verify-otp', [
            'email' => $this->user->email,
            'otp_code' => '123456',
            'verified' => true,
            'otp_verified' => true,
            'otp_valid' => true,
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => '123456',
            'pin' => '583962',
            'pin_confirmation' => '583962',
            'verified' => true,
            'otp_verified' => true,
        ])->assertStatus(422);

        $this->user->refresh();
        $this->assertTrue(Hash::check('482951', $this->user->transaction_pin));
    }

    public function test_change_pin_old_pin_only_still_works(): void
    {
        Sanctum::actingAs($this->user);

        $this->putJson('/api/v1/pin/change', [
            'old_pin' => '482951',
            'pin' => '583962',
            'pin_confirmation' => '583962',
        ])->assertStatus(200);

        $this->user->refresh();
        $this->assertTrue(Hash::check('583962', $this->user->transaction_pin));
    }

    public function test_verify_otp_route_is_registered(): void
    {
        $routes = collect(\Illuminate\Support\Facades\Route::getRoutes())
            ->map(fn ($r) => method_exists($r, 'uri') ? $r->uri() : '')
            ->filter()
            ->values()
            ->all();

        $this->assertContains('api/v1/auth/pin/forgot/verify-otp', $routes);
    }

    public function test_verify_otp_gate_does_not_consume_otp(): void
    {
        $otp = $this->requestOtp();

        $this->postJson('/api/v1/auth/pin/forgot/verify-otp', [
            'email' => $this->user->email,
            'otp_code' => $otp,
        ])->assertStatus(200);

        $active = OtpCode::query()
            ->where('phone_number', $this->user->email)
            ->where('action', 'forgot_pin')
            ->where('is_used', false)
            ->exists();
        $this->assertTrue($active);

        $this->postJson('/api/v1/auth/pin/forgot/confirm', [
            'email' => $this->user->email,
            'otp_code' => $otp,
            'pin' => '583962',
            'pin_confirmation' => '583962',
        ])->assertStatus(200);
    }
}
