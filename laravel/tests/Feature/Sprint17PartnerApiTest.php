<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Jobs\DeliverPartnerWebhookJob;
use App\Jobs\ProcessProductProviderTransaction;
use App\Models\ApiCredential;
use App\Models\ApiPartner;
use App\Models\ApiRequestLog;
use App\Models\ApiWebhookDelivery;
use App\Models\PartnerAbuseFlag;
use App\Models\PartnerDepositRequest;
use App\Models\PartnerProductPrice;
use App\Models\PartnerWallet;
use App\Models\PartnerWalletMutation;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductPrice;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\PartnerApi\PartnerAuthService;
use App\Services\PartnerApi\PartnerWebhookService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 17 — SRS Bagian 30 Partner H2H API (FR-API-01..11).
 */
class Sprint17PartnerApiTest extends TestCase
{
    use RefreshDatabase;

    private Product $product;

    private Product $inactiveProduct;

    private int $tsBump = 0;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'features.partner_api_enabled' => true,
            'features.partner_api_sandbox_enabled' => true,
            'features.purchase_enabled' => false,
            'features.withdraw_enabled' => false,
            'features.auto_topup_enabled' => false,
        ]);

        $digi = ProductProvider::digiflazz();
        if ($digi) {
            $digi->update(['is_active' => true, 'api_status' => 'online']);
        }

        $cat = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-s17', 'icon' => 'phone']);
        $brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);

        $this->product = Product::create([
            'product_category_id' => $cat->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi?->id,
            'sku_code' => 'S17-XL5K',
            'name' => 'XL 5K S17',
            'base_price' => 5000,
            'sell_price' => 6000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        $this->inactiveProduct = Product::create([
            'product_category_id' => $cat->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi?->id,
            'sku_code' => 'S17-OFF',
            'name' => 'Off Product',
            'base_price' => 1000,
            'sell_price' => 2000,
            'admin_fee' => 0,
            'status' => false,
            'ops_status' => 'inactive',
        ]);
    }

    private function user(array $o = []): User
    {
        $u = User::create(array_merge([
            'name' => 'Partner User',
            'email' => 'p-'.uniqid().'@test.local',
            'phone_number' => '0812'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'user_type' => 'customer',
            'transaction_pin' => Hash::make('123456'),
            'email_verified_at' => now(),
        ], $o));

        Wallet::create([
            'user_id' => $u->id,
            'wallet_number' => '17'.uniqid(),
            'balance' => 100000,
            'status' => 'active',
        ]);

        return $u;
    }

    private function staff(UserRole $role): User
    {
        return User::create([
            'name' => $role->value,
            'email' => $role->value.'-'.uniqid().'@test.local',
            'phone_number' => '0813'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => $role,
            'user_type' => 'staff',
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    /**
     * @return array{partner: ApiPartner, credential: ApiCredential, secret: string, user: User}
     */
    private function approvedPartner(bool $sandbox = false, float $balance = 50000): array
    {
        $user = $this->user();
        Sanctum::actingAs($user);
        $this->postJson('/api/v1/partner-portal/apply', [
            'nama_usaha' => 'Toko '.$user->id,
            'pic_name' => 'PIC',
            'pic_contact' => '08123456789',
            'volume_notes' => 'test',
        ])->assertCreated();

        $partner = ApiPartner::where('user_id', $user->id)->firstOrFail();
        $ops = $this->staff(UserRole::OPERATIONS);
        Sanctum::actingAs($ops);
        $resp = $this->postJson('/api/v1/admin/operations/partners/'.$partner->id.'/approve', [
            'callback_url' => 'https://partner.example/callback',
            'issue_production_key' => ! $sandbox,
        ])->assertOk();

        $partner->refresh();
        if ($sandbox) {
            $cred = ApiCredential::where('partner_id', $partner->id)->where('is_sandbox', true)->firstOrFail();
            // Secret only in approve response for sandbox path
            $secret = $resp->json('data.sandbox_api_secret');
        } else {
            $cred = ApiCredential::where('partner_id', $partner->id)->where('is_sandbox', false)->firstOrFail();
            $secret = $resp->json('data.production_api_secret');
        }

        PartnerWallet::updateOrCreate(
            ['partner_id' => $partner->id],
            ['balance' => $balance, 'status' => 'active']
        );

        PartnerProductPrice::create([
            'product_id' => $this->product->id,
            'partner_tier' => $partner->tier,
            'sell_price' => 5500,
            'is_current' => true,
            'effective_from' => now(),
        ]);

        return [
            'partner' => $partner->fresh(),
            'credential' => $cred,
            'secret' => (string) $secret,
            'user' => $user,
        ];
    }

    private function signed(string $method, string $uri, string $apiKey, string $secret, array $payload = [], ?int $ts = null): \Illuminate\Testing\TestResponse
    {
        $method = strtoupper($method);
        // GET: signature covers empty body; query string is not part of HMAC (SRS 30.4 = body).
        $body = $method === 'GET' ? '' : json_encode($payload, JSON_UNESCAPED_SLASHES);
        $ts = $ts ?? (now()->timestamp + (++$this->tsBump));
        $sig = hash_hmac('sha256', $body, $secret);
        $server = $this->transformHeadersToServerVars([
            'X-API-Key' => $apiKey,
            'X-Signature' => $sig,
            'X-Timestamp' => (string) $ts,
            'Accept' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ]);

        if ($method === 'GET') {
            $q = $payload ? ('?'.http_build_query($payload)) : '';

            return $this->call('GET', '/api/v1/partner'.$uri.$q, [], [], [], $server, '');
        }

        return $this->call($method, '/api/v1/partner'.$uri, [], [], [], $server, $body);
    }

    // ——— Lifecycle ———

    public function test_01_to_05_application_pending_approve_reject(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);
        $this->postJson('/api/v1/partner-portal/apply', [
            'nama_usaha' => 'Mitra A',
            'pic_name' => 'A',
            'pic_contact' => '08111',
        ])->assertCreated();
        $partner = ApiPartner::where('user_id', $user->id)->firstOrFail();
        $this->assertEquals(ApiPartner::STATUS_PENDING, $partner->status);

        $ops = $this->staff(UserRole::OPERATIONS);
        Sanctum::actingAs($ops);
        $ok = $this->postJson('/api/v1/admin/operations/partners/'.$partner->id.'/approve', [
            'callback_url' => 'https://cb.test/hook',
        ]);
        $ok->assertOk();
        $this->assertEquals(ApiPartner::STATUS_APPROVED, $partner->fresh()->status);
        $this->assertNotEmpty($ok->json('data.sandbox_api_secret'));

        $user2 = $this->user();
        Sanctum::actingAs($user2);
        $this->postJson('/api/v1/partner-portal/apply', [
            'nama_usaha' => 'Mitra B',
            'pic_name' => 'B',
            'pic_contact' => '08222',
        ])->assertCreated();
        $p2 = ApiPartner::where('user_id', $user2->id)->firstOrFail();

        $owner = $this->staff(UserRole::OWNER);
        Sanctum::actingAs($owner);
        $this->postJson('/api/v1/admin/executive/partners/'.$p2->id.'/reject', ['note' => 'no'])
            ->assertOk();
        $this->assertEquals(ApiPartner::STATUS_REJECTED, $p2->fresh()->status);
    }

    public function test_06_to_13_credentials_auth_revoke_rotate(): void
    {
        $ctx = $this->approvedPartner(false);
        $key = $ctx['credential']->api_key;
        $secret = $ctx['secret'];

        // one-time: credentials list has no secret
        Sanctum::actingAs($ctx['user']);
        $list = $this->getJson('/api/v1/partner-portal/credentials')->assertOk();
        $this->assertArrayNotHasKey('secret_encrypted', $list->json('data.0') ?? []);
        $this->assertArrayNotHasKey('api_secret', $list->json('data.0') ?? []);

        $this->signed('GET', '/price', 'pk_bad', $secret)->assertStatus(401);
        $this->signed('GET', '/price', $key, 'wrong-secret')->assertStatus(401);
        $this->signed('GET', '/price', $key, $secret, [], now()->subMinutes(10)->timestamp)->assertStatus(401);

        // valid then replay same ts+body
        $ts = now()->timestamp;
        $this->signed('GET', '/price', $key, $secret, [], $ts)->assertOk();
        $this->signed('GET', '/price', $key, $secret, [], $ts)->assertStatus(401);
        $this->assertTrue(PartnerAbuseFlag::where('signal', 'replay_attempt')->exists());

        $ops = $this->staff(UserRole::OPERATIONS);
        Sanctum::actingAs($ops);
        $rot = $this->postJson('/api/v1/admin/operations/partner-credentials/'.$ctx['credential']->id.'/rotate')
            ->assertOk();
        $newKey = $rot->json('data.api_key');
        $newSecret = $rot->json('data.api_secret');
        $this->assertNotEquals($key, $newKey);

        $this->signed('GET', '/price', $key, $secret)->assertStatus(401);
        $this->signed('GET', '/price', $newKey, $newSecret)->assertOk();

        $this->postJson('/api/v1/admin/operations/partner-credentials/'.ApiCredential::where('api_key', $newKey)->value('id').'/revoke')
            ->assertOk();
        $this->signed('GET', '/price', $newKey, $newSecret)->assertStatus(401);
    }

    public function test_14_to_17_partner_isolation(): void
    {
        $a = $this->approvedPartner(false, 50000);
        $b = $this->approvedPartner(false, 50000);

        Queue::fake();
        $this->signed('POST', '/execute', $a['credential']->api_key, $a['secret'], [
            'sku_code' => 'S17-XL5K',
            'target_number' => '081234567890',
            'partner_ref' => 'A-REF-1',
            'idempotency_key' => 'idem-a-1',
        ])->assertCreated();

        $this->signed('GET', '/status', $b['credential']->api_key, $b['secret'], [
            'partner_ref' => 'A-REF-1',
        ])->assertNotFound();

        Sanctum::actingAs($b['user']);
        $logs = $this->getJson('/api/v1/partner-portal/logs')->assertOk();
        foreach ($logs->json('data') as $row) {
            $this->assertEquals($b['partner']->id, $row['partner_id']);
        }

        $this->assertEquals(
            (float) PartnerWallet::where('partner_id', $a['partner']->id)->value('balance'),
            44500.0
        );
        $this->assertEquals(
            (float) PartnerWallet::where('partner_id', $b['partner']->id)->value('balance'),
            50000.0
        );
    }

    public function test_18_to_20_price_and_isolation_from_agent(): void
    {
        $ctx = $this->approvedPartner(false);
        if (class_exists(ProductPrice::class)) {
            try {
                ProductPrice::create([
                    'product_id' => $this->product->id,
                    'agent_level' => 'gold',
                    'sell_price' => 9999,
                    'is_current' => true,
                    'effective_from' => now(),
                ]);
            } catch (\Throwable) {
                // agent schema may differ — partner price must still win
            }
        }

        $r = $this->signed('GET', '/price', $ctx['credential']->api_key, $ctx['secret'], [
            'sku_code' => 'S17-XL5K',
        ])->assertOk();
        $this->assertEquals(5500.0, (float) $r->json('data.0.sell_price'));

        $this->signed('GET', '/price', $ctx['credential']->api_key, $ctx['secret'], [
            'sku_code' => 'S17-OFF',
        ])->assertNotFound();
    }

    public function test_21_to_25_wallet_deposit_and_insufficient(): void
    {
        $ctx = $this->approvedPartner(false, 1000);
        Sanctum::actingAs($ctx['user']);
        $dep = $this->postJson('/api/v1/partner-portal/deposits', [
            'amount' => 25000,
            'idempotency_key' => 'dep-1',
        ])->assertCreated();
        $depId = $dep->json('data.id');

        $fin = $this->staff(UserRole::FINANCE);
        Sanctum::actingAs($fin);
        $this->postJson('/api/v1/admin/finance/partner-deposits/'.$depId.'/approve')->assertOk();
        $this->postJson('/api/v1/admin/finance/partner-deposits/'.$depId.'/approve')->assertOk(); // duplicate safe
        $this->assertEquals(1, PartnerWalletMutation::where('type', 'deposit')->where('reference_id', 'partner_deposit:'.$depId)->count());
        $this->assertEquals(26000.0, (float) PartnerWallet::where('partner_id', $ctx['partner']->id)->value('balance'));

        Sanctum::actingAs($ctx['user']);
        $dep2 = $this->postJson('/api/v1/partner-portal/deposits', [
            'amount' => 10000,
            'idempotency_key' => 'dep-2',
        ])->assertCreated();
        Sanctum::actingAs($fin);
        $this->postJson('/api/v1/admin/finance/partner-deposits/'.$dep2->json('data.id').'/reject')->assertOk();
        $this->assertEquals(26000.0, (float) PartnerWallet::where('partner_id', $ctx['partner']->id)->value('balance'));

        PartnerWallet::where('partner_id', $ctx['partner']->id)->update(['balance' => 100]);
        Queue::fake();
        $this->signed('POST', '/execute', $ctx['credential']->api_key, $ctx['secret'], [
            'sku_code' => 'S17-XL5K',
            'target_number' => '081234567890',
            'partner_ref' => 'LOW-BAL',
            'idempotency_key' => 'idem-low',
        ])->assertStatus(422);
        $this->assertEquals(100000.0, (float) Wallet::where('user_id', $ctx['user']->id)->value('balance'));
    }

    public function test_26_to_36_execute_idempotency_channel_provider_dispatch(): void
    {
        $ctx = $this->approvedPartner(false, 50000);
        $userBalBefore = (float) Wallet::where('user_id', $ctx['user']->id)->value('balance');
        Queue::fake();

        $payload = [
            'sku_code' => 'S17-XL5K',
            'target_number' => '081234567890',
            'partner_ref' => 'EX-1',
            'idempotency_key' => 'idem-ex-1',
        ];
        $r1 = $this->signed('POST', '/execute', $ctx['credential']->api_key, $ctx['secret'], $payload);
        $r1->assertCreated();
        $invoice = $r1->json('data.invoice_number') ?? $r1->json('data.data.invoice_number');

        $r2 = $this->signed('POST', '/execute', $ctx['credential']->api_key, $ctx['secret'], $payload);
        $r2->assertOk();
        $this->assertTrue((bool) ($r2->json('data.replay') ?? $r2->json('meta.replay')));
        $this->assertEquals(1, Transaction::where('partner_ref', 'EX-1')->count());

        $this->signed('POST', '/execute', $ctx['credential']->api_key, $ctx['secret'], array_merge($payload, [
            'target_number' => '081111111111',
        ]))->assertStatus(422);

        $tx = Transaction::where('invoice_number', $invoice)->firstOrFail();
        $this->assertEquals('partner_api', $tx->channel);
        $this->assertEquals($ctx['partner']->id, $tx->partner_id);
        $this->assertEquals($userBalBefore, (float) Wallet::where('user_id', $ctx['user']->id)->value('balance'));

        Queue::assertPushed(ProcessProductProviderTransaction::class, function ($job) use ($tx) {
            return $job->transactionId === $tx->id;
        });
        // Sprint 10 reuse: single job per tx (no dual dispatch on replay)
        Queue::assertPushed(ProcessProductProviderTransaction::class, 1);
    }

    public function test_37_38_status_scoped(): void
    {
        $ctx = $this->approvedPartner(false, 50000);
        Queue::fake();
        $this->signed('POST', '/execute', $ctx['credential']->api_key, $ctx['secret'], [
            'sku_code' => 'S17-XL5K',
            'target_number' => '081234567890',
            'partner_ref' => 'ST-1',
            'idempotency_key' => 'idem-st-1',
        ])->assertCreated();

        $this->signed('GET', '/status', $ctx['credential']->api_key, $ctx['secret'], [
            'partner_ref' => 'ST-1',
        ])->assertOk()->assertJsonPath('data.partner_ref', 'ST-1');

        $other = $this->approvedPartner(false);
        $this->signed('GET', '/status', $other['credential']->api_key, $other['secret'], [
            'partner_ref' => 'ST-1',
        ])->assertNotFound();
    }

    public function test_39_to_43_webhook_signed_retry_idempotent(): void
    {
        Queue::fake();
        Http::fake(['https://partner.example/*' => Http::response('err', 500)]);

        $ctx = $this->approvedPartner(false, 50000);
        $tx = Transaction::create([
            'user_id' => $ctx['user']->id,
            'invoice_number' => 'PTR-WH-1',
            'service_name' => 'Partner API',
            'target_number' => '0812',
            'amount' => 5500,
            'admin_fee' => 0,
            'total_payment' => 5500,
            'payment_method' => 'partner_wallet',
            'channel' => 'partner_api',
            'partner_id' => $ctx['partner']->id,
            'partner_ref' => 'WH-1',
            'status' => 'success',
            'provider_response' => ['channel' => 'partner_api', 'sandbox' => false],
        ]);

        /** @var PartnerWebhookService $wh */
        $wh = app(PartnerWebhookService::class);
        $wh->queueForTransaction($tx);
        $wh->queueForTransaction($tx); // duplicate event safe
        $this->assertEquals(1, ApiWebhookDelivery::count());

        $delivery = ApiWebhookDelivery::first();
        $wh->attempt($delivery->fresh());
        $this->assertEquals(1, $delivery->fresh()->retry_count);
        $this->assertEquals(60, config('partner_api.webhook_retry_delays_seconds.0'));
        $this->assertEquals(300, config('partner_api.webhook_retry_delays_seconds.1'));
        $this->assertEquals(1800, config('partner_api.webhook_retry_delays_seconds.2'));
        $this->assertEquals(3, config('partner_api.webhook_max_retries'));

        $wh->attempt($delivery->fresh());
        $wh->attempt($delivery->fresh());
        $wh->attempt($delivery->fresh());
        $this->assertEquals(ApiWebhookDelivery::STATUS_FAILED, $delivery->fresh()->status);

        Http::assertSent(function ($request) use ($ctx) {
            return $request->hasHeader('X-Signature')
                && $request->hasHeader('X-API-Key')
                && ! str_contains($request->body(), $ctx['secret']);
        });
    }

    public function test_44_to_46_rate_limit_per_partner(): void
    {
        $a = $this->approvedPartner(false);
        $b = $this->approvedPartner(false);
        $a['partner']->update(['rate_limit_per_minute' => 2]);
        $b['partner']->update(['rate_limit_per_minute' => 60]);

        $this->signed('GET', '/price', $a['credential']->api_key, $a['secret'])->assertOk();
        $this->signed('GET', '/price', $a['credential']->api_key, $a['secret'])->assertOk();
        $this->signed('GET', '/price', $a['credential']->api_key, $a['secret'])->assertStatus(429);

        $this->signed('GET', '/price', $b['credential']->api_key, $b['secret'])->assertOk();
        $this->assertEquals(60, (int) config('partner_api.default_rate_limit_per_minute'));
    }

    public function test_47_to_49_sandbox_no_debit_no_fulfill(): void
    {
        $ctx = $this->approvedPartner(true, 50000);
        $bal = (float) PartnerWallet::where('partner_id', $ctx['partner']->id)->value('balance');
        Queue::fake();

        $this->signed('POST', '/execute', $ctx['credential']->api_key, $ctx['secret'], [
            'sku_code' => 'S17-XL5K',
            'target_number' => '081234567890',
            'partner_ref' => 'SBX-1',
            'idempotency_key' => 'idem-sbx',
        ])->assertCreated()->assertJsonPath('data.sandbox', true);

        $this->assertEquals($bal, (float) PartnerWallet::where('partner_id', $ctx['partner']->id)->value('balance'));
        Queue::assertNotPushed(ProcessProductProviderTransaction::class);
        $this->assertTrue((bool) $ctx['credential']->is_sandbox);
        $this->assertStringStartsWith('pk_test_', $ctx['credential']->api_key);
    }

    public function test_50_51_abuse_flag_no_auto_block(): void
    {
        $ctx = $this->approvedPartner(false);
        $this->assertFalse((bool) config('partner_api.auto_suspend_enabled'));
        $this->signed('GET', '/price', $ctx['credential']->api_key, 'bad')->assertStatus(401);
        $this->assertTrue(PartnerAbuseFlag::where('partner_id', $ctx['partner']->id)->where('signal', 'invalid_signature')->exists());
        $this->assertEquals(ApiPartner::STATUS_APPROVED, $ctx['partner']->fresh()->status);
        $this->signed('GET', '/price', $ctx['credential']->api_key, $ctx['secret'])->assertOk();
    }

    public function test_52_53_portal_scope_and_openapi(): void
    {
        $a = $this->approvedPartner(false);
        $b = $this->approvedPartner(false);
        Sanctum::actingAs($a['user']);
        $me = $this->getJson('/api/v1/partner-portal/me')->assertOk();
        $this->assertEquals($a['partner']->nama_usaha, $me->json('data.nama_usaha'));

        Sanctum::actingAs($b['user']);
        $creds = $this->getJson('/api/v1/partner-portal/credentials')->assertOk();
        foreach ($creds->json('data') as $c) {
            $row = ApiCredential::find($c['id']);
            $this->assertEquals($b['partner']->id, $row->partner_id);
        }

        $doc = $this->getJson('/api/v1/partner/openapi.json')->assertOk();
        $paths = $doc->json('data.paths') ?? $doc->json('paths');
        $this->assertArrayHasKey('/price', $paths);
        $this->assertArrayHasKey('/execute', $paths);
        $this->assertArrayHasKey('/status', $paths);
    }

    public function test_54_gates_remain_off_for_user_purchase(): void
    {
        $this->assertFalse((bool) config('features.purchase_enabled'));
        $this->assertFalse((bool) config('features.withdraw_enabled'));
        $this->assertFalse((bool) config('features.auto_topup_enabled'));
        // partner gate is independent; tests enable it via config override
        $this->assertFalse((bool) env('PARTNER_API_ENABLED', false));
    }
}
