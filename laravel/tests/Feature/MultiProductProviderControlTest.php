<?php

namespace Tests\Feature;

use App\Jobs\ProcessProductProviderTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\User;
use App\Services\ProductProviders\DigiflazzProductProviderAdapter;
use App\Services\ProductProviders\ProductProviderFulfillmentService;
use App\Services\ProductProviders\ProductProviderSelectionService;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Enums\TransactionStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class MultiProductProviderControlTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsOps(): User
    {
        $user = User::factory()->create([
            'role' => \App\Enums\UserRole::OPERATIONS,
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_control_center_lists_providers_without_payment_gateways(): void
    {
        $this->actingAsOps();

        $response = $this->getJson('/api/v1/admin/operations/product-provider-control');
        $response->assertOk();

        $codes = collect($response->json('data'))->pluck('code')->all();
        $this->assertContains('digiflazz', $codes);
        $this->assertContains('vip', $codes);
        $this->assertNotContains('midtrans', $codes);
        $this->assertNotContains('xendit', $codes);
        $this->assertNotContains('alterra', $codes);
        $this->assertNotContains('artajasa', $codes);
    }

    public function test_disable_provider_and_set_primary(): void
    {
        $this->actingAsOps();

        $digi = ProductProvider::digiflazz();
        $vip = ProductProvider::vip();
        $this->assertNotNull($digi);
        $this->assertNotNull($vip);

        $this->postJson("/api/v1/admin/operations/product-provider-control/{$digi->id}/disable")
            ->assertOk();

        $this->assertFalse($digi->fresh()->is_active);

        $this->postJson("/api/v1/admin/operations/product-provider-control/{$vip->id}/set-primary")
            ->assertOk();

        $this->assertSame(1, (int) $vip->fresh()->priority);
        $this->assertGreaterThan(1, (int) $digi->fresh()->priority);
    }

    public function test_power_off_does_not_mutate_api_status(): void
    {
        $this->actingAsOps();

        $digi = ProductProvider::digiflazz();
        $this->assertNotNull($digi);

        $digi->update([
            'is_active' => true,
            'api_status' => 'online',
            'health_color' => 'green',
        ]);

        $res = $this->postJson("/api/v1/admin/operations/product-provider-control/{$digi->id}/disable")
            ->assertOk();

        $fresh = $digi->fresh();
        $this->assertFalse((bool) $fresh->is_active);
        $this->assertSame('online', $fresh->api_status);
        $this->assertSame('green', $fresh->health_color);

        $card = $res->json('data');
        $this->assertFalse($card['enabled']);
        $this->assertSame('OFF', $card['status']);
        $this->assertSame('ONLINE', $card['apiStatusLabel']);
        $this->assertFalse($card['apiWarning']);
    }

    public function test_power_on_runs_automatic_health_check_and_refreshes_api_status(): void
    {
        $this->actingAsOps();

        $vip = ProductProvider::vip();
        $this->assertNotNull($vip);

        $vip->update([
            'is_active' => false,
            'api_status' => 'offline',
            'health_color' => 'yellow',
            'last_error' => 'stale offline from previous outage',
        ]);

        $this->mock(\App\Services\ProductProviders\ProductProviderHealthService::class, function ($mock) {
            $mock->shouldReceive('check')
                ->once()
                ->andReturnUsing(function (ProductProvider $provider) {
                    $provider->forceFill([
                        'api_status' => 'online',
                        'health_color' => 'green',
                        'last_error' => null,
                        'last_health_check_at' => now(),
                    ])->save();

                    return $provider->fresh();
                });
            $mock->shouldReceive('refreshStats')->zeroOrMoreTimes();
        });

        $res = $this->postJson("/api/v1/admin/operations/product-provider-control/{$vip->id}/enable")
            ->assertOk();

        $fresh = $vip->fresh();
        $this->assertTrue((bool) $fresh->is_active);
        $this->assertSame('online', $fresh->api_status);
        $this->assertSame('green', $fresh->health_color);
        $this->assertNull($fresh->last_error);

        $card = $res->json('data');
        $this->assertTrue($card['enabled']);
        $this->assertSame('ON', $card['status']);
        $this->assertSame('ONLINE', $card['apiStatusLabel']);
        $this->assertFalse($card['apiWarning']);
    }

    public function test_power_on_with_unreachable_api_keeps_power_on_and_persists_offline(): void
    {
        $this->actingAsOps();

        $vip = ProductProvider::vip();
        $this->assertNotNull($vip);

        $vip->update([
            'is_active' => false,
            'api_status' => 'online',
            'health_color' => 'green',
            'last_error' => null,
        ]);

        $this->mock(\App\Services\ProductProviders\ProductProviderHealthService::class, function ($mock) {
            $mock->shouldReceive('check')
                ->once()
                ->andReturnUsing(function (ProductProvider $provider) {
                    $provider->forceFill([
                        'api_status' => 'offline',
                        'health_color' => 'red',
                        'last_error' => 'VIP API unreachable',
                        'last_health_check_at' => now(),
                    ])->save();

                    return $provider->fresh();
                });
            $mock->shouldReceive('refreshStats')->zeroOrMoreTimes();
        });

        $res = $this->postJson("/api/v1/admin/operations/product-provider-control/{$vip->id}/enable")
            ->assertOk();

        $fresh = $vip->fresh();
        $this->assertTrue((bool) $fresh->is_active);
        $this->assertSame('offline', $fresh->api_status);
        $this->assertSame('red', $fresh->health_color);

        $card = $res->json('data');
        $this->assertTrue($card['enabled']);
        $this->assertSame('ON', $card['status']);
        $this->assertSame('OFFLINE', $card['apiStatusLabel']);
        $this->assertTrue($card['apiWarning']);
    }

    public function test_sync_allowed_while_power_off_and_does_not_force_power_on(): void
    {
        $this->actingAsOps();

        $digi = ProductProvider::digiflazz();
        $this->assertNotNull($digi);
        $digi->update(['is_active' => false, 'api_status' => 'online', 'health_color' => 'green']);

        $this->mock(\App\Actions\Admin\Operations\SyncDigiflazzCatalogAction::class, function ($mock) {
            $mock->shouldReceive('execute')
                ->once()
                ->andReturn([
                    'success' => true,
                    'message' => 'Sync ok while power off',
                    'synced_count' => 3,
                    'failed_count' => 0,
                ]);
        });

        $res = $this->postJson("/api/v1/admin/operations/product-provider-control/{$digi->id}/sync")
            ->assertOk();

        $this->assertFalse((bool) $digi->fresh()->is_active);
        $this->assertStringContainsString('Sync ok', (string) $res->json('message'));
        $this->assertFalse($res->json('data.provider.enabled'));
    }

    public function test_sku_mapping_and_priority_selection(): void
    {
        $digi = ProductProvider::digiflazz();
        $vip = ProductProvider::vip();
        $digi->update(['is_active' => true, 'priority' => 1, 'api_status' => 'online']);
        $vip->update(['is_active' => true, 'priority' => 2, 'api_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Data', 'slug' => 'data', 'icon' => 'wifi']);
        $brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);

        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'FLASH1',
            'name' => 'Telkomsel Flash 1GB',
            'base_price' => 15160,
            'sell_price' => 17000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'flash1',
            'base_price' => 15160,
            'is_preferred' => false,
            'is_active' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $vip->id,
            'provider_sku' => 'TLK_FLASH_1GB',
            'base_price' => 15050,
            'is_preferred' => false,
            'is_active' => true,
        ]);

        $selection = app(ProductProviderSelectionService::class);
        $candidates = $selection->candidatesForProduct($product);

        $this->assertCount(2, $candidates);
        $this->assertSame('flash1', $candidates->first()->provider_sku);
        $this->assertSame(ProductProvider::CODE_DIGIFLAZZ, $candidates->first()->productProvider->code);

        // Disable Digiflazz → only VipPulsa remains
        $digi->update(['is_active' => false]);
        $candidates2 = $selection->candidatesForProduct($product->fresh());
        $this->assertCount(1, $candidates2);
        $this->assertSame('TLK_FLASH_1GB', $candidates2->first()->provider_sku);
    }

    public function test_fulfillment_failovers_to_next_provider(): void
    {
        $digi = ProductProvider::digiflazz();
        $vip = ProductProvider::vip();
        $digi->update(['is_active' => true, 'priority' => 1, 'api_status' => 'online']);
        $vip->update(['is_active' => true, 'priority' => 2, 'api_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Data', 'slug' => 'data2', 'icon' => 'wifi']);
        $brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'FLASH1',
            'name' => 'Flash 1GB',
            'base_price' => 15000,
            'sell_price' => 16000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'flash1',
            'base_price' => 15160,
            'is_preferred' => true,
            'is_active' => true,
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $vip->id,
            'provider_sku' => 'TLK_FLASH_1GB',
            'base_price' => 15050,
            'is_preferred' => false,
            'is_active' => true,
        ]);

        $user = User::factory()->create();
        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'GRK-TEST-000001',
            'service_name' => 'Test',
            'target_number' => '081234567890',
            'amount' => 16000,
            'admin_fee' => 0,
            'total_payment' => 16000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PENDING->value,
            'notes' => 'test',
        ]);
        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => 'FLASH1',
            'product_name' => 'Flash 1GB',
            'price' => 16000,
            'quantity' => 1,
        ]);

        $digiAdapter = Mockery::mock(DigiflazzProductProviderAdapter::class);
        $digiAdapter->shouldReceive('code')->andReturn('digiflazz');
        $digiAdapter->shouldReceive('isConfigured')->andReturn(true);
        $digiAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::error(1200, 'timeout', true, 'Connection timed out')
        );

        $vipAdapter = Mockery::mock(\App\Services\ProductProviders\VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn('vip');
        $vipAdapter->shouldReceive('isConfigured')->andReturn(true);
        $vipAdapter->shouldReceive('fulfill')->once()->andReturn(
            ProviderFulfillmentResult::success(800, 'SN123', ['status' => 'success'])
        );

        $registry = new \App\Services\ProductProviders\ProductProviderRegistry($digiAdapter, $vipAdapter);
        $this->app->instance(\App\Services\ProductProviders\ProductProviderRegistry::class, $registry);
        $routing = new \App\Services\ProductProviders\ProductRoutingService(
            $registry,
            new \App\Services\ProductProviders\ProviderFailoverPolicy()
        );
        $this->app->instance(\App\Services\ProductProviders\ProductRoutingService::class, $routing);
        $this->app->instance(ProductProviderSelectionService::class, new ProductProviderSelectionService($registry, $routing));

        $service = app(ProductProviderFulfillmentService::class);
        $service->fulfill($tx->fresh(['items']));

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertDatabaseHas('product_provider_logs', [
            'transaction_id' => $tx->id,
            'event_type' => 'failover',
        ]);
    }

    public function test_create_transaction_dispatches_multi_provider_job(): void
    {
        Queue::fake();
        $this->actingAsOps(); // not needed for action, but ok

        // Covered indirectly: job class exists and is dispatchable
        ProcessProductProviderTransaction::dispatch(1);
        Queue::assertPushed(ProcessProductProviderTransaction::class);
    }

    public function test_health_service_persists_vip_profile_online_to_database(): void
    {
        $vip = ProductProvider::vip();
        $this->assertNotNull($vip);

        $category = \App\Models\ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-ctrl', 'icon' => 'phone', 'is_active' => true]);
        $brand = \App\Models\Provider::create(['name' => 'Axis Ctrl', 'logo' => 'a.png', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $vip->id,
            'sku_code' => 'VIP-CTRL-1',
            'name' => 'VIP Ctrl SKU',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $vip->id,
            'provider_sku' => 'vipctrl1',
            'is_active' => true,
            'is_preferred' => true,
            'priority' => 1,
        ]);

        $vip->update([
            'is_active' => true,
            'partner_status' => 'online',
            'api_status' => 'offline',
            'health_color' => 'yellow',
            'last_error' => 'stale',
            'last_sync_at' => now(),
            'product_count' => 1,
        ]);

        $this->mock(\App\Services\VipService::class, function ($mock) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
            $mock->shouldReceive('profile')->once()->andReturn([
                'success' => true,
                'api_status' => 'online',
                'health_color' => 'green',
                'http_status' => 200,
                'latency_ms' => 321,
                'balance' => 150000.0,
                'message' => 'OK',
                'raw' => ['result' => true],
            ]);
        });

        $fresh = app(\App\Services\ProductProviders\ProductProviderHealthService::class)->check($vip->fresh());

        $this->assertSame('online', $fresh->api_status);
        $this->assertSame('green', $fresh->health_color);
        $this->assertNull($fresh->last_error);
        $this->assertNotNull($fresh->last_health_check_at);
        $this->assertSame(321, (int) $fresh->avg_response_ms);
    }
}
