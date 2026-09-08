<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Customer-facing GET /products — only PURCHASABLE products (dead-end free).
 */
class CustomerProductCatalogFilterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        ProductCatalogCache::bump();
        Cache::flush();
    }

    protected function digiOnline(): ProductProvider
    {
        $digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $digi->update(['is_active' => true, 'api_status' => 'online']);

        return $digi;
    }

    protected function seedProduct(
        string $categorySlug,
        string $categoryName,
        string $brand,
        string $sku,
        ProductProvider $pp,
        array $extra = []
    ): Product {
        $skuActive = array_key_exists('sku_active', $extra) ? (bool) $extra['sku_active'] : true;
        unset($extra['sku_active']);

        $category = ProductCategory::firstOrCreate(
            ['slug' => $categorySlug],
            ['name' => $categoryName, 'icon' => 'x']
        );
        $provider = Provider::firstOrCreate(
            ['name' => $brand],
            ['logo' => null, 'is_active' => true]
        );

        $product = Product::create(array_merge([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'product_provider_id' => $pp->id,
            'sku_code' => $sku,
            'name' => "{$brand} {$sku}",
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ], $extra));

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $pp->id,
            'provider_sku' => $sku,
            'provider_name' => $product->name,
            'base_price' => 10000,
            'provider_price' => 10000,
            'provider_status' => 'available',
            'is_active' => $skuActive,
        ]);

        return $product;
    }

    protected function codesInCategory(string $category, array $query = []): array
    {
        ProductCatalogCache::bump();
        Cache::flush();
        $q = http_build_query(array_merge(['category' => $category, 'per_page' => 100], $query));
        $response = $this->getJson('/api/v1/products?'.$q);
        $response->assertOk();

        return collect($response->json('data'))->pluck('code')->all();
    }

    public function test_a_purchasable_product_appears(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('game', 'Game', 'Free Fire', 'ff50', $digi);

        $this->assertContains('ff50', $this->codesInCategory('game'));
    }

    public function test_b_unknown_schema_does_not_appear(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('game', 'Game', 'Mystery Unmapped Game', 'myst-unk-1', $digi);

        $this->assertNotContains('myst-unk-1', $this->codesInCategory('game'));
        $this->assertSame(1, Product::query()->where('sku_code', 'myst-unk-1')->count());
    }

    public function test_c_needs_review_langganan_does_not_appear(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('langganan-digital', 'Langganan Digital', 'K-Vision Mystery', 'kvision30d', $digi);

        $this->assertNotContains('kvision30d', $this->codesInCategory('langganan-digital'));
        $this->assertSame(1, Product::query()->where('sku_code', 'kvision30d')->count());
    }

    public function test_d_not_purchasable_non_purchase_sku_does_not_appear(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('game', 'Game', 'Mobile Legends', 'pre33639299', $digi);

        $this->assertNotContains('pre33639299', $this->codesInCategory('game'));
    }

    public function test_e_inactive_product_does_not_appear(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('game', 'Game', 'Free Fire', 'ff140', $digi, ['ops_status' => 'inactive']);

        $this->assertNotContains('ff140', $this->codesInCategory('game'));
    }

    public function test_f_inactive_provider_offer_does_not_appear(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('game', 'Game', 'Free Fire', 'ff355', $digi, ['sku_active' => false]);

        // Control Center gate hides before lifecycle when no active SKU mapping.
        $this->assertNotContains('ff355', $this->codesInCategory('game'));
    }

    public function test_g_non_canonical_raw_category_products_do_not_appear_as_purchasable_catalog(): void
    {
        $digi = $this->digiOnline();
        // Raw Digi-style category slug not in CF capability registry.
        $this->seedProduct('games-feature', 'Games Raw', 'Some Brand', 'raw-game-1', $digi);

        $codes = $this->codesInCategory('game-feature');
        $this->assertNotContains('raw-game-1', $codes);
    }

    public function test_h_mobile_surface_hides_web_only_postpaid(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('pdam', 'PDAM', 'PDAM Jakarta', 'pdam-jkt-1', $digi);
        $this->seedProduct('pulsa', 'Pulsa', 'Telkomsel', 'pulsa10', $digi);

        $mobile = $this->codesInCategory('pdam', ['surface' => 'mobile']);
        $web = $this->codesInCategory('pdam', ['surface' => 'web']);
        $pulsaMobile = $this->codesInCategory('pulsa', ['surface' => 'mobile']);

        $this->assertContains('pdam-jkt-1', $mobile);
        $this->assertContains('pdam-jkt-1', $web);
        $this->assertContains('pulsa10', $pulsaMobile);
    }

    public function test_i_game_brand_all_non_purchasable_hidden_from_providers(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('game', 'Game', 'PUBG Mobile', 'pubg-no-schema', $digi);

        $response = $this->getJson('/api/v1/products/providers?category=game');
        $response->assertOk();
        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertNotContains('PUBG Mobile', $names);
    }

    public function test_j_game_brand_with_purchasable_sku_lists_only_purchasable(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('game', 'Game', 'Mobile Legends', 'pre33639301', $digi);
        $this->seedProduct('game', 'Game', 'Mobile Legends', 'mlweek', $digi);
        $this->seedProduct('game', 'Game', 'Mobile Legends', 'pre33639299', $digi);

        $codes = $this->codesInCategory('game');
        $this->assertContains('pre33639301', $codes);
        $this->assertNotContains('mlweek', $codes);
        $this->assertNotContains('pre33639299', $codes);

        $providers = $this->getJson('/api/v1/products/providers?category=game');
        $ml = collect($providers->json('data'))->firstWhere('name', 'Mobile Legends');
        $this->assertNotNull($ml);
        $this->assertSame(1, (int) $ml['count']);
    }

    public function test_k_existing_working_pulsa_unchanged(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('pulsa', 'Pulsa', 'Telkomsel', 'tself10', $digi);

        $response = $this->getJson('/api/v1/products?category=pulsa&per_page=100');
        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('code', 'tself10');
        $this->assertNotNull($row);
        $this->assertSame('tersedia', $row['status']);
        $this->assertTrue($row['isPurchasable']);
    }

    public function test_show_product_returns_404_for_non_purchasable(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('game', 'Game', 'Mystery Unmapped Game', 'myst-show-1', $digi);

        $this->getJson('/api/v1/products/myst-show-1')->assertNotFound();
        $this->assertSame(1, Product::query()->where('sku_code', 'myst-show-1')->count());
    }

    public function test_show_product_returns_purchasable(): void
    {
        $digi = $this->digiOnline();
        $this->seedProduct('game', 'Game', 'Free Fire', 'ff12', $digi);

        $this->getJson('/api/v1/products/ff12')
            ->assertOk()
            ->assertJsonPath('data.code', 'ff12')
            ->assertJsonPath('data.isPurchasable', true);
    }
}
