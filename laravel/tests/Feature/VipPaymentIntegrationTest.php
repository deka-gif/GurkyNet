<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\User;
use App\Services\VipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VipPaymentIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'services.vip.username' => 'api-id-test',
            'services.vip.merchant_id' => 'api-id-test',
            'services.vip.api_key' => 'api-key-test',
            'services.vip.signature' => '',
        ]);

        ProductProvider::vip()?->update(['is_active' => true, 'api_status' => 'unknown']);
    }

    protected function actingAsOps(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => \App\Enums\UserRole::OPERATIONS,
        ]));
    }

    public function test_missing_credentials_returns_descriptive_error(): void
    {
        config([
            'services.vip.base_url' => '',
            'services.vip.merchant_id' => '',
            'services.vip.username' => '',
            'services.vip.api_key' => '',
        ]);

        $status = app(VipService::class)->credentialStatus();
        $this->assertFalse($status['ok']);
        $this->assertTrue(
            collect($status['missing'])->contains(fn ($m) => str_contains((string) $m, 'VIP_MERCHANT_ID') || str_contains((string) $m, 'VIP_USERNAME'))
        );
        $this->assertContains('VIP_API_KEY', $status['missing']);
        $this->assertStringContainsString('Missing:', $status['message']);
    }

    public function test_production_merchant_id_is_loaded_without_vip_username(): void
    {
        config([
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'services.vip.merchant_id' => 'prod-api-id',
            'services.vip.username' => '',
            'services.vip.api_key' => 'prod-api-key',
            'services.vip.signature' => '',
        ]);

        $status = app(VipService::class)->credentialStatus();
        $this->assertTrue($status['ok'], $status['message'] ?? 'should be configured');
        $this->assertSame([], $status['missing']);
    }

    public function test_health_check_sets_online_on_success(): void
    {
        $this->actingAsOps();
        $vip = ProductProvider::vip();
        $this->assertNotNull($vip);

        Http::fake([
            'vip-reseller.co.id/api/profile' => Http::response([
                'result' => true,
                'message' => 'OK',
                'data' => ['balance' => 150000, 'username' => 'demo'],
            ], 200),
        ]);

        $res = $this->postJson("/api/v1/admin/operations/product-provider-control/{$vip->id}/health-check");
        $res->assertOk();

        $vip->refresh();
        $this->assertSame('online', $vip->api_status);
        $this->assertSame('green', $vip->health_color);
        $this->assertEquals(150000, (float) $vip->balance);

        $this->assertDatabaseHas('product_provider_logs', [
            'product_provider_id' => $vip->id,
            'event_type' => 'health_check',
            'success' => 1,
        ]);
    }

    public function test_health_check_sets_auth_failed(): void
    {
        $this->actingAsOps();
        $vip = ProductProvider::vip();

        Http::fake([
            'vip-reseller.co.id/api/profile' => Http::response([
                'result' => false,
                'message' => 'Invalid API Key',
            ], 200),
        ]);

        $this->postJson("/api/v1/admin/operations/product-provider-control/{$vip->id}/health-check")
            ->assertOk();

        $vip->refresh();
        $this->assertSame('auth_failed', $vip->api_status);
        $this->assertSame('red', $vip->health_color);
    }

    public function test_health_check_sets_timeout(): void
    {
        $this->actingAsOps();
        $vip = ProductProvider::vip();

        Http::fake([
            'vip-reseller.co.id/api/profile' => function () {
                throw new \Illuminate\Http\Client\ConnectionException('Connection timed out');
            },
        ]);

        $this->postJson("/api/v1/admin/operations/product-provider-control/{$vip->id}/health-check")
            ->assertOk();

        $vip->refresh();
        $this->assertSame('timeout', $vip->api_status);
    }

    public function test_sync_imports_vip_products_without_touching_digiflazz(): void
    {
        $this->actingAsOps();
        $vip = ProductProvider::vip();
        $digi = ProductProvider::digiflazz();

        // Existing Digiflazz product must remain untouched
        $category = \App\Models\ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'phone']);
        $brand = \App\Models\Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);
        $digiProduct = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'flash1',
            'name' => 'Digiflazz Flash',
            'base_price' => 15160,
            'sell_price' => 17000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        Http::fake([
            'vip-reseller.co.id/api/prepaid' => Http::response([
                'result' => true,
                'message' => 'OK',
                'data' => [
                    [
                        'code' => 'TLK_FLASH_1GB',
                        'name' => 'Telkomsel Flash 1GB',
                        'price' => 15050,
                        'brand' => 'TELKOMSEL',
                        'type' => 'paket-internet',
                        'status' => 'available',
                    ],
                    [
                        'code' => 'flash1',
                        'name' => 'VIP Flash Same Code',
                        'price' => 14900,
                        'brand' => 'TELKOMSEL',
                        'type' => 'paket-internet',
                        'status' => 'available',
                    ],
                ],
            ], 200),
            'vip-reseller.co.id/api/game-feature' => Http::response([
                'result' => true,
                'message' => 'OK',
                'data' => [
                    [
                        'code' => 'ZPT300000COINS-S16',
                        'game' => 'Zepeto',
                        'name' => '300.000 Coins',
                        'price' => [
                            'basic' => 812100,
                            'premium' => 806686,
                            'special' => 803979,
                        ],
                        'status' => 'available',
                    ],
                ],
            ], 200),
        ]);

        $res = $this->postJson("/api/v1/admin/operations/product-provider-control/{$vip->id}/sync");
        $res->assertOk();
        $payload = $res->json('data');
        $this->assertGreaterThanOrEqual(3, (int) ($payload['imported'] ?? 0) + (int) ($payload['updated'] ?? 0));
        $this->assertArrayHasKey('api_latency_ms', $payload);
        $this->assertArrayHasKey('api_response_status', $payload);
        $this->assertNotNull($payload['first_sku_id'] ?? null);

        $digiProduct->refresh();
        $this->assertSame('flash1', $digiProduct->sku_code);
        $this->assertSame((int) $digi->id, (int) $digiProduct->product_provider_id);
        $this->assertEquals(15160, (float) $digiProduct->base_price);

        $this->assertDatabaseHas('products', [
            'sku_code' => 'VIP-TLK_FLASH_1GB',
            'product_provider_id' => $vip->id,
        ]);
        $this->assertDatabaseHas('products', [
            'sku_code' => 'VIP-flash1',
            'product_provider_id' => $vip->id,
        ]);
        $this->assertDatabaseHas('products', [
            'sku_code' => 'VIP-ZPT300000COINS-S16',
            'product_provider_id' => $vip->id,
            'base_price' => 812100,
        ]);

        $this->assertDatabaseHas('product_provider_skus', [
            'product_provider_id' => $vip->id,
            'provider_sku' => 'TLK_FLASH_1GB',
            'provider_name' => 'Telkomsel Flash 1GB',
            'provider_status' => 'available',
        ]);
        $this->assertDatabaseHas('product_provider_skus', [
            'product_provider_id' => $vip->id,
            'provider_sku' => 'ZPT300000COINS-S16',
            'provider_name' => '300.000 Coins',
            'provider_price' => 812100,
            'provider_status' => 'available',
        ]);

        $vip->refresh();
        $this->assertGreaterThan(0, (int) $vip->product_count);
        $this->assertSame('online', $vip->api_status);

        // Product Management filter isolation
        $vipList = $this->getJson('/api/v1/admin/operations/products?product_provider_id=' . $vip->id);
        $vipList->assertOk();
        $vipCodes = collect($vipList->json('data'))->pluck('code')->all();
        $this->assertContains('VIP-TLK_FLASH_1GB', $vipCodes);
        $this->assertNotContains('flash1', $vipCodes);

        $digiList = $this->getJson('/api/v1/admin/operations/products?product_provider_id=' . $digi->id);
        $digiCodes = collect($digiList->json('data'))->pluck('code')->all();
        $this->assertContains('flash1', $digiCodes);
        $this->assertNotContains('VIP-TLK_FLASH_1GB', $digiCodes);
    }
}
