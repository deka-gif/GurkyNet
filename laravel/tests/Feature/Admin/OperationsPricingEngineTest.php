<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\User;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationsPricingEngineTest extends TestCase
{
    use RefreshDatabase;

    protected User $ops;
    protected ProductProvider $digi;
    protected ProductProvider $vip;
    protected ProductCategory $pulsa;
    protected ProductCategory $data;
    protected ProductCategory $game;
    protected Provider $telkomsel;
    protected Provider $freeFire;
    protected Product $skuA;
    protected Product $skuB;
    protected Product $skuC;
    protected Product $skuGame;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ops = User::create([
            'name' => 'Ops Pricing',
            'email' => 'ops-pricing@gurkypay.com',
            'phone_number' => '081288800088',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        $this->pulsa = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'phone', 'is_active' => true]);
        $this->data = ProductCategory::create(['name' => 'Paket Data', 'slug' => 'data', 'icon' => 'wifi', 'is_active' => true]);
        $this->game = ProductCategory::create(['name' => 'Game', 'slug' => 'game', 'icon' => 'game', 'is_active' => true]);
        $this->telkomsel = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);
        $this->freeFire = Provider::create(['name' => 'Free Fire', 'logo' => 'ff.png', 'is_active' => true]);

        $this->skuA = Product::create([
            'product_category_id' => $this->pulsa->id,
            'provider_id' => $this->telkomsel->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'TSEL10',
            'name' => 'Telkomsel 10rb',
            'base_price' => 10000,
            'sell_price' => 11500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        $this->skuB = Product::create([
            'product_category_id' => $this->data->id,
            'provider_id' => $this->telkomsel->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'DATA-CB25',
            'name' => 'Internet Sakti Diamond 25GB',
            'base_price' => 20000,
            'sell_price' => 21500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        $this->skuC = Product::create([
            'product_category_id' => $this->pulsa->id,
            'provider_id' => $this->telkomsel->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'TSEL20',
            'name' => 'Telkomsel 20rb',
            'base_price' => 20000,
            'sell_price' => 22000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'maintenance',
        ]);

        $this->skuGame = Product::create([
            'product_category_id' => $this->game->id,
            'provider_id' => $this->freeFire->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'FF70',
            'name' => 'Free Fire 70 Diamond',
            'base_price' => 9000,
            'sell_price' => 10500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        Product::create([
            'product_category_id' => $this->game->id,
            'provider_id' => $this->freeFire->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'FF140',
            'name' => 'Free Fire 140 Diamond',
            'base_price' => 18000,
            'sell_price' => 20000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        ProductCatalogCache::bump();
    }

    public function test_pricing_game_shows_brands_not_skus(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson('/api/v1/admin/operations/pricing?category=game');
        $res->assertOk()
            ->assertJsonPath('data.level', 'brands');

        $nodes = collect($res->json('data.nodes'));
        $this->assertTrue($nodes->contains(fn ($n) => ($n['name'] ?? '') === 'Free Fire'));
        $this->assertSame([], $res->json('data.products'));
        $ff = $nodes->firstWhere('name', 'Free Fire');
        $this->assertSame(2, (int) $ff['skuCount']);
        $this->assertNotEmpty($ff['providers']);
    }

    public function test_pricing_brand_drilldown_lists_skus(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson('/api/v1/admin/operations/pricing?category=game&brand_id='.$this->freeFire->id);
        $res->assertOk()
            ->assertJsonPath('data.level', 'skus');

        $products = collect($res->json('data.products'));
        $this->assertCount(2, $products);
        $this->assertTrue($products->contains(fn ($p) => ($p['code'] ?? '') === 'FF70'));
    }

    public function test_pricing_pulsa_shows_operators(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson('/api/v1/admin/operations/pricing?category=pulsa&search=telkom');
        $res->assertOk()
            ->assertJsonPath('data.level', 'brands');

        $nodes = collect($res->json('data.nodes'));
        $this->assertTrue($nodes->contains(fn ($n) => str_contains(strtolower((string) ($n['name'] ?? '')), 'telkom')));
        $this->assertSame([], $res->json('data.products'));
    }

    public function test_pricing_data_operator_shows_groups_then_skus(): void
    {
        Sanctum::actingAs($this->ops);

        $groups = $this->getJson('/api/v1/admin/operations/pricing?category=data&brand_id='.$this->telkomsel->id);
        $groups->assertOk()
            ->assertJsonPath('data.level', 'groups');
        $this->assertNotEmpty($groups->json('data.nodes'));

        $groupKey = $groups->json('data.nodes.0.key');
        $skus = $this->getJson(
            '/api/v1/admin/operations/pricing?category=data&brand_id='.$this->telkomsel->id.'&data_group='.$groupKey
        );
        $skus->assertOk()
            ->assertJsonPath('data.level', 'skus');
        $this->assertGreaterThanOrEqual(1, count($skus->json('data.products')));
    }

    public function test_pricing_filters_provider_and_status_on_brands(): void
    {
        Sanctum::actingAs($this->ops);

        $byVip = $this->getJson('/api/v1/admin/operations/pricing?category=game&product_provider_id='.$this->vip->id);
        $byVip->assertOk();
        $ff = collect($byVip->json('data.nodes'))->firstWhere('name', 'Free Fire');
        $this->assertNotNull($ff);
        $this->assertSame(1, (int) $ff['skuCount']);

        $byMaint = $this->getJson('/api/v1/admin/operations/pricing?category=pulsa&status=maintenance');
        $byMaint->assertOk();
        $this->assertSame('brands', $byMaint->json('data.level'));
    }

    public function test_update_selling_price_writes_products_table(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->putJson('/api/v1/admin/operations/pricing/'.$this->skuA->id, [
            'sell_price' => 13000,
            'status' => 'active',
        ]);
        $res->assertOk();

        $this->assertDatabaseHas('products', [
            'id' => $this->skuA->id,
            'sell_price' => 13000,
            'base_price' => 10000,
        ]);

        $this->assertSame(3000.0, (float) $res->json('data.product.margin'));
    }

    public function test_update_margin_recalculates_selling_price(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->putJson('/api/v1/admin/operations/pricing', [
            'product_id' => $this->skuB->id,
            'margin' => 2000,
        ]);
        $res->assertOk();

        $this->skuB->refresh();
        $this->assertSame(22000.0, (float) $this->skuB->sell_price);
    }

    public function test_rejects_selling_price_below_base(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->putJson('/api/v1/admin/operations/pricing/'.$this->skuA->id, [
            'sell_price' => 5000,
        ]);
        $res->assertStatus(422);
    }

    public function test_sku_search_inside_brand(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson(
            '/api/v1/admin/operations/pricing?category=game&brand_id='.$this->freeFire->id.'&search=70'
        );
        $res->assertOk()->assertJsonPath('data.level', 'skus');
        $this->assertCount(1, $res->json('data.products'));
        $this->assertSame('FF70', $res->json('data.products.0.code'));
    }
}
