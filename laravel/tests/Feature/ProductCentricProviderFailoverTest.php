<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\User;
use App\Services\AvailabilityService;
use App\Services\ProductProviders\ProductCatalogCache;
use App\Services\ProductProviders\ProductRoutingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Product-centric routing: provider status must not kill a logical SKU when a backup can fulfill.
 */
class ProductCentricProviderFailoverTest extends TestCase
{
    use RefreshDatabase;

    protected ProductProvider $digi;
    protected ProductProvider $vip;
    protected ProductCategory $pulsa;
    protected Provider $telkomsel;
    protected Product $master;
    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        $this->digi->update([
            'is_active' => true,
            'partner_status' => 'online',
            'api_status' => 'online',
            'priority' => 1,
        ]);
        $this->vip->update([
            'is_active' => true,
            'partner_status' => 'online',
            'api_status' => 'online',
            'priority' => 2,
        ]);

        $this->pulsa = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'phone', 'is_active' => true]);
        $this->telkomsel = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);

        $this->master = Product::create([
            'product_category_id' => $this->pulsa->id,
            'provider_id' => $this->telkomsel->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'TSEL10-MULTI',
            'name' => 'Telkomsel 10.000',
            'base_price' => 10000,
            'sell_price' => 11500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        ProductProviderSku::create([
            'product_id' => $this->master->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'TSEL10',
            'base_price' => 10000,
            'is_active' => true,
            'is_preferred' => true,
        ]);
        ProductProviderSku::create([
            'product_id' => $this->master->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'VIP-TSEL10',
            'base_price' => 10100,
            'is_active' => true,
        ]);

        $this->user = User::create([
            'name' => 'Buyer',
            'email' => 'buyer-failover@gurkypay.com',
            'phone_number' => '081299900011',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        ProductCatalogCache::bump();
    }

    public function test_routing_prefers_priority_one_when_both_online(): void
    {
        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($this->master->fresh());
        $this->assertGreaterThanOrEqual(2, $offers->count());
        $this->assertSame(ProductProvider::CODE_DIGIFLAZZ, $offers->first()->productProvider?->code);
    }

    public function test_digiflazz_offline_still_sellable_via_vip(): void
    {
        $this->digi->update([
            'is_active' => false,
            'partner_status' => 'offline',
            'api_status' => 'offline',
        ]);
        ProductCatalogCache::bump();

        $availability = app(AvailabilityService::class);
        $product = $this->master->fresh(['providerSkus.productProvider', 'category', 'provider']);

        $this->assertSame('active', $availability->getStatus($product));
        $this->assertTrue($availability->isAvailable($product));

        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($product);
        $this->assertCount(1, $offers);
        $this->assertSame(ProductProvider::CODE_VIP, $offers->first()->productProvider?->code);

        Sanctum::actingAs($this->user);
        $catalog = $this->getJson('/api/v1/products?category=pulsa&per_page=100');
        $catalog->assertOk();
        $row = collect($catalog->json('data'))->firstWhere('code', 'TSEL10-MULTI');
        $this->assertNotNull($row, 'Produk harus tetap tampil meski Digiflazz Offline jika VIP Online');
        $this->assertTrue($row['isPurchasable']);
        $this->assertSame('active', $row['availabilityStatus']);
        // User never sees provider codes on the card fields used for purchase.
        $this->assertArrayNotHasKey('selectedProvider', $row);
    }

    public function test_digiflazz_maintenance_vip_takes_over_for_same_sku(): void
    {
        $this->digi->update([
            'is_active' => true,
            'partner_status' => 'maintenance',
            'api_status' => 'online',
        ]);
        ProductCatalogCache::bump();

        $availability = app(AvailabilityService::class);
        $product = $this->master->fresh(['providerSkus.productProvider', 'category', 'provider']);

        $this->assertSame('active', $availability->getStatus($product));
        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($product);
        $this->assertSame(ProductProvider::CODE_VIP, $offers->first()->productProvider?->code);
    }

    public function test_all_providers_down_marks_maintenance(): void
    {
        $this->digi->update(['is_active' => false, 'partner_status' => 'offline', 'api_status' => 'offline']);
        $this->vip->update(['is_active' => false, 'partner_status' => 'offline', 'api_status' => 'offline']);
        ProductCatalogCache::bump();

        $availability = app(AvailabilityService::class);
        $product = $this->master->fresh(['providerSkus.productProvider', 'category', 'provider']);

        // Mappings still exist → Maintenance (not fake-active).
        $this->assertSame('maintenance', $availability->getStatus($product));
        $this->assertFalse($availability->isAvailable($product));
    }

    public function test_control_center_exposes_product_centric_routing_mode(): void
    {
        $ops = User::create([
            'name' => 'Ops',
            'email' => 'ops-failover@gurkypay.com',
            'phone_number' => '081299900012',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Sanctum::actingAs($ops);

        $res = $this->getJson('/api/v1/admin/operations/product-provider-control');
        $res->assertOk();
        $data = $res->json('data');
        $providers = $data['providers'] ?? $data;
        $card = collect($providers)->firstWhere('code', 'digiflazz');
        $this->assertNotNull($card);
        $this->assertSame('product_priority_failover', $card['routingMode']);
        $this->assertFalse($card['controlsCatalogAlone']);
        $this->assertArrayHasKey('priority', $card);
        $this->assertArrayHasKey('productCount', $card);
        $this->assertArrayHasKey('apiStatus', $card);
    }
}
