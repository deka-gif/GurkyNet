<?php

namespace Tests\Feature\Admin;

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

class OperationsProductFilterTest extends TestCase
{
    use RefreshDatabase;

    protected User $ops;
    protected ProductProvider $digi;
    protected ProductProvider $vip;
    protected ProductCategory $pulsa;
    protected ProductCategory $game;
    protected Provider $telkomsel;
    protected Provider $mlBrand;
    protected Product $pulsaDigi;
    protected Product $pulsaVip;
    protected Product $gameVip;
    protected Product $inactivePulsa;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ops = User::create([
            'name' => 'Ops Filter',
            'email' => 'ops-filter@gurkypay.com',
            'phone_number' => '081299900001',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);
        $this->digi->update(['is_active' => true]);
        $this->vip->update(['is_active' => true]);

        $this->pulsa = ProductCategory::create([
            'name' => 'Pulsa',
            'slug' => 'pulsa',
            'icon' => 'phone',
            'is_active' => true,
        ]);
        $this->game = ProductCategory::create([
            'name' => 'Game',
            'slug' => 'game',
            'icon' => 'game',
            'is_active' => true,
        ]);

        $this->telkomsel = Provider::create(['name' => 'Telkomsel', 'logo' => 'tsel.png', 'is_active' => true]);
        $this->mlBrand = Provider::create(['name' => 'Mobile Legends', 'logo' => 'ml.png', 'is_active' => true]);

        $this->pulsaDigi = $this->makeProduct('TSEL10-DIGI', 'Telkomsel 10rb Digi', $this->pulsa, $this->telkomsel, $this->digi, 'active');
        $this->pulsaVip = $this->makeProduct('VIP-TSEL10', 'Telkomsel 10rb VIP', $this->pulsa, $this->telkomsel, $this->vip, 'active');
        $this->gameVip = $this->makeProduct('VIP-ML86', 'Mobile Legends 86 Diamonds', $this->game, $this->mlBrand, $this->vip, 'active');
        $this->inactivePulsa = $this->makeProduct('TSEL5-OFF', 'Telkomsel 5rb Off', $this->pulsa, $this->telkomsel, $this->digi, 'inactive');

        ProductCatalogCache::bump();
    }

