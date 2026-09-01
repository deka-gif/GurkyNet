<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\KycVerification;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Kyc\WithdrawEligibilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 12 — SRS Bagian 8.1 / 17 (security) + Bagian 21 (KYC Agen).
 */
class Sprint12SecurityKycTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'features.purchase_enabled' => false,
            'features.withdraw_enabled' => false,
            'features.auto_topup_enabled' => false,
        ]);

        Storage::fake('local');
        RateLimiter::clear('login');
        RateLimiter::clear('otp');
        RateLimiter::clear('financial');
    }

    private function makeStaff(string $email, string $phone, UserRole $role): User
    {
        return User::create([
            'name' => $email,
            'email' => $email,
            'phone_number' => $phone,
            'password' => Hash::make('password123'),
            'role' => $role,
            'user_type' => 'staff',
            'transaction_pin' => Hash::make('123456'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ]);
    }

    private function makeEndUser(string $email, string $phone, array $overrides = []): User
    {
        return User::create(array_merge([
            'name' => 'Agen '.$email,
            'email' => $email,
            'phone_number' => $phone,
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'user_type' => 'agent',
            'agent_level' => 'basic',
            'transaction_pin' => Hash::make('123456'),
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ], $overrides));
    }

    private function login2faCode(string $email): string
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'phone_or_email' => $email,
            'password' => 'password123',
        ])->assertOk()
            ->assertJsonPath('data.requires_2fa', true);

        $code = $login->json('data.dummy_sent_code');
        $this->assertNotEmpty($code);

        return (string) $code;
    }

    // ——— 2FA ———

    public function test_01_finance_2fa_success(): void
    {
        $this->makeStaff('finance-s12@gurkynet.test', '081812200001', UserRole::FINANCE);
        $code = $this->login2faCode('finance-s12@gurkynet.test');

        $this->postJson('/api/v1/auth/login/2fa/verify', [
            'identity' => 'finance-s12@gurkynet.test',
            'code' => $code,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['token', 'user']]);
    }

    public function test_02_owner_2fa_success(): void
    {
        $this->makeStaff('owner-s12@gurkynet.test', '081812200002', UserRole::OWNER);
        $code = $this->login2faCode('owner-s12@gurkynet.test');

        $this->postJson('/api/v1/auth/login/2fa/verify', [
            'identity' => 'owner-s12@gurkynet.test',
            'code' => $code,
        ])->assertOk()
            ->assertJsonStructure(['data' => ['token']]);
    }

    public function test_03_wrong_otp_rejected(): void
    {
        $this->makeStaff('finance-s12b@gurkynet.test', '081812200003', UserRole::FINANCE);
        $this->login2faCode('finance-s12b@gurkynet.test');

        $this->postJson('/api/v1/auth/login/2fa/verify', [
            'identity' => 'finance-s12b@gurkynet.test',
            'code' => '000000',
        ])->assertStatus(422);
    }

    public function test_04_expired_otp_rejected(): void
    {
        $this->makeStaff('finance-s12c@gurkynet.test', '081812200004', UserRole::FINANCE);
        $code = $this->login2faCode('finance-s12c@gurkynet.test');

        \App\Models\OtpCode::query()
            ->where('phone_number', 'finance-s12c@gurkynet.test')
            ->where('action', 'login_2fa')
            ->update(['expires_at' => now()->subMinute()]);

        $this->postJson('/api/v1/auth/login/2fa/verify', [
            'identity' => 'finance-s12c@gurkynet.test',
            'code' => $code,
        ])->assertStatus(422);
    }

    public function test_05_missing_2fa_blocked_from_privileged_operation(): void
    {
        $this->makeStaff('finance-s12d@gurkynet.test', '081812200005', UserRole::FINANCE);
        $login = $this->postJson('/api/v1/auth/login', [
            'phone_or_email' => 'finance-s12d@gurkynet.test',
            'password' => 'password123',
        ])->assertOk();

        $this->assertTrue((bool) $login->json('data.requires_2fa'));
        $this->assertNull($login->json('data.token'));

        $this->getJson('/api/v1/admin/finance/dashboard')->assertUnauthorized();
    }

    // ——— Rate limit ———

    public function test_06_login_repeated_returns_429(): void
    {
        $this->makeEndUser('rate-login@gurkynet.test', '081812200010');

        for ($i = 0; $i < 20; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'phone_or_email' => 'rate-login@gurkynet.test',
                'password' => 'wrong-password',
            ]);
        }

        $this->postJson('/api/v1/auth/login', [
            'phone_or_email' => 'rate-login@gurkynet.test',
            'password' => 'wrong-password',
        ])->assertStatus(429);
    }

    public function test_07_otp_repeated_returns_429(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/otp/request', [
                'email' => 'otp-rate@gurkynet.test',
                'action' => 'verification',
            ]);
        }

        $this->postJson('/api/v1/auth/otp/request', [
            'email' => 'otp-rate@gurkynet.test',
            'action' => 'verification',
        ])->assertStatus(429);
    }

    public function test_08_sensitive_endpoint_rate_limit(): void
    {
        $user = $this->makeEndUser('fin-rate@gurkynet.test', '081812200011');
        Sanctum::actingAs($user);

        for ($i = 0; $i < 30; $i++) {
            $this->getJson('/api/v1/wallet');
        }

        $this->getJson('/api/v1/wallet')->assertStatus(429);
    }

    // ——— Session ———

    public function test_09_revoked_token_rejected(): void
    {
        $user = $this->makeEndUser('session-s12@gurkynet.test', '081812200012');
        $tokenKeep = $user->createToken('keep-device')->plainTextToken;
        $tokenRevoke = $user->createToken('revoke-device')->plainTextToken;
        $revokeId = (int) $user->tokens()->where('name', 'revoke-device')->value('id');

        $this->withToken($tokenRevoke)->getJson('/api/v1/auth/me')->assertOk();

        $this->withToken($tokenKeep)
            ->deleteJson('/api/v1/profile/sessions/'.$revokeId)
            ->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $revokeId]);

        $plainHash = str_contains($tokenRevoke, '|')
            ? explode('|', $tokenRevoke, 2)[1]
            : $tokenRevoke;
        $this->assertNull(\Laravel\Sanctum\PersonalAccessToken::findToken($plainHash));

        // Forget any sticky auth from previous request in the test client.
        $this->app['auth']->forgetGuards();

        $this->withToken($tokenRevoke)->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->withToken($tokenKeep)->getJson('/api/v1/auth/me')->assertOk();
    }

    // ——— Tier 1 ———

    public function test_10_unverified_phone_blocked_from_transaction(): void
    {
        config(['features.purchase_enabled' => true, 'features.purchase_kyc_required' => true]);
        $user = $this->makeEndUser('t1-phone@gurkynet.test', '081812200013', [
            'phone_verified_at' => null,
            'email_verified_at' => now(),
        ]);
        Wallet::create(['user_id' => $user->id, 'wallet_number' => '104812200013', 'balance' => 100000, 'status' => 'active']);

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/transactions', [
            'sku_code' => 'S12-PULSA',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    public function test_11_unverified_email_blocked_from_transaction(): void
    {
        config(['features.purchase_enabled' => true, 'features.purchase_kyc_required' => true]);
        $user = $this->makeEndUser('t1-email@gurkynet.test', '081812200014', [
            'phone_verified_at' => now(),
            'email_verified_at' => null,
        ]);
        Wallet::create(['user_id' => $user->id, 'wallet_number' => '104812200014', 'balance' => 100000, 'status' => 'active']);

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/transactions', [
            'sku_code' => 'S12-PULSA',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_12_both_verified_pass_tier1_gate(): void
    {
        config(['features.purchase_enabled' => false]);
        $user = $this->makeEndUser('t1-ok@gurkynet.test', '081812200015');
        Wallet::create(['user_id' => $user->id, 'wallet_number' => '104812200015', 'balance' => 100000, 'status' => 'active']);

        Sanctum::actingAs($user);
        $res = $this->postJson('/api/v1/transactions', [
            'sku_code' => 'S12-PULSA',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(422);

        $errors = $res->json('errors') ?? [];
        $this->assertArrayNotHasKey('phone', $errors);
        $this->assertArrayNotHasKey('email', $errors);
        $this->assertTrue(isset($errors['sku_code']) || str_contains(strtolower((string) $res->json('message')), 'aktif') || isset($errors['sku_code']));
    }

    public function test_purchase_skips_tier1_when_kyc_requirement_disabled(): void
    {
        config([
            'features.purchase_enabled' => true,
            'features.purchase_kyc_required' => false,
        ]);
        $user = $this->makeEndUser('t1-skip@gurkynet.test', '081812200016', [
            'phone_verified_at' => null,
            'email_verified_at' => null,
        ]);
        Wallet::create(['user_id' => $user->id, 'wallet_number' => '104812200016', 'balance' => 100000, 'status' => 'active']);

        Sanctum::actingAs($user);
        $res = $this->postJson('/api/v1/transactions', [
            'sku_code' => 'S12-PULSA',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertStatus(422);

        $errors = $res->json('errors') ?? [];
        $this->assertArrayNotHasKey('phone', $errors);
        $this->assertArrayNotHasKey('email', $errors);
    }

    // ——— KYC Tier 2 ———

    public function test_13_to_18_kyc_submit_upload_validation_and_private_storage(): void
    {
        $user = $this->makeEndUser('kyc-user@gurkynet.test', '081812200020');

        Sanctum::actingAs($user);
        $ok = $this->post('/api/v1/kyc/tier2/submit', [
            'ktp_full_name' => 'Budi Santoso',
            'ktp_number' => '3174010101010001',
            'bank_name' => 'BCA',
            'bank_account_name' => 'Budi Santoso',
            'bank_account_number' => '1234567890',
            'ktp_photo' => UploadedFile::fake()->image('ktp.jpg', 800, 600),
            'selfie_photo' => UploadedFile::fake()->image('selfie.jpg', 800, 600),
        ], ['Accept' => 'application/json'])->assertCreated();

        $id = (int) $ok->json('data.verification.id');
        $this->assertDatabaseHas('kyc_verifications', [
            'id' => $id,
            'user_id' => $user->id,
            'status' => 'pending',
        ]);

        $row = KycVerification::query()->findOrFail($id);
        $this->assertTrue(Storage::disk('local')->exists($row->ktp_photo_path));
        $this->assertTrue(Storage::disk('local')->exists($row->selfie_photo_path));
        $this->assertStringNotContainsString('http', $row->ktp_photo_path);
        $this->assertFalse(Storage::disk('public')->exists($row->ktp_photo_path));

        // Invalid MIME
        $user2 = $this->makeEndUser('kyc-bad@gurkynet.test', '081812200021');
        Sanctum::actingAs($user2);
        $this->post('/api/v1/kyc/tier2/submit', [
            'ktp_full_name' => 'Bad File',
            'ktp_number' => '3174010101010002',
            'bank_account_name' => 'Bad File',
            'bank_account_number' => '999',
            'ktp_photo' => UploadedFile::fake()->create('evil.php', 100, 'application/x-php'),
            'selfie_photo' => UploadedFile::fake()->image('selfie.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        // Oversized
        $this->post('/api/v1/kyc/tier2/submit', [
            'ktp_full_name' => 'Big File',
            'ktp_number' => '3174010101010003',
            'bank_account_name' => 'Big File',
            'bank_account_number' => '888',
            'ktp_photo' => UploadedFile::fake()->image('big.jpg')->size(6000),
            'selfie_photo' => UploadedFile::fake()->image('selfie.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->assertDatabaseHas('activity_logs', ['activity' => 'KYC_SUBMIT']);
    }

    public function test_19_20_idor_kyc_and_document(): void
    {
        $userA = $this->makeEndUser('kyc-a@gurkynet.test', '081812200030');
        $userB = $this->makeEndUser('kyc-b@gurkynet.test', '081812200031');

        Sanctum::actingAs($userA);
        $id = (int) $this->post('/api/v1/kyc/tier2/submit', [
            'ktp_full_name' => 'User A',
            'ktp_number' => '3174010101010099',
            'bank_account_name' => 'User A',
            'bank_account_number' => '111',
            'ktp_photo' => UploadedFile::fake()->image('ktp.jpg'),
            'selfie_photo' => UploadedFile::fake()->image('selfie.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.verification.id');

        Sanctum::actingAs($userB);
        $this->getJson('/api/v1/kyc/verifications/'.$id)->assertForbidden();
        $this->getJson('/api/v1/kyc/verifications/'.$id.'/documents/ktp')->assertForbidden();
    }

    // ——— Review ———

    public function test_21_to_26_cs_finance_review_resubmit(): void
    {
        $agent = $this->makeEndUser('kyc-rev@gurkynet.test', '081812200040');
        $cs = $this->makeStaff('cs-s12@gurkynet.test', '081812200041', UserRole::CUSTOMER_SUPPORT);
        $finance = $this->makeStaff('fin-rev@gurkynet.test', '081812200042', UserRole::FINANCE);
        $ops = $this->makeStaff('ops-s12@gurkynet.test', '081812200043', UserRole::OPERATIONS);

        Sanctum::actingAs($agent);
        $id = (int) $this->post('/api/v1/kyc/tier2/submit', [
            'ktp_full_name' => 'Review Agent',
            'ktp_number' => '3174010101010040',
            'bank_account_name' => 'Review Agent',
            'bank_account_number' => '555',
            'ktp_photo' => UploadedFile::fake()->image('ktp.jpg'),
            'selfie_photo' => UploadedFile::fake()->image('selfie.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.verification.id');

        Sanctum::actingAs($ops);
        $this->getJson('/api/v1/admin/customer-support/kyc')->assertForbidden();
        $this->postJson('/api/v1/admin/finance/kyc/'.$id.'/approve')->assertForbidden();

        Sanctum::actingAs($cs);
        $this->getJson('/api/v1/admin/customer-support/kyc?status=pending')->assertOk();
        $this->postJson('/api/v1/admin/customer-support/kyc/'.$id.'/reject', [])->assertStatus(422);
        $this->postJson('/api/v1/admin/customer-support/kyc/'.$id.'/reject', [
            'rejection_reason' => 'Foto KTP buram',
        ])->assertOk()->assertJsonPath('data.verification.status', 'rejected');

        $this->assertDatabaseHas('activity_logs', ['activity' => 'KYC_REJECT']);

        // Resubmit after reject
        Sanctum::actingAs($agent);
        $id2 = (int) $this->post('/api/v1/kyc/tier2/submit', [
            'ktp_full_name' => 'Review Agent',
            'ktp_number' => '3174010101010040',
            'bank_account_name' => 'Review Agent',
            'bank_account_number' => '555',
            'ktp_photo' => UploadedFile::fake()->image('ktp2.jpg'),
            'selfie_photo' => UploadedFile::fake()->image('selfie2.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.verification.id');

        Sanctum::actingAs($finance);
        $this->postJson('/api/v1/admin/finance/kyc/'.$id2.'/approve')
            ->assertOk()
            ->assertJsonPath('data.verification.status', 'approved');

        $this->assertDatabaseHas('activity_logs', ['activity' => 'KYC_APPROVE']);
        $this->assertEquals(2, KycVerification::query()->where('user_id', $agent->id)->count());
    }

    // ——— Bank match ———

    public function test_27_28_bank_name_match(): void
    {
        $user = $this->makeEndUser('bank-match@gurkynet.test', '081812200050');
        Sanctum::actingAs($user);

        $this->post('/api/v1/kyc/tier2/submit', [
            'ktp_full_name' => 'Andi Wijaya',
            'ktp_number' => '3174010101010050',
            'bank_account_name' => 'Budi Lain',
            'bank_account_number' => '777',
            'ktp_photo' => UploadedFile::fake()->image('ktp.jpg'),
            'selfie_photo' => UploadedFile::fake()->image('selfie.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(422)
            ->assertJsonValidationErrors(['bank_account_name']);

        $this->post('/api/v1/kyc/tier2/submit', [
            'ktp_full_name' => 'Andi Wijaya',
            'ktp_number' => '3174010101010050',
            'bank_account_name' => 'Andi Wijaya',
            'bank_account_number' => '777',
            'ktp_photo' => UploadedFile::fake()->image('ktp.jpg'),
            'selfie_photo' => UploadedFile::fake()->image('selfie.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated();
    }

    // ——— Withdraw dependency ———

    public function test_29_30_31_withdraw_gate_and_eligibility(): void
    {
        $agent = $this->makeEndUser('wd-agent@gurkynet.test', '081812200060');
        Wallet::create(['user_id' => $agent->id, 'wallet_number' => '104812200060', 'balance' => 500000, 'status' => 'active']);

        Sanctum::actingAs($agent);
        $this->postJson('/api/v1/wallet/withdraw', [
            'amount' => 50000,
            'pin' => '123456',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'account_holder' => 'WD Agent',
        ])->assertStatus(422);

        $eligibility = app(WithdrawEligibilityService::class)->evaluate($agent, 'WD Agent');
        $this->assertFalse($eligibility['kyc_ok']);
        $this->assertFalse($eligibility['eligible']);

        // Approve KYC
        Sanctum::actingAs($agent);
        $id = (int) $this->post('/api/v1/kyc/tier2/submit', [
            'ktp_full_name' => 'WD Agent',
            'ktp_number' => '3174010101010060',
            'bank_account_name' => 'WD Agent',
            'bank_account_number' => '123',
            'bank_name' => 'BCA',
            'ktp_photo' => UploadedFile::fake()->image('ktp.jpg'),
            'selfie_photo' => UploadedFile::fake()->image('selfie.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.verification.id');

        $finance = $this->makeStaff('fin-wd@gurkynet.test', '081812200061', UserRole::FINANCE);
        Sanctum::actingAs($finance);
        $this->postJson('/api/v1/admin/finance/kyc/'.$id.'/approve')->assertOk();

        $ok = app(WithdrawEligibilityService::class)->evaluate($agent->fresh(), 'WD Agent');
        $this->assertTrue($ok['kyc_ok']);
        $this->assertTrue($ok['agent_ok']);
        $this->assertTrue($ok['bank_ok']);
        $this->assertTrue($ok['eligible']);

        // Gate remains OFF
        Sanctum::actingAs($agent);
        $this->postJson('/api/v1/wallet/withdraw', [
            'amount' => 50000,
            'pin' => '123456',
            'bank_name' => 'BCA',
            'account_number' => '123',
            'account_holder' => 'WD Agent',
        ])->assertStatus(422);

        $this->assertFalse((bool) config('features.withdraw_enabled'));
    }

    public function test_tier1_phone_email_verify_endpoints(): void
    {
        $user = $this->makeEndUser('t1-flow@gurkynet.test', '081812200070', [
            'phone_verified_at' => null,
            'email_verified_at' => null,
        ]);

        Sanctum::actingAs($user);
        $phoneOtp = $this->postJson('/api/v1/kyc/tier1/phone/request')->assertOk()->json('data.dummy_sent_code');
        $this->postJson('/api/v1/kyc/tier1/phone/verify', ['code' => $phoneOtp])->assertOk();

        $emailOtp = $this->postJson('/api/v1/kyc/tier1/email/request')->assertOk()->json('data.dummy_sent_code');
        $this->postJson('/api/v1/kyc/tier1/email/verify', ['code' => $emailOtp])->assertOk();

        $user->refresh();
        $this->assertNotNull($user->phone_verified_at);
        $this->assertNotNull($user->email_verified_at);
    }

    public function test_profile_kyc_status_safe(): void
    {
        $user = $this->makeEndUser('profile-kyc@gurkynet.test', '081812200080');
        Sanctum::actingAs($user);
        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.kycStatus', 'tier1');
    }
}
