<?php

namespace Tests\Feature;

use App\Models\OnboardingAttempt;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Security\OnboardingFinalizeTokenService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * P0 — onboarding finalize authorization / identity binding.
 * onboarding_id is locator only; finalize_token is the capability.
 */
class OnboardingFinalizeAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{attempt: OnboardingAttempt, otp: string}
     */
    private function startRegistration(string $email = 'alice@gurkynet.test', string $phone = '081555111222'): array
    {
        $register = $this->postJson('/api/v1/auth/register', [
            'name' => 'Alice Onboard',
            'email' => $email,
            'phone_number' => $phone,
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);
        $register->assertStatus(201);

        $attempt = OnboardingAttempt::query()->findOrFail((int) $register->json('data.onboarding_id'));
        $otp = (string) $register->json('data.dummy_sent_code');

        return ['attempt' => $attempt, 'otp' => $otp];
    }

    /**
     * @return array{attempt: OnboardingAttempt, finalize_token: string}
     */
    private function verifyOtpFor(OnboardingAttempt $attempt, string $otp): array
    {
        $verify = $this->postJson('/api/v1/auth/otp/verify', [
            'onboarding_id' => $attempt->id,
            'code' => $otp,
            'action' => 'onboarding_registration',
        ]);
        $verify->assertStatus(200)
            ->assertJsonPath('data.verified', true)
            ->assertJsonStructure(['data' => ['finalize_token', 'finalize_token_expires_at']]);

        $token = (string) $verify->json('data.finalize_token');
        $this->assertNotSame('', $token);
        $this->assertGreaterThanOrEqual(32, strlen($token));

        $attempt->refresh();
        $this->assertNotNull($attempt->otp_verified_at);
        $this->assertNotNull($attempt->finalize_token_hash);
        $this->assertNull($attempt->finalize_token_consumed_at);
        // Plaintext must never be persisted.
        $this->assertStringNotContainsString($token, (string) $attempt->finalize_token_hash);
        $this->assertDatabaseMissing('onboarding_attempts', [
            'id' => $attempt->id,
            'finalize_token_hash' => $token,
        ]);

        return ['attempt' => $attempt, 'finalize_token' => $token];
    }

    private function finalizePayload(int $onboardingId, string $finalizeToken, array $extra = []): array
    {
        return array_merge([
            'onboarding_id' => $onboardingId,
            'finalize_token' => $finalizeToken,
            'pin' => '482951',
            'pin_confirmation' => '482951',
            'accept_policies' => true,
        ], $extra);
    }

    public function test_1_finalize_before_otp_verification_rejected(): void
    {
        ['attempt' => $attempt] = $this->startRegistration();

        $this->postJson('/api/v1/auth/register/finalize', $this->finalizePayload(
            $attempt->id,
            bin2hex(random_bytes(32))
        ))->assertStatus(422);
    }

    public function test_2_otp_verify_then_finalize_with_valid_token_succeeds(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration();
        ['finalize_token' => $token] = $this->verifyOtpFor($attempt, $otp);

        $this->postJson('/api/v1/auth/register/finalize', $this->finalizePayload($attempt->id, $token), [
            'X-Device-UUID' => 'device-finalize-ok',
            'X-Platform' => 'web',
        ])->assertStatus(200)
            ->assertJsonStructure(['data' => ['token', 'user']]);

        $this->assertDatabaseHas('users', ['email' => 'alice@gurkynet.test']);
        $user = User::query()->where('email', 'alice@gurkynet.test')->firstOrFail();
        $this->assertEquals(1, Wallet::query()->where('user_id', $user->id)->count());
        $this->assertDatabaseMissing('onboarding_attempts', ['id' => $attempt->id]);
    }

    public function test_3_finalize_without_token_rejected(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration();
        $this->verifyOtpFor($attempt, $otp);

        $this->postJson('/api/v1/auth/register/finalize', [
            'onboarding_id' => $attempt->id,
            'pin' => '482951',
            'pin_confirmation' => '482951',
            'accept_policies' => true,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['finalize_token'], 'errors');
    }

    public function test_4_attacker_with_onboarding_id_only_rejected(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration();
        $this->verifyOtpFor($attempt, $otp);

        // Attacker knows ID, omits / invents nothing useful — still needs real token.
        $this->postJson('/api/v1/auth/register/finalize', [
            'onboarding_id' => $attempt->id,
            'pin' => '482951',
            'pin_confirmation' => '482951',
            'accept_policies' => true,
        ])->assertStatus(422);
    }

    public function test_5_attacker_with_random_token_rejected(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration();
        $this->verifyOtpFor($attempt, $otp);

        $this->postJson('/api/v1/auth/register/finalize', $this->finalizePayload(
            $attempt->id,
            bin2hex(random_bytes(32))
        ))->assertStatus(422);

        $this->assertDatabaseMissing('users', ['email' => 'alice@gurkynet.test']);
    }

    public function test_6_expired_finalize_token_rejected(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration();
        ['finalize_token' => $token] = $this->verifyOtpFor($attempt, $otp);

        $attempt->forceFill([
            'finalize_token_expires_at' => now()->subMinute(),
        ])->save();

        $this->postJson('/api/v1/auth/register/finalize', $this->finalizePayload($attempt->id, $token))
            ->assertStatus(422);

        $this->assertDatabaseMissing('users', ['email' => 'alice@gurkynet.test']);
    }

    public function test_7_finalize_token_single_use(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration();
        ['finalize_token' => $token] = $this->verifyOtpFor($attempt, $otp);

        $payload = $this->finalizePayload($attempt->id, $token);
        $this->postJson('/api/v1/auth/register/finalize', $payload, [
            'X-Device-UUID' => 'device-once',
            'X-Platform' => 'web',
        ])->assertStatus(200);

        $this->postJson('/api/v1/auth/register/finalize', $payload, [
            'X-Device-UUID' => 'device-once-2',
            'X-Platform' => 'web',
        ])->assertStatus(422);

        $this->assertEquals(1, User::query()->where('email', 'alice@gurkynet.test')->count());
        $user = User::query()->where('email', 'alice@gurkynet.test')->firstOrFail();
        $this->assertEquals(1, Wallet::query()->where('user_id', $user->id)->count());
    }

    public function test_8_concurrentish_double_finalize_one_account(): void
    {
        // Application-level race simulation (sequential under lock); true multi-worker NEEDS LIVE TEST.
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration('race@gurkynet.test', '081555333444');
        ['finalize_token' => $token] = $this->verifyOtpFor($attempt, $otp);

        $payload = $this->finalizePayload($attempt->id, $token);
        $r1 = $this->postJson('/api/v1/auth/register/finalize', $payload, [
            'X-Device-UUID' => 'race-a',
            'X-Platform' => 'web',
        ]);
        $r2 = $this->postJson('/api/v1/auth/register/finalize', $payload, [
            'X-Device-UUID' => 'race-b',
            'X-Platform' => 'web',
        ]);

        $ok = collect([$r1->status(), $r2->status()])->filter(fn ($s) => $s === 200)->count();
        $this->assertSame(1, $ok);
        $this->assertEquals(1, User::query()->where('email', 'race@gurkynet.test')->count());
        $user = User::query()->where('email', 'race@gurkynet.test')->firstOrFail();
        $this->assertEquals(1, Wallet::query()->where('user_id', $user->id)->count());
    }

    public function test_9_client_identity_override_fields_ignored(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration('bound@gurkynet.test', '081555666777');
        ['finalize_token' => $token] = $this->verifyOtpFor($attempt, $otp);

        $this->postJson('/api/v1/auth/register/finalize', $this->finalizePayload($attempt->id, $token, [
            'email' => 'attacker@evil.test',
            'phone_number' => '081999888777',
            'phone' => '081999888777',
            'user_id' => 999999,
            'wallet_id' => 888888,
            'otp_verified' => true,
            'status' => 'verified',
            'name' => 'Attacker Name',
        ]), [
            'X-Device-UUID' => 'device-identity',
            'X-Platform' => 'web',
        ])->assertStatus(200);

        $user = User::query()->where('email', 'bound@gurkynet.test')->firstOrFail();
        $this->assertSame('081555666777', $user->phone_number);
        $this->assertSame('Alice Onboard', $user->name);
        $this->assertDatabaseMissing('users', ['email' => 'attacker@evil.test']);
    }

    public function test_10_otp_replay_rejected(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration('replay@gurkynet.test', '081555000111');
        $this->verifyOtpFor($attempt, $otp);

        $this->postJson('/api/v1/auth/otp/verify', [
            'onboarding_id' => $attempt->id,
            'code' => $otp,
            'action' => 'onboarding_registration',
        ])->assertStatus(422);
    }

    public function test_11_completed_onboarding_cannot_finalize_again(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration('done@gurkynet.test', '081555000222');
        ['finalize_token' => $token] = $this->verifyOtpFor($attempt, $otp);
        $id = $attempt->id;

        $this->postJson('/api/v1/auth/register/finalize', $this->finalizePayload($id, $token), [
            'X-Device-UUID' => 'device-done',
            'X-Platform' => 'web',
        ])->assertStatus(200);

        $this->postJson('/api/v1/auth/register/finalize', $this->finalizePayload($id, $token), [
            'X-Device-UUID' => 'device-done-2',
            'X-Platform' => 'web',
        ])->assertStatus(422);

        $this->assertEquals(1, User::query()->where('email', 'done@gurkynet.test')->count());
    }

    public function test_12_verified_state_past_ttl_rejected(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration('ttl@gurkynet.test', '081555000333');
        ['finalize_token' => $token] = $this->verifyOtpFor($attempt, $otp);

        // Verified-state TTL is enforced via finalize_token_expires_at.
        DB::table('onboarding_attempts')->where('id', $attempt->id)->update([
            'finalize_token_expires_at' => now()->subMinutes(5),
        ]);

        $this->postJson('/api/v1/auth/register/finalize', $this->finalizePayload($attempt->id, $token))
            ->assertStatus(422);

        $this->assertDatabaseMissing('users', ['email' => 'ttl@gurkynet.test']);
    }

    public function test_13_cross_device_valid_token_allowed(): void
    {
        ['attempt' => $attempt, 'otp' => $otp] = $this->startRegistration('cross@gurkynet.test', '081555000444');
        ['finalize_token' => $token] = $this->verifyOtpFor($attempt, $otp);

        // Device B (different UUID) with valid finalize_token — proof-of-capability design.
        $this->postJson('/api/v1/auth/register/finalize', $this->finalizePayload($attempt->id, $token), [
            'X-Device-UUID' => 'device-b-other',
            'X-Platform' => 'android',
        ])->assertStatus(200)
            ->assertJsonStructure(['data' => ['token', 'user']]);
    }

    public function test_finalize_token_hash_uses_sha256_and_service_ttl(): void
    {
        $service = app(OnboardingFinalizeTokenService::class);
        $this->assertGreaterThanOrEqual(1, $service->ttlMinutes());

        $attempt = OnboardingAttempt::create([
            'name' => 'Hash Check',
            'email' => 'hashcheck@gurkynet.test',
            'phone_number' => '081555000555',
            'password' => Crypt::encryptString('password123'),
            'status' => 'verified',
            'otp_verified_at' => now(),
        ]);

        $plain = $service->issue($attempt);
        $attempt->refresh();
        $this->assertSame(hash('sha256', $plain), $attempt->finalize_token_hash);
        $this->assertTrue($attempt->finalize_token_expires_at->greaterThan(now()));
    }
}
