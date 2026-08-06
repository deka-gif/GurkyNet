<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\OtpCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test successful pending registration onboarding.
     */
    public function test_register_success(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Budi Setiawan',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081234567890',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'onboarding_id',
                    'email',
                    'status',
                    'expires_at',
                    'user' => ['name', 'email'],
                ],
            ]);

        $this->assertDatabaseHas('onboarding_attempts', [
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081234567890',
        ]);
        $this->assertDatabaseMissing('users', [
            'email' => 'budi@gurkypay.com',
        ]);
    }

    /**
     * Test successful login with correct credentials.
     */
    public function test_login_success(): void
    {
        $user = User::create([
            'name' => 'Budi Setiawan',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081234567890',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'phone_or_email' => 'budi@gurkypay.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'user',
                    'token',
                ],
            ]);
    }

    /**
     * Test logout revoking the current Sanctum token.
     */
    public function test_logout_success(): void
    {
        $user = User::create([
            'name' => 'Budi Setiawan',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081234567890',
            'password' => Hash::make('password123'),
        ]);

        $token = $user->createToken('test-device')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Logout berhasil dilakukan.',
            ]);

        $this->assertCount(0, $user->tokens);
    }

    /**
     * Test successful request for a new OTP code.
     */
    public function test_request_otp(): void
    {
        $response = $this->postJson('/api/v1/auth/otp/request', [
            'phone_number' => '081234567890',
            'action' => 'password_reset',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'phone_number',
                    'action',
                    'expires_at',
                ],
            ]);

        // OTP plaintext is only returned in local/testing sandbox mode.
        if (app()->environment('local', 'testing')) {
            $response->assertJsonStructure([
                'data' => ['dummy_sent_code'],
            ]);
        } else {
            $response->assertJsonMissingPath('data.dummy_sent_code');
        }

        $this->assertDatabaseHas('otp_codes', [
            'phone_number' => '081234567890',
            'action' => 'password_reset',
            'is_used' => false,
        ]);
    }

    /**
     * Test successful verification of generated OTP.
     */
    public function test_verify_otp(): void
    {
        OtpCode::create([
            'phone_number' => '081234567890',
            'code' => '123456',
            'action' => 'verification',
            'is_used' => false,
            'expires_at' => now()->addMinutes(5),
        ]);

        $response = $this->postJson('/api/v1/auth/otp/verify', [
            'phone_number' => '081234567890',
            'code' => '123456',
            'action' => 'verification',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Kode OTP berhasil diverifikasi.',
            ]);
    }

    /**
     * Test forgot password reset.
     */
    public function test_reset_password(): void
    {
        $user = User::create([
            'name' => 'Budi Setiawan',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081234567890',
            'password' => Hash::make('oldpassword'),
        ]);

        OtpCode::create([
            'phone_number' => '081234567890',
            'code' => '999999',
            'action' => 'password_reset',
            'is_used' => false,
            'expires_at' => now()->addMinutes(5),
        ]);

        $response = $this->postJson('/api/v1/auth/password/reset', [
            'phone_number' => '081234567890',
            'otp_code' => '999999',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Kata sandi Anda berhasil diperbarui. Silakan login kembali.',
            ]);

        $user->refresh();
        $this->assertTrue(Hash::check('newpassword123', $user->password));
    }

    /**
     * Test setting and changing 6-digit transaction PIN.
     */
    public function test_change_pin(): void
    {
        $user = User::create([
            'name' => 'Budi Setiawan',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081234567890',
            'password' => Hash::make('password123'),
        ]);

        $token = $user->createToken('test-device')->plainTextToken;

        // Set initial transaction PIN
        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/auth/pin', [
                'new_pin' => '112233',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'PIN transaksi Anda berhasil diperbarui.',
            ]);

        $user->refresh();
        $this->assertTrue(Hash::check('112233', $user->transaction_pin));

        // Change transaction PIN with correct old PIN
        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/auth/pin', [
                'old_pin' => '112233',
                'new_pin' => '998877',
            ]);

        $response->assertStatus(200);

        $user->refresh();
        $this->assertTrue(Hash::check('998877', $user->transaction_pin));
    }
}
