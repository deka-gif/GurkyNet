<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\User;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Ops Control Center → User Dashboard real-time data flow.
 */
class OperationsUserDashboardIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $ops;
    protected User $user;
    protected ProductProvider $digi;
    protected ProductProvider $vip;
    protected Product $digiProduct;
    protected Product $vipProduct;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ops = User::create([
            'name' => 'Ops Integration',
            'email' => 'ops-int@gurkypay.com',
            'phone_number' => '081277700001',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->user = User::create([
            'name' => 'User Integration',
            'email' => 'user-int@gurkypay.com',
            'phone_number' => '081277700002',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        $this->digi->update(['is_active' => true, 'partner_status' => 'online', 'api_status' => 'online']);
        $this->vip->update(['is_active' => true, 'partner_status' => 'online', 'api_status' => 'online']);

        $pulsa = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'phone', 'is_active' => true]);
        $brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);

        $this->digiProduct = Product::create([
            'product_category_id' => $pulsa->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'INT-DIGI-10',
            'name' => 'Telkomsel Integration 10rb',
            'base_price' => 10000,
            'sell_price' => 11500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $this->digiProduct->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'INT-DIGI-10',
            'base_price' => 10000,
            'is_active' => true,
        ]);

        $this->vipProduct = Product::create([
            'product_category_id' => $pulsa->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'INT-VIP-10',
            'name' => 'Telkomsel VIP Integration 10rb',
            'base_price' => 9900,
            'sell_price' => 11200,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $this->vipProduct->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'INT-VIP-10',
            'base_price' => 9900,
            'is_active' => true,
        ]);

        ProductCatalogCache::bump();
    }

    public function test_ops_inactive_hides_product_from_user_dashboard_and_search(): void
    {
        Sanctum::actingAs($this->ops);
        $this->putJson('/api/v1/admin/operations/products/'.$this->digiProduct->id, [
            'status' => 'inactive',
        ])->assertOk();

        $catalog = $this->getJson('/api/v1/products?per_page=100&keyword=Integration');
        $catalog->assertOk();
        $codes = collect($catalog->json('data'))->pluck('code')->all();
        $this->assertNotContains('INT-DIGI-10', $codes);
        $this->assertContains('INT-VIP-10', $codes);
    }

    public function test_ops_maintenance_keeps_product_visible_but_not_purchasable(): void
    {
        Sanctum::actingAs($this->ops);
        $this->putJson('/api/v1/admin/operations/products/'.$this->digiProduct->id, [
            'status' => 'maintenance',
        ])->assertOk();

        $catalog = $this->getJson('/api/v1/products?per_page=100');
        $catalog->assertOk();
        $row = collect($catalog->json('data'))->firstWhere('code', 'INT-DIGI-10');
        $this->assertNotNull($row);
        $this->assertSame('maintenance', $row['availabilityStatus']);
        $this->assertFalse($row['isPurchasable']);
        $this->assertSame('maintenance', $row['status']);
    }

    public function test_ops_price_and_margin_sync_to_user_dashboard(): void
    {
        Sanctum::actingAs($this->ops);
        $this->putJson('/api/v1/admin/operations/products/'.$this->digiProduct->id, [
            'selling_price' => 13000,
            'status' => 'active',
        ])->assertOk();

        $catalog = $this->getJson('/api/v1/products?per_page=100');
        $catalog->assertOk();
        $row = collect($catalog->json('data'))->firstWhere('code', 'INT-DIGI-10');
        $this->assertNotNull($row);
        $this->assertEquals(13000.0, (float) $row['price']);

        $this->putJson('/api/v1/admin/operations/products/'.$this->digiProduct->id, [
            'margin' => 2500,
            'status' => 'active',
        ])->assertOk();

        ProductCatalogCache::bump();
        $catalog2 = $this->getJson('/api/v1/products?per_page=100');
        $row2 = collect($catalog2->json('data'))->firstWhere('code', 'INT-DIGI-10');
        $this->assertNotNull($row2);
        // sell_price = base 10000 + margin 2500 + admin 0
        $this->assertEquals(12500.0, (float) $row2['price']);
    }

    public function test_provider_maintenance_blocks_only_that_provider_products(): void
    {
        Sanctum::actingAs($this->ops);
        $this->postJson('/api/v1/admin/operations/product-provider-control/'.$this->digi->id.'/maintenance')
            ->assertOk();

        ProductCatalogCache::bump();
        $catalog = $this->getJson('/api/v1/products?per_page=100');
        $catalog->assertOk();
        $rows = collect($catalog->json('data'));

        $digi = $rows->firstWhere('code', 'INT-DIGI-10');
        $vip = $rows->firstWhere('code', 'INT-VIP-10');
        $this->assertNotNull($digi);
        $this->assertSame('maintenance', $digi['availabilityStatus']);
        $this->assertFalse($digi['isPurchasable']);
        $this->assertNotNull($vip);
        $this->assertTrue($vip['isPurchasable']);
    }

    public function test_checkout_rejects_inactive_and_maintenance_products(): void
    {
        Sanctum::actingAs($this->ops);
        $this->putJson('/api/v1/admin/operations/products/'.$this->digiProduct->id, [
            'status' => 'maintenance',
        ])->assertOk();

        Sanctum::actingAs($this->user);
        $this->user->wallet()->create([
            'balance' => 100000,
            'wallet_number' => '6281277700002',
        ]);

        $res = $this->postJson('/api/v1/transactions', [
            'sku_code' => 'INT-DIGI-10',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
        ]);
        $res->assertStatus(422);
        $this->assertStringContainsString('maintenance', strtolower((string) $res->json('message').' '.json_encode($res->json('errors'))));

        Sanctum::actingAs($this->ops);
        $this->putJson('/api/v1/admin/operations/products/'.$this->digiProduct->id, [
            'status' => 'inactive',
        ])->assertOk();

        Sanctum::actingAs($this->user);
        $res2 = $this->postJson('/api/v1/transactions', [
            'sku_code' => 'INT-DIGI-10',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
        ]);
        $res2->assertStatus(422);
    }

    public function test_catalog_cache_bump_invalidates_search_key_after_ops_update(): void
    {
        $filters = ['per_page' => 100, 'keyword' => 'Integration'];
        $keyBefore = ProductCatalogCache::searchKey($filters);
        Sanctum::actingAs($this->ops);
        $this->putJson('/api/v1/admin/operations/products/'.$this->digiProduct->id, [
            'selling_price' => 14000,
            'status' => 'active',
        ])->assertOk();
        $keyAfter = ProductCatalogCache::searchKey($filters);
        $this->assertNotSame($keyBefore, $keyAfter);
    }
}
