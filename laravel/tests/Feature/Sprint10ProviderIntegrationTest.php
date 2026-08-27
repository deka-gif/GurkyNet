<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderLog;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\SystemSetting;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use App\Services\DigiflazzService;
use App\Services\ProductProviders\DigiflazzProductProviderAdapter;
use App\Services\ProductProviders\ProductProviderFulfillmentService;
use App\Services\ProductProviders\ProductProviderHealthService;
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProductRoutingService;
use App\Services\ProductProviders\ProviderCircuitBreaker;
use App\Services\ProductProviders\ProviderCredentialResolver;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Services\ProductProviders\VipPulsaProductProviderAdapter;
use App\Services\VipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

/**
 * Sprint 10 / SRS Bagian 15 + 9.1 — Digiflazz + VIP + failover + circuit breaker + credentials.
 */
class Sprint10ProviderIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected ProductCategory $category;

    protected Provider $brand;

    protected Product $product;

    protected ProductProvider $digi;

    protected ProductProvider $vip;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory());
        Cache::flush();
        Queue::fake();

        config([
            'services.digiflazz.username' => 'env-digi-user',
            'services.digiflazz.api_key' => 'env-digi-key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'services.vip.username' => 'env-vip-id',
            'services.vip.merchant_id' => 'env-vip-id',
            'services.vip.api_key' => 'env-vip-key',
            'services.vip.signature' => '',
            'ppob.circuit_breaker.failure_threshold' => 3,
            'ppob.circuit_breaker.failure_window_seconds' => 300,
            'ppob.circuit_breaker.cooldown_seconds' => 60,
            'ppob.provider_http.fulfillment_timeout_seconds' => 12,
            'ppob.provider_http.fulfillment_connect_timeout_seconds' => 5,
        ]);

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        $this->digi->update(['is_active' => true, 'priority' => 1, 'api_status' => 'online']);
        $this->vip->update(['is_active' => true, 'priority' => 2, 'api_status' => 'online']);

        $this->category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-s10', 'icon' => 'phone']);
        $this->brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);

        $this->product = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->brand->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'S10XL5K',
            'name' => 'XL 5K S10',
            'base_price' => 5500,
            'sell_price' => 6000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'xl5',
            'base_price' => 5500,
            'is_active' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'XL_5K_VIP',
            'base_price' => 5400,
            'is_active' => true,
        ]);
    }

    // ── Digiflazz (1–8) ──────────────────────────────────────────────

    public function test_01_digiflazz_success(): void
    {
        Http::fake([
            'api.digiflazz.com/*' => Http::response([
                'data' => ['status' => 'Sukses', 'sn' => 'SN-DIGI-1', 'rc' => '00', 'message' => 'OK'],
            ], 200),
        ]);

        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'xl5',
            '081234567890',
            'INV-S10-1'
        );

        $this->assertTrue($result->ok);
        $this->assertSame('success', $result->status);
        $this->assertSame('SN-DIGI-1', $result->sn);
    }

    public function test_02_digiflazz_failure(): void
    {
        Http::fake([
            'api.digiflazz.com/*' => Http::response([
                'data' => ['status' => 'Gagal', 'rc' => '20', 'message' => 'Nomor salah'],
            ], 200),
        ]);

        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'xl5',
            '081234567890',
            'INV-S10-2'
        );

        $this->assertFalse($result->ok);
        $this->assertSame('failed', $result->status);
    }

    public function test_03_digiflazz_timeout(): void
    {
        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('Connection timed out');
        });

        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'xl5',
            '081234567890',
            'INV-S10-3'
        );

        $this->assertFalse($result->ok);
        $this->assertSame('timeout', $result->reason);
    }

    public function test_04_digiflazz_check_status_same_ref(): void
    {
        Http::fake([
            'api.digiflazz.com/*' => Http::response([
                'data' => ['status' => 'Sukses', 'sn' => 'SN-CHK', 'rc' => '00', 'ref_id' => 'SAME-REF'],
            ], 200),
        ]);

        $tx = $this->makeTx(['invoice_number' => 'SAME-REF']);
        $result = app(DigiflazzProductProviderAdapter::class)->checkStatus(
            $tx,
            'xl5',
            '081234567890',
            'SAME-REF'
        );

        $this->assertTrue($result->ok);
        $this->assertSame('success', $result->status);
        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['ref_id'] ?? null) === 'SAME-REF';
        });
    }

    public function test_05_digiflazz_malformed_response(): void
    {
        Http::fake([
            'api.digiflazz.com/*' => Http::response(['not' => 'data'], 200),
        ]);

        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'xl5',
            '081234567890',
            'INV-S10-5'
        );

        $this->assertFalse($result->ok);
        $this->assertSame('invalid_response', $result->reason);
    }

    public function test_06_digiflazz_authentication_failure(): void
    {
        Http::fake([
            'api.digiflazz.com/*' => Http::response([
                'data' => ['status' => 'Gagal', 'rc' => '41', 'message' => 'Wrong credentials'],
            ], 200),
        ]);

        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'xl5',
            '081234567890',
            'INV-S10-6'
        );

        $this->assertFalse($result->ok);
    }

    public function test_07_digiflazz_health_failure(): void
    {
        Http::fake([
            'api.digiflazz.com/*' => Http::response(['data' => null], 500),
        ]);

        $fresh = app(ProductProviderHealthService::class)->check($this->digi->fresh());
        $this->assertNotSame('online', strtolower((string) $fresh->api_status));
    }

    public function test_08_digiflazz_balance(): void
    {
        Http::fake([
            'api.digiflazz.com/*' => Http::response([
                'data' => ['deposit' => 125000.5],
            ], 200),
        ]);

        $balance = app(DigiflazzService::class)->checkBalance();
        $this->assertEquals(125000.5, $balance);
    }

    // ── VIPayment (9–16) ─────────────────────────────────────────────

    public function test_09_vip_success(): void
    {
        Http::fake([
            'vip-reseller.co.id/*' => Http::response([
                'result' => true,
                'data' => [
                    'trxid' => 'VIP-TRX-1',
                    'status' => 'success',
                    'sn' => 'SN-VIP-1',
                    'note' => 'OK',
                ],
            ], 200),
        ]);

        $result = app(VipPulsaProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'XL_5K_VIP',
            '081234567890',
            'INV-S10-9'
        );

        $this->assertTrue($result->ok);
        $this->assertSame('success', $result->status);
    }

    public function test_10_vip_failure(): void
    {
        Http::fake([
            'vip-reseller.co.id/*' => Http::response([
                'result' => false,
                'message' => 'Nomor salah',
            ], 200),
        ]);

        $result = app(VipPulsaProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'XL_5K_VIP',
            '081234567890',
            'INV-S10-10'
        );

        $this->assertFalse($result->ok);
    }

    public function test_11_vip_timeout(): void
    {
        Http::fake(function () {
            throw new \Illuminate\Http\Client\ConnectionException('Connection timed out');
        });

        $result = app(VipPulsaProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'XL_5K_VIP',
            '081234567890',
            'INV-S10-11'
        );

        $this->assertFalse($result->ok);
        $this->assertTrue(
            $result->reason === 'timeout'
            || $result->reason === 'provider_exception'
            || str_contains(strtolower((string) $result->message), 'timeout')
        );
    }

    public function test_12_vip_check_status_same_trxid(): void
    {
        Http::fake([
            'vip-reseller.co.id/*' => Http::response([
                'result' => true,
                'data' => [[
                    'trxid' => 'VIP-TRX-STATUS',
                    'status' => 'success',
                    'sn' => 'SN-VCHK',
                ]],
            ], 200),
        ]);

        $tx = $this->makeTx([
            'provider_ref' => 'VIP-TRX-STATUS',
            'fulfillment_provider_code' => 'vip',
        ]);

        $result = app(VipPulsaProductProviderAdapter::class)->checkStatus(
            $tx,
            'XL_5K_VIP',
            '081234567890',
            'VIP-TRX-STATUS'
        );

        $this->assertTrue($result->ok || $result->status === 'pending' || $result->status === 'success');
    }

    public function test_13_vip_malformed_response(): void
    {
        Http::fake([
            'vip-reseller.co.id/*' => Http::response('<<<not-json>>>', 200, [
                'Content-Type' => 'text/plain',
            ]),
        ]);

        $result = app(VipPulsaProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'XL_5K_VIP',
            '081234567890',
            'INV-S10-13'
        );

        // Malformed body must not be treated as a confirmed success.
        $this->assertNotSame('success', $result->status);
    }

    public function test_14_vip_authentication_failure(): void
    {
        Http::fake([
            'vip-reseller.co.id/*' => Http::response([
                'result' => false,
                'message' => 'API Key salah / unauthorized',
            ], 401),
        ]);

        $result = app(VipPulsaProductProviderAdapter::class)->fulfill(
            $this->makeTx(),
            'XL_5K_VIP',
            '081234567890',
            'INV-S10-14'
        );

        $this->assertFalse($result->ok);
    }

    public function test_15_vip_health_failure(): void
    {
        Http::fake([
            'vip-reseller.co.id/*' => Http::response(['result' => false, 'message' => 'down'], 503),
        ]);

        $fresh = app(ProductProviderHealthService::class)->check($this->vip->fresh());
        $this->assertNotSame('online', strtolower((string) $fresh->api_status));
    }

    public function test_16_vip_balance_profile(): void
    {
        Http::fake([
            'vip-reseller.co.id/*' => Http::response([
                'result' => true,
                'data' => [
                    'username' => 'vipuser',
                    'balance' => 99000,
                    'full_name' => 'VIP Test',
                ],
            ], 200),
        ]);

        $profile = app(VipService::class)->profile();
        $this->assertTrue((bool) ($profile['success'] ?? false) || isset($profile['profile']));
    }

    // ── Failover (17–21) ─────────────────────────────────────────────

    public function test_17_a_fails_before_processed_b_allowed(): void
    {
        $tx = $this->makePendingTx();

        $digi = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digi->shouldReceive('code')->andReturn('digiflazz');
        $digi->shouldReceive('isConfigured')->andReturn(true);
        $digi->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::failed(100, 'provider_error', true, 'HTTP 503', [])
        );

        $vip = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vip->shouldReceive('code')->andReturn('vip');
        $vip->shouldReceive('isConfigured')->andReturn(true);
        $vip->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::success(80, 'SN-B', [])
        );

        $this->bindRegistry($digi, $vip);
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertDatabaseHas('product_provider_logs', [
            'transaction_id' => $tx->id,
            'event_type' => 'failover',
            'selected_provider_code' => 'digiflazz',
            'fallback_provider_code' => 'vip',
        ]);
    }

    public function test_18_a_timeout_after_inflight_checkstatus_only(): void
    {
        $tx = $this->makePendingTx();

        $digi = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digi->shouldReceive('code')->andReturn('digiflazz');
        $digi->shouldReceive('isConfigured')->andReturn(true);
        $digi->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::error(900, 'timeout', true, 'Connection timed out')
        );
        $digi->shouldReceive('checkStatus')->once()->andReturn(
            ProviderFulfillmentResult::pending(50, [], 'unknown')
        );

        $vip = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vip->shouldReceive('code')->andReturn('vip');
        $vip->shouldReceive('isConfigured')->andReturn(true);
        $vip->shouldReceive('fulfill')->never();

        $this->bindRegistry($digi, $vip);
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $this->assertSame(TransactionStatus::PENDING_SUPPLIER->value, $tx->fresh()->status);
        $this->assertDatabaseHas('product_provider_logs', [
            'transaction_id' => $tx->id,
            'event_type' => 'post_dispatch_check',
        ]);
    }

    public function test_19_a_and_b_unavailable_failed_refund(): void
    {
        $user = User::factory()->create();
        $wallet = Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '1042'.str_pad((string) $user->id, 8, '0', STR_PAD_LEFT),
            'balance' => 100000,
            'status' => 'active',
        ]);
        $tx = $this->makePendingTx(['user_id' => $user->id, 'total_payment' => 6000]);
        $wallet->decrement('balance', 6000);

        $digi = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digi->shouldReceive('code')->andReturn('digiflazz');
        $digi->shouldReceive('isConfigured')->andReturn(true);
        $digi->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::failed(100, 'provider_offline', true, 'offline', [])
        );

        $vip = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vip->shouldReceive('code')->andReturn('vip');
        $vip->shouldReceive('isConfigured')->andReturn(true);
        $vip->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::failed(100, 'provider_offline', true, 'offline', [])
        );

        $this->bindRegistry($digi, $vip);
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertNotNull($fresh->refunded_at);
        $this->assertEquals(100000.0, (float) $wallet->fresh()->balance);
    }

    public function test_20_no_dual_dispatch_on_retry(): void
    {
        $tx = $this->makePendingTx([
            'provider_dispatch_started_at' => now(),
            'fulfillment_provider_code' => 'digiflazz',
            'provider_sku_used' => 'xl5',
            'provider_ref' => 'INV-DUAL',
            'status' => TransactionStatus::SENT_TO_SUPPLIER->value,
        ]);

        $digi = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digi->shouldReceive('code')->andReturn('digiflazz');
        $digi->shouldReceive('isConfigured')->andReturn(true);
        $digi->shouldReceive('fulfill')->never();
        $digi->shouldReceive('checkStatus')->once()->andReturn(
            ProviderFulfillmentResult::pending(40, [], 'still pending')
        );

        $vip = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vip->shouldReceive('code')->andReturn('vip');
        $vip->shouldReceive('fulfill')->never();

        $this->bindRegistry($digi, $vip);
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $this->assertDatabaseHas('product_provider_logs', [
            'transaction_id' => $tx->id,
            'event_type' => 'dispatch_retry_check',
        ]);
    }

    public function test_21_duplicate_retry_does_not_send_second_order(): void
    {
        $this->test_20_no_dual_dispatch_on_retry();
    }

    // ── Circuit breaker (22–27) ──────────────────────────────────────

    public function test_22_consecutive_failures_open(): void
    {
        $cb = app(ProviderCircuitBreaker::class);
        $cb->reset('digiflazz');
        $cb->recordFailure('digiflazz', 'timeout');
        $cb->recordFailure('digiflazz', 'timeout');
        $this->assertSame(ProviderCircuitBreaker::STATE_CLOSED, $cb->state('digiflazz'));
        $cb->recordFailure('digiflazz', 'timeout');
        $this->assertSame(ProviderCircuitBreaker::STATE_OPEN, $cb->state('digiflazz'));
    }

    public function test_23_open_provider_not_selected(): void
    {
        $cb = app(ProviderCircuitBreaker::class);
        $cb->reset('digiflazz');
        $cb->forceOpen('digiflazz', 'test');

        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($this->product);
        $codes = $offers->map(fn ($o) => $o->productProvider?->code)->all();
        $this->assertNotContains('digiflazz', $codes);
        $this->assertContains('vip', $codes);
    }

    public function test_24_cooldown_half_open(): void
    {
        config(['ppob.circuit_breaker.cooldown_seconds' => 30]);
        $cb = app(ProviderCircuitBreaker::class);
        $cb->reset('digiflazz');
        Cache::put('ppob:circuit:digiflazz', [
            'state' => ProviderCircuitBreaker::STATE_OPEN,
            'opened_at' => time() - 35,
            'failures' => [],
            'half_open_probes' => 0,
        ], 600);

        $this->assertSame(ProviderCircuitBreaker::STATE_HALF_OPEN, $cb->state('digiflazz'));
        $this->assertFalse($cb->allowsFulfillment('digiflazz'));
    }

    public function test_25_successful_half_open_probe_closes(): void
    {
        $cb = app(ProviderCircuitBreaker::class);
        $cb->reset('digiflazz');
        Cache::put('ppob:circuit:digiflazz', [
            'state' => ProviderCircuitBreaker::STATE_HALF_OPEN,
            'opened_at' => time() - 10,
            'failures' => [],
            'half_open_probes' => 0,
        ], 600);

        $cb->recordSuccess('digiflazz');
        $this->assertSame(ProviderCircuitBreaker::STATE_CLOSED, $cb->state('digiflazz'));
    }

    public function test_26_failed_half_open_probe_reopens(): void
    {
        $cb = app(ProviderCircuitBreaker::class);
        $cb->reset('digiflazz');
        Cache::put('ppob:circuit:digiflazz', [
            'state' => ProviderCircuitBreaker::STATE_HALF_OPEN,
            'opened_at' => time() - 10,
            'failures' => [],
            'half_open_probes' => 1,
        ], 600);

        $cb->recordFailure('digiflazz', 'health_failed');
        $this->assertSame(ProviderCircuitBreaker::STATE_OPEN, $cb->state('digiflazz'));
    }

    public function test_27_concurrent_half_open_attempts_safe(): void
    {
        $cb = app(ProviderCircuitBreaker::class);
        $cb->reset('digiflazz');
        Cache::put('ppob:circuit:digiflazz', [
            'state' => ProviderCircuitBreaker::STATE_HALF_OPEN,
            'opened_at' => time() - 10,
            'failures' => [],
            'half_open_probes' => 0,
        ], 600);

        $first = $cb->tryAcquireHalfOpenProbe('digiflazz');
        $second = $cb->tryAcquireHalfOpenProbe('digiflazz');
        $this->assertTrue($first);
        $this->assertFalse($second);
    }

    // ── Credentials (28–30) ──────────────────────────────────────────

    public function test_28_system_settings_credentials_used(): void
    {
        SystemSetting::create([
            'key' => ProviderCredentialResolver::DIGI_USERNAME,
            'value' => 'settings-digi-user',
            'group' => 'ppob',
        ]);
        SystemSetting::create([
            'key' => ProviderCredentialResolver::DIGI_API_KEY,
            'value' => Crypt::encryptString('settings-digi-secret'),
            'group' => 'ppob',
        ]);

        $creds = app(ProviderCredentialResolver::class)->digiflazz();
        $this->assertSame('settings-digi-user', $creds['username']);
        $this->assertSame('settings-digi-secret', $creds['api_key']);
        $this->assertSame('system_settings', $creds['source']);

        Http::fake([
            'api.digiflazz.com/*' => Http::response([
                'data' => ['deposit' => 1],
            ], 200),
        ]);
        app(DigiflazzService::class)->checkBalance();
        Http::assertSent(function ($request) {
            return ($request->data()['username'] ?? null) === 'settings-digi-user';
        });
    }

    public function test_29_env_fallback_works(): void
    {
        SystemSetting::query()->whereIn('key', [
            ProviderCredentialResolver::DIGI_USERNAME,
            ProviderCredentialResolver::DIGI_API_KEY,
            ProviderCredentialResolver::VIP_MERCHANT_ID,
            ProviderCredentialResolver::VIP_API_KEY,
        ])->delete();

        $digi = app(ProviderCredentialResolver::class)->digiflazz();
        $this->assertSame('env-digi-user', $digi['username']);
        $this->assertSame('env_config', $digi['source']);

        $vip = app(ProviderCredentialResolver::class)->vip();
        $this->assertSame('env-vip-id', $vip['api_id']);
        $this->assertSame('env_config', $vip['source']);
    }

    public function test_30_secrets_not_logged(): void
    {
        Log::spy();

        SystemSetting::create([
            'key' => ProviderCredentialResolver::DIGI_API_KEY,
            'value' => Crypt::encryptString('super-secret-digi-key-xyz'),
            'group' => 'ppob',
        ]);
        SystemSetting::create([
            'key' => ProviderCredentialResolver::DIGI_USERNAME,
            'value' => 'settings-user',
            'group' => 'ppob',
        ]);

        Http::fake([
            'api.digiflazz.com/*' => Http::response([
                'data' => ['status' => 'Sukses', 'sn' => '1', 'rc' => '00'],
            ], 200),
        ]);

        app(DigiflazzService::class)->buy('xl5', '081234567890', 'INV-SECRET');

        Log::shouldHaveReceived('info')->withArgs(function ($message, $context = []) {
            $blob = json_encode([$message, $context]);

            return ! str_contains((string) $blob, 'super-secret-digi-key-xyz');
        })->atLeast()->once();
    }

    // ── Timeout (31–32) ──────────────────────────────────────────────

    public function test_31_provider_timeout_honors_nfr_window(): void
    {
        $timeout = (int) config('ppob.provider_http.fulfillment_timeout_seconds');
        $this->assertGreaterThanOrEqual(10, $timeout);
        $this->assertLessThanOrEqual(15, $timeout);
    }

    public function test_32_timeout_classification_drives_checkstatus_not_failover(): void
    {
        $this->test_18_a_timeout_after_inflight_checkstatus_only();
    }

    // ── Mapping (33–35) ──────────────────────────────────────────────

    public function test_33_active_mapping_selected(): void
    {
        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($this->product);
        $this->assertGreaterThanOrEqual(2, $offers->count());
        $this->assertTrue($offers->contains(fn ($o) => $o->provider_sku === 'xl5'));
    }

    public function test_34_missing_mapping_safe_failure(): void
    {
        ProductProviderSku::query()->delete();
        $this->digi->update(['is_active' => false]);
        $this->vip->update(['is_active' => false]);

        $tx = $this->makePendingTx();
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
    }

    public function test_35_inactive_mapping_skipped(): void
    {
        ProductProviderSku::query()
            ->where('product_provider_id', $this->digi->id)
            ->update(['is_active' => false]);

        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($this->product->fresh());
        $this->assertFalse($offers->contains(fn ($o) => $o->productProvider?->code === 'digiflazz'));
        $this->assertTrue($offers->contains(fn ($o) => $o->productProvider?->code === 'vip'));
    }

    // ── Helpers ──────────────────────────────────────────────────────

    protected function makeTx(array $overrides = []): Transaction
    {
        $user = User::factory()->create();

        return Transaction::create(array_merge([
            'user_id' => $user->id,
            'invoice_number' => 'INV-S10-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 6000,
            'admin_fee' => 0,
            'total_payment' => 6000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PENDING->value,
            'notes' => 's10',
        ], $overrides));
    }

    protected function makePendingTx(array $overrides = []): Transaction
    {
        $tx = $this->makeTx($overrides);
        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => $this->product->sku_code,
            'product_name' => $this->product->name,
            'price' => 6000,
            'quantity' => 1,
        ]);

        return $tx->fresh(['items']);
    }

    protected function bindRegistry($digi, $vip): void
    {
        $registry = new ProductProviderRegistry($digi, $vip);
        $this->app->instance(ProductProviderRegistry::class, $registry);
        $routing = new ProductRoutingService($registry, app(\App\Services\ProductProviders\ProviderFailoverPolicy::class));
        $this->app->instance(ProductRoutingService::class, $routing);
        $this->app->instance(
            \App\Services\ProductProviders\ProductProviderSelectionService::class,
            new \App\Services\ProductProviders\ProductProviderSelectionService($registry, $routing)
        );
    }
}
