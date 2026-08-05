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

    public function test_digiflazz_timeout_failovers_to_vip(): void
    {
        $tx = $this->makePendingTransaction();

        $digiAdapter = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digiAdapter->shouldReceive('code')->andReturn('digiflazz');
        $digiAdapter->shouldReceive('isConfigured')->andReturn(true);
        $digiAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::error(900, 'timeout', true, 'Connection timed out')
        );

        $vipAdapter = Mockery::mock(VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn('vip');
        $vipAdapter->shouldReceive('isConfigured')->andReturn(true);
        $vipAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::success(500, 'SN-VIP', [])
        );

        $this->bindMockedRegistry($digiAdapter, $vipAdapter);

        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertDatabaseHas('product_provider_logs', [
            'transaction_id' => $tx->id,
            'event_type' => 'failover',
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

    public function test_disable_digiflazz_routes_only_vip(): void
    {
        $this->digi->update(['is_active' => false]);
        $routing = app(ProductRoutingService::class);
        $offers = $routing->orderedOffersForProduct($this->product->fresh());
        $this->assertCount(1, $offers);
        $this->assertSame('vip', $offers->first()->productProvider->code);
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
