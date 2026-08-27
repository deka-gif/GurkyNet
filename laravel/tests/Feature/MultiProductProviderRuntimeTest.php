<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Services\ProductProviders\DigiflazzProductProviderAdapter;
use App\Services\ProductProviders\ProductProviderFulfillmentService;
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProductProviderSelectionService;
use App\Services\ProductProviders\ProductRoutingService;
use App\Services\ProductProviders\ProviderFailoverPolicy;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Services\ProductProviders\VipPulsaProductProviderAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class MultiProductProviderRuntimeTest extends TestCase
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

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        $this->digi->update(['is_active' => true, 'priority' => 1, 'api_status' => 'online']);
        $this->vip->update(['is_active' => true, 'priority' => 2, 'api_status' => 'online']);

        $this->category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-rt', 'icon' => 'phone']);
        $this->brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);

        $this->product = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->brand->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'XL5K',
            'name' => 'XL 5K',
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
            'is_preferred' => false,
            'is_active' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'XL_5K_VIP',
            'base_price' => 5400,
            'is_preferred' => false,
            'is_active' => true,
        ]);
    }

    public function test_catalog_digiflazz_on_vip_off(): void
    {
        $this->vip->update(['is_active' => false]);

        $res = $this->getJson('/api/v1/products?keyword=XL');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();
        $this->assertContains('XL5K', $codes);
    }

    public function test_catalog_digiflazz_off_vip_on(): void
    {
        $this->digi->update(['is_active' => false]);

        $res = $this->getJson('/api/v1/products?keyword=XL');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();
        $this->assertContains('XL5K', $codes);
    }

    public function test_catalog_both_on(): void
    {
        $res = $this->getJson('/api/v1/products?keyword=XL');
        $res->assertOk();
        $this->assertContains('XL5K', collect($res->json('data'))->pluck('code')->all());
    }

    public function test_catalog_both_off_hides_products(): void
    {
        $this->digi->update(['is_active' => false]);
        $this->vip->update(['is_active' => false]);

        $res = $this->getJson('/api/v1/products?keyword=XL');
        $res->assertOk();
        $this->assertNotContains('XL5K', collect($res->json('data'))->pluck('code')->all());
    }

    public function test_duplicate_catalog_cards_merged(): void
    {
        // Parallel VIP-owned product with same display name (legacy duplicate import)
        Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->brand->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-XL_5K_VIP',
            'name' => 'XL 5K',
            'base_price' => 5400,
            'sell_price' => 5900,
            'admin_fee' => 0,
            'status' => true,
        ]);

        // Give the VIP-only product an active VIP offer so it would otherwise appear
        $vipOnly = Product::where('sku_code', 'VIP-XL_5K_VIP')->first();
        ProductProviderSku::create([
            'product_id' => $vipOnly->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'XL_5K_VIP_DUP',
            'base_price' => 5400,
            'is_active' => true,
        ]);

        $res = $this->getJson('/api/v1/products?keyword=XL');
        $res->assertOk();

        $xlCards = collect($res->json('data'))->filter(fn ($row) => ($row['name'] ?? '') === 'XL 5K');
        $this->assertCount(1, $xlCards);
    }

    public function test_routing_priority_digiflazz_first(): void
    {
        $routing = app(ProductRoutingService::class);
        $offers = $routing->orderedOffersForProduct($this->product);
        $this->assertSame('digiflazz', $offers->first()->productProvider->code);
        $this->assertSame('xl5', $offers->first()->provider_sku);
    }

    public function test_routing_priority_reversed(): void
    {
        $this->digi->update(['priority' => 2]);
        $this->vip->update(['priority' => 1]);

        $routing = app(ProductRoutingService::class);
        $offers = $routing->orderedOffersForProduct($this->product->fresh());
        $this->assertSame('vip', $offers->first()->productProvider->code);
        $this->assertSame('XL_5K_VIP', $offers->first()->provider_sku);
    }

    public function test_digiflazz_timeout_uses_check_status_not_vip_failover(): void
    {
        // Sprint 10 / SRS 15.3 — timeout after dispatch is ambiguous; checkStatus(A) only.
        Queue::fake();
        $tx = $this->makePendingTransaction();

        $digiAdapter = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digiAdapter->shouldReceive('code')->andReturn('digiflazz');
        $digiAdapter->shouldReceive('isConfigured')->andReturn(true);
        $digiAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::error(900, 'timeout', true, 'Connection timed out')
        );
        $digiAdapter->shouldReceive('checkStatus')->once()->andReturn(
            ProviderFulfillmentResult::pending(100, [], 'still processing')
        );

        $vipAdapter = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn('vip');
        $vipAdapter->shouldReceive('isConfigured')->andReturn(true);
        $vipAdapter->shouldReceive('fulfill')->never();

        $this->bindMockedRegistry($digiAdapter, $vipAdapter);

        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::PENDING_SUPPLIER->value, $fresh->status);
        $this->assertDatabaseHas('product_provider_logs', [
            'transaction_id' => $tx->id,
            'event_type' => 'post_dispatch_check',
            'selected_provider_code' => 'digiflazz',
        ]);
    }

    public function test_digiflazz_api_error_failovers_to_vip(): void
    {
        $tx = $this->makePendingTransaction();

        $digiAdapter = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digiAdapter->shouldReceive('code')->andReturn('digiflazz');
        $digiAdapter->shouldReceive('isConfigured')->andReturn(true);
        $digiAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::failed(400, 'provider_error', true, 'HTTP 503', [])
        );

        $vipAdapter = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn('vip');
        $vipAdapter->shouldReceive('isConfigured')->andReturn(true);
        $vipAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::success(300, 'SN-OK', [])
        );

        $this->bindMockedRegistry($digiAdapter, $vipAdapter);
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
    }

    public function test_customer_validation_does_not_failover(): void
    {
        $tx = $this->makePendingTransaction();

        $digiAdapter = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digiAdapter->shouldReceive('code')->andReturn('digiflazz');
        $digiAdapter->shouldReceive('isConfigured')->andReturn(true);
        $digiAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::failed(200, 'customer_validation', false, 'Nomor salah / tidak terdaftar', [])
        );

        $vipAdapter = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn('vip');
        $vipAdapter->shouldReceive('isConfigured')->andReturn(true);
        $vipAdapter->shouldReceive('fulfill')->never();

        $this->bindMockedRegistry($digiAdapter, $vipAdapter);
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $this->assertSame(TransactionStatus::FAILED->value, $tx->fresh()->status);
    }

    /**
     * SRS Bagian 24 #5 — both Digiflazz and VIP unavailable → FAILED + auto refund (14.5).
     */
    public function test_both_providers_down_failed_and_auto_refund(): void
    {
        $user = User::factory()->create();
        $wallet = \App\Models\Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '1042'.str_pad((string) $user->id, 8, '0', STR_PAD_LEFT),
            'balance' => 94000.00, // already held 6000 for this purchase (LOCKED)
            'status' => 'active',
        ]);

        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'GRK-BOTH-DOWN-'.uniqid(),
            'service_name' => 'XL 5K',
            'target_number' => '081234567890',
            'amount' => 6000,
            'admin_fee' => 0,
            'total_payment' => 6000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::LOCKED->value,
            'notes' => 'both providers down test',
        ]);
        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => 'XL5K',
            'product_name' => 'XL 5K',
            'price' => 6000,
            'quantity' => 1,
        ]);

        $digiAdapter = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digiAdapter->shouldReceive('code')->andReturn('digiflazz');
        $digiAdapter->shouldReceive('isConfigured')->andReturn(true);
        // Confirmed pre-processed unavailability (not ambiguous timeout) — failover chain then refund.
        $digiAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::failed(900, 'provider_offline', true, 'Digiflazz unavailable', [])
        );

        $vipAdapter = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn('vip');
        $vipAdapter->shouldReceive('isConfigured')->andReturn(true);
        $vipAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::failed(900, 'provider_offline', true, 'VIP unavailable', [])
        );

        $this->bindMockedRegistry($digiAdapter, $vipAdapter);
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertNotNull($fresh->refunded_at);

        $wallet->refresh();
        $this->assertEquals(100000.00, (float) $wallet->balance);

        $this->assertEquals(
            1,
            \App\Models\WalletMutation::where('wallet_id', $wallet->id)->where('type', 'refund')->count()
        );

        // Idempotent — second fulfill must not double-credit (already terminal FAILED).
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));
        $wallet->refresh();
        $this->assertEquals(100000.00, (float) $wallet->balance);
        $this->assertEquals(
            1,
            \App\Models\WalletMutation::where('wallet_id', $wallet->id)->where('type', 'refund')->count()
        );
    }

    public function test_disable_digiflazz_routes_only_vip(): void
    {
        $this->digi->update(['is_active' => false]);
        $routing = app(ProductRoutingService::class);
        $offers = $routing->orderedOffersForProduct($this->product->fresh());
        $this->assertCount(1, $offers);
        $this->assertSame('vip', $offers->first()->productProvider->code);
    }

    public function test_sibling_products_share_failover_candidates(): void
    {
        // Digi and VIP on separate product rows (different names, same operator + nominal).
        $vipProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->brand->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-XL5K-SIB',
            'name' => 'XL Pulsa 5.000',
            'base_price' => 5400,
            'sell_price' => 5900,
            'admin_fee' => 0,
            'status' => true,
        ]);
        ProductProviderSku::where('product_id', $this->product->id)
            ->where('product_provider_id', $this->vip->id)
            ->delete();
        ProductProviderSku::create([
            'product_id' => $vipProduct->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'XL_5K_VIP_SIB',
            'base_price' => 5400,
            'is_active' => true,
        ]);

        $this->product->update(['name' => 'XL 5.000']);

        $routing = app(ProductRoutingService::class);
        $offers = $routing->orderedOffersForProduct($this->product->fresh(['category', 'provider']));

        $this->assertGreaterThanOrEqual(2, $offers->count());
        $this->assertSame('digiflazz', $offers->first()->productProvider->code);
        $this->assertTrue($offers->contains(fn ($o) => $o->productProvider?->code === 'vip'));

        $tx = $this->makePendingTransaction();

        $digiAdapter = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digiAdapter->shouldReceive('code')->andReturn('digiflazz');
        $digiAdapter->shouldReceive('isConfigured')->andReturn(true);
        // Confirmed pre-processed provider failure — failover to sibling VIP SKU allowed.
        $digiAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::failed(400, 'provider_error', true, 'HTTP 503', [])
        );

        $vipAdapter = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn('vip');
        $vipAdapter->shouldReceive('isConfigured')->andReturn(true);
        $vipAdapter->shouldReceive('fulfill')
            ->once()
            ->withArgs(fn ($transaction, $sku) => $sku === 'XL_5K_VIP_SIB')
            ->andReturn(ProviderFulfillmentResult::success(500, 'SN-SIB', []));

        $this->bindMockedRegistry($digiAdapter, $vipAdapter);
        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
    }

    protected function makePendingTransaction(): Transaction
    {
        $user = User::factory()->create();
        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'GRK-RT-' . uniqid(),
            'service_name' => 'XL 5K',
            'target_number' => '081234567890',
            'amount' => 6000,
            'admin_fee' => 0,
            'total_payment' => 6000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PENDING->value,
            'notes' => 'test',
        ]);
        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => 'XL5K',
            'product_name' => 'XL 5K',
            'price' => 6000,
            'quantity' => 1,
        ]);

        return $tx;
    }

    protected function bindMockedRegistry($digiAdapter, $vipAdapter): void
    {
        $registry = new ProductProviderRegistry($digiAdapter, $vipAdapter);
        $this->app->instance(ProductProviderRegistry::class, $registry);
        $routing = new ProductRoutingService($registry, new ProviderFailoverPolicy());
        $this->app->instance(ProductRoutingService::class, $routing);
        $this->app->instance(ProductProviderSelectionService::class, new ProductProviderSelectionService($registry, $routing));
    }
}
