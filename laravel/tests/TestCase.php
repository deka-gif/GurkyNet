<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        // Cached bootstrap config/routes from `artisan config:cache` override phpunit.xml
        // (APP_ENV, DB_CONNECTION, CACHE_STORE, etc.) and poison the suite against MySQL.
        $this->forgetCachedBootstrapFiles();

        parent::setUp();
        Cache::flush();

        // Sprint 8 gates default OFF in production config; enable in tests so Sprint 3–7
        // regression suites keep exercising real purchase/withdraw paths. Sprint8UserModuleTest
        // explicitly disables gates for go-live safety assertions.
        config([
            'features.purchase_enabled' => true,
            'features.withdraw_enabled' => true,
            'features.auto_topup_enabled' => true,
        ]);

        // Sprint 12 / FR-KYC-01 — Tier 1 is enforced on transactions. Legacy tests that
        // omit phone_verified_at / email_verified_at are auto-stamped verified in testing
        // only when those attributes are absent. Explicit null keeps users unverified.
        \App\Models\User::creating(function (\App\Models\User $user) {
            $attrs = $user->getAttributes();
            if (! array_key_exists('phone_verified_at', $attrs)) {
                $user->phone_verified_at = now();
            }
            if (! array_key_exists('email_verified_at', $attrs)) {
                $user->email_verified_at = now();
            }
        });

        // Prevent accidental live Digiflazz/Midtrans HTTP during sync-queue tests.
        // Individual tests may call Http::fake() again to override these defaults.
        Http::fake([
            'https://api.digiflazz.com/*' => Http::response([
                'data' => [
                    'ref_id' => 'TEST-REF',
                    'buyer_sku_code' => 'TEST',
                    'customer_no' => '081234567890',
                    'status' => 'Pending',
                    'message' => 'Pending',
                    'sn' => null,
                    'price' => 10000,
                    'deposit' => 1500000,
                ],
            ], 200),
            'https://app.sandbox.midtrans.com/*' => Http::response([
                'token' => 'test-snap-token',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/test',
            ], 200),
            'https://api.sandbox.midtrans.com/*' => Http::response([
                'status_code' => '200',
                'status_message' => 'Success',
                'transaction_status' => 'settlement',
            ], 200),
            'https://app.midtrans.com/*' => Http::response([
                'token' => 'test-snap-token',
                'redirect_url' => 'https://app.midtrans.com/snap/v2/vtweb/test',
            ], 200),
            'https://api.midtrans.com/*' => Http::response([
                'status_code' => '200',
                'status_message' => 'Success',
                'transaction_status' => 'settlement',
            ], 200),
        ]);
    }

    protected function forgetCachedBootstrapFiles(): void
    {
        $cacheDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'cache';

        foreach (['config.php', 'routes-v7.php', 'routes.php', 'events.php'] as $file) {
            $path = $cacheDir . DIRECTORY_SEPARATOR . $file;
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }

    /**
     * Sprint 12 — seed agent + approved KYC Tier 2 so legacy withdraw regression tests
     * can exercise hold/idempotency paths under FR-USR07 / FR-KYC-02..04 eligibility.
     */
    protected function seedApprovedAgentKyc(\App\Models\User $user, ?string $legalName = null): void
    {
        $name = $legalName ?? $user->name;
        $user->forceFill([
            'user_type' => 'agent',
            'agent_level' => $user->agent_level ?: 'basic',
            'phone_verified_at' => $user->phone_verified_at ?? now(),
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        \App\Models\KycVerification::query()->create([
            'user_id' => $user->id,
            'tier' => 2,
            'ktp_full_name' => $name,
            'ktp_number' => '3174'.str_pad((string) $user->id, 12, '0', STR_PAD_LEFT),
            'ktp_photo_path' => 'kyc/'.$user->id.'/ktp.jpg',
            'selfie_photo_path' => 'kyc/'.$user->id.'/selfie.jpg',
            'bank_name' => 'BCA',
            'bank_account_name' => $name,
            'bank_account_number' => '1234567890',
            'status' => \App\Models\KycVerification::STATUS_APPROVED,
            'submitted_at' => now(),
            'reviewed_at' => now(),
        ]);
    }
}
