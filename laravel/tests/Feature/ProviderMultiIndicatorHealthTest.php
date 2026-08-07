<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\User;
use App\Services\ProductProviders\ProductProviderHealthService;
use App\Services\ProductProviders\ProductRoutingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProviderMultiIndicatorHealthTest extends TestCase
{
    use RefreshDatabase;

    protected ProductProvider $digi;
    protected ProductProvider $vip;

    protected function setUp(): void
    {
        parent::setUp();

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        $this->seedSyncedSku($this->digi);
        $this->seedSyncedSku($this->vip);
    }

    protected function seedSyncedSku(ProductProvider $provider): void
    {
        $category = ProductCategory::firstOrCreate(
            ['slug' => 'pulsa'],
            ['name' => 'Pulsa', 'icon' => 'phone', 'is_active' => true]
        );
        $brand = Provider::firstOrCreate(
            ['name' => 'Telkomsel'],
            ['logo' => 't.png', 'is_active' => true]
        );

        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $provider->id,
            'sku_code' => strtoupper($provider->code).'-TSEL10',
            'name' => 'Telkomsel 10rb '.$provider->code,
            'base_price' => 10000,
            'sell_price' => 11500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $provider->id,
            'provider_sku' => 'xld'.$provider->id,
            'is_active' => true,
            'is_preferred' => true,
            'priority' => 1,
        ]);

        $provider->update([
            'is_active' => true,
            'partner_status' => 'online',
            'product_count' => 1,
            'last_sync_at' => now(),
        ]);
    }

    public function test_digi_balance_fail_with_ok_connection_is_partial(): void
    {
        $this->mock(\App\Services\DigiflazzService::class, function ($mock) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
            $mock->shouldReceive('healthProbe')->once()->andReturn([
                'configured' => true,
                'connection' => 'ok',
                'authentication' => 'ok',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => 120,
                'http_status' => 200,
                'message' => 'Gagal mengambil informasi saldo provider',
            ]);
        });

        $fresh = app(ProductProviderHealthService::class)->check($this->digi->fresh());

        $this->assertSame('partial', $fresh->api_status);
        $this->assertSame('yellow', $fresh->health_color);
        $this->assertStringContainsString('saldo', strtolower((string) $fresh->last_error));
    }

    public function test_digi_timeout_is_offline(): void
    {
        $this->mock(\App\Services\DigiflazzService::class, function ($mock) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
            $mock->shouldReceive('healthProbe')->once()->andReturn([
                'configured' => true,
                'connection' => 'timeout',
                'authentication' => 'unknown',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => 5000,
                'http_status' => null,
                'message' => 'Connection timed out',
            ]);
        });

        $fresh = app(ProductProviderHealthService::class)->check($this->digi->fresh());

        $this->assertSame('offline', $fresh->api_status);
        $this->assertSame('red', $fresh->health_color);
    }

    public function test_digi_auth_failed(): void
    {
        $this->mock(\App\Services\DigiflazzService::class, function ($mock) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
            $mock->shouldReceive('healthProbe')->once()->andReturn([
                'configured' => true,
                'connection' => 'ok',
                'authentication' => 'failed',
                'balance' => 'failed',
                'balance_value' => null,
                'latency_ms' => 80,
                'http_status' => 401,
                'message' => 'Invalid credentials',
            ]);
        });

        $fresh = app(ProductProviderHealthService::class)->check($this->digi->fresh());

        $this->assertSame('auth_failed', $fresh->api_status);
    }

    public function test_routing_keeps_partial_digi_before_vip(): void
    {
        $this->digi->update(['priority' => 1, 'api_status' => 'partial', 'health_color' => 'yellow', 'is_active' => true]);
        $this->vip->update(['priority' => 2, 'api_status' => 'online', 'health_color' => 'green', 'is_active' => true]);

        $product = Product::where('product_provider_id', $this->digi->id)->first();
        $this->assertNotNull($product);

        // Mirror Digi product onto VIP for failover mapping.
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'vip-tsel10',
            'is_active' => true,
            'is_preferred' => false,
            'priority' => 2,
        ]);

        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($product);
        $this->assertNotEmpty($offers);
        $first = $offers->first();
        $this->assertSame($this->digi->id, (int) $first->product_provider_id);
    }

    public function test_routing_skips_offline_digi_for_vip(): void
    {
        $this->digi->update(['priority' => 1, 'api_status' => 'offline', 'is_active' => true]);
        $this->vip->update(['priority' => 2, 'api_status' => 'online', 'is_active' => true]);

        $product = Product::where('product_provider_id', $this->digi->id)->first();
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'vip-tsel10b',
            'is_active' => true,
            'is_preferred' => false,
            'priority' => 2,
        ]);

        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($product);
        $this->assertNotEmpty($offers);
        $this->assertSame($this->vip->id, (int) $offers->first()->product_provider_id);
    }

    public function test_control_center_card_uses_indonesian_labels(): void
    {
        Sanctum::actingAs(User::create([
            'name' => 'Ops Health',
            'email' => 'ops-health@gurkypay.com',
            'phone_number' => '081299900001',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]));

        $this->digi->update([
            'api_status' => 'partial',
            'health_color' => 'yellow',
            'last_error' => 'Gagal mengambil informasi saldo provider. Transaksi masih dapat diproses.',
            'last_sync_at' => now(),
            'product_count' => 1,
        ]);

        $res = $this->getJson('/api/v1/admin/operations/product-provider-control');
        $res->assertOk();
        $card = collect($res->json('data'))->firstWhere('code', $this->digi->code);
        $this->assertNotNull($card);
        $this->assertSame('PARTIAL', $card['apiStatusLabel']);
        $this->assertStringContainsString('saldo', strtolower((string) ($card['statusDescription'] ?? '')));
        $this->assertStringContainsString('SKU', (string) ($card['productCountLabel'] ?? ''));
    }
}