    protected function makeProduct(
        string $sku,
        string $name,
        ProductCategory $category,
        Provider $brand,
        ProductProvider $pp,
        string $opsStatus
    ): Product {
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $pp->id,
            'sku_code' => $sku,
            'name' => $name,
            'base_price' => 10000,
            'sell_price' => 11500,
            'admin_fee' => 0,
            'status' => $opsStatus !== 'inactive',
            'ops_status' => $opsStatus,
        ]);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $pp->id,
            'provider_sku' => $sku,
            'base_price' => 10000,
            'is_active' => true,
        ]);

        return $product;
    }

    public function test_category_filter_returns_only_pulsa(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson('/api/v1/admin/operations/products?category=pulsa&per_page=50');
        $res->assertOk();

        $codes = collect($res->json('data'))->pluck('code')->all();
        $this->assertContains('TSEL10-DIGI', $codes);
        $this->assertContains('VIP-TSEL10', $codes);
        $this->assertNotContains('VIP-ML86', $codes);
        $this->assertSame(3, $res->json('meta.pagination.total'));
    }

    public function test_provider_filter_combines_with_category(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson('/api/v1/admin/operations/products?category=pulsa&product_provider_id='.$this->digi->id.'&per_page=50');
        $res->assertOk();

        $codes = collect($res->json('data'))->pluck('code')->all();
        $this->assertContains('TSEL10-DIGI', $codes);
        $this->assertContains('TSEL5-OFF', $codes);
        $this->assertNotContains('VIP-TSEL10', $codes);
        $this->assertNotContains('VIP-ML86', $codes);
    }

    public function test_status_filter_active_inactive_maintenance(): void
    {
        Sanctum::actingAs($this->ops);

        $this->pulsaVip->update(['ops_status' => 'maintenance', 'status' => true]);

        $active = $this->getJson('/api/v1/admin/operations/products?status=Active&per_page=50');
        $active->assertOk();
        $activeCodes = collect($active->json('data'))->pluck('code')->all();
        $this->assertContains('TSEL10-DIGI', $activeCodes);
        $this->assertNotContains('TSEL5-OFF', $activeCodes);
        $this->assertNotContains('VIP-TSEL10', $activeCodes);

        $inactive = $this->getJson('/api/v1/admin/operations/products?status=Inactive&per_page=50');
        $inactive->assertOk();
        $this->assertContains('TSEL5-OFF', collect($inactive->json('data'))->pluck('code')->all());

        $maint = $this->getJson('/api/v1/admin/operations/products?status=Maintenance&per_page=50');
        $maint->assertOk();
        $this->assertContains('VIP-TSEL10', collect($maint->json('data'))->pluck('code')->all());
    }

    public function test_search_matches_name_sku_operator_provider(): void
    {
        Sanctum::actingAs($this->ops);

        $byName = $this->getJson('/api/v1/admin/operations/products?search=Mobile%20Legends&per_page=50');
        $byName->assertOk();
        $this->assertContains('VIP-ML86', collect($byName->json('data'))->pluck('code')->all());

        $bySku = $this->getJson('/api/v1/admin/operations/products?search=VIP-TSEL&per_page=50');
        $bySku->assertOk();
        $this->assertContains('VIP-TSEL10', collect($bySku->json('data'))->pluck('code')->all());

        $byOperator = $this->getJson('/api/v1/admin/operations/products?search=Telkomsel&per_page=50');
        $byOperator->assertOk();
        $codes = collect($byOperator->json('data'))->pluck('code')->all();
        $this->assertContains('TSEL10-DIGI', $codes);
        $this->assertNotContains('VIP-ML86', $codes);
    }

    public function test_combined_filters_and_pagination_total(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson(
            '/api/v1/admin/operations/products?category=pulsa&product_provider_id='.$this->digi->id.'&status=active&search=Telkomsel&per_page=25&page=1&sort=newest'
        );
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();
        $this->assertSame(['TSEL10-DIGI'], $codes);
        $this->assertSame(1, $res->json('meta.pagination.total'));
        $this->assertSame(1, $res->json('meta.pagination.currentPage'));
    }

    public function test_ops_inactive_hides_product_from_user_catalog(): void
    {
        Sanctum::actingAs($this->ops);

        $this->putJson('/api/v1/admin/operations/products/'.$this->pulsaDigi->id, [
            'status' => 'inactive',
        ])->assertOk();

        ProductCatalogCache::bump();

        $catalog = $this->getJson('/api/v1/products?per_page=100');
        $catalog->assertOk();
        $codes = collect($catalog->json('data'))->pluck('code')->all();
        $this->assertNotContains('TSEL10-DIGI', $codes);
    }

    public function test_ops_maintenance_keeps_catalog_visible_but_not_purchasable(): void
    {
        Sanctum::actingAs($this->ops);

        $this->putJson('/api/v1/admin/operations/products/'.$this->pulsaDigi->id, [
            'status' => 'maintenance',
        ])->assertOk();

        ProductCatalogCache::bump();

        $catalog = $this->getJson('/api/v1/products?per_page=100');
        $catalog->assertOk();
        $row = collect($catalog->json('data'))->firstWhere('code', 'TSEL10-DIGI');
        $this->assertNotNull($row);
        $this->assertSame('maintenance', $row['availabilityStatus']);
        $this->assertFalse($row['isPurchasable']);
        $this->assertSame('maintenance', $row['status']);
    }

    public function test_ops_price_update_reflects_on_user_catalog(): void
    {
        Sanctum::actingAs($this->ops);

        $this->putJson('/api/v1/admin/operations/products/'.$this->pulsaDigi->id, [
            'selling_price' => 12999,
            'status' => 'active',
        ])->assertOk();

        ProductCatalogCache::bump();

        $catalog = $this->getJson('/api/v1/products?per_page=100');
        $catalog->assertOk();
        $row = collect($catalog->json('data'))->firstWhere('code', 'TSEL10-DIGI');
        $this->assertNotNull($row);
        $this->assertEquals(12999.0, (float) $row['price']);
    }
}
