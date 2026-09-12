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
 * Customer-facing Game brand visibility: only brands with ≥1 PURCHASABLE SKU.
 */
class GameBrandVisibilityTest extends TestCase
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

    protected function seedGameSku(
        string $brand,
        string $sku,
        ProductProvider $digi,
        bool $activeSku = true,
        ?string $opsStatus = 'active'
    ): Product {
        $category = ProductCategory::firstOrCreate(
            ['slug' => 'game'],
            ['name' => 'Game', 'icon' => 'gamepad']
        );
        $provider = Provider::firstOrCreate(
            ['name' => $brand],
            ['logo' => null, 'is_active' => true]
        );

        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'product_provider_id' => $digi->id,
            'sku_code' => $sku,
            'name' => "{$brand} {$sku}",
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => $opsStatus,
        ]);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => $sku,
            'provider_name' => $product->name,
            'base_price' => 10000,
            'provider_price' => 10000,
            'provider_status' => 'available',
            'is_active' => $activeSku,
        ]);

        return $product;
    }

    public function test_brand_with_zero_purchasable_skus_is_hidden(): void
    {
        $digi = $this->digiOnline();
        // No Game Profile / Digi evidence → UNKNOWN / not purchasable
        $this->seedGameSku('Mystery Unmapped Game', 'myst-unk-brand', $digi);

        $response = $this->getJson('/api/v1/products/providers?category=game');
        $response->assertOk();

        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertNotContains('Mystery Unmapped Game', $names);
    }

    public function test_brand_with_at_least_one_purchasable_sku_is_visible(): void
    {
        $digi = $this->digiOnline();
        $this->seedGameSku('Free Fire', 'ff50', $digi);
        $this->seedGameSku('Free Fire', 'ff-unknown-extra', $digi); // still purchasable via FF profile

        $response = $this->getJson('/api/v1/products/providers?category=game');
        $response->assertOk();

        $ff = collect($response->json('data'))->firstWhere('name', 'Free Fire');
        $this->assertNotNull($ff);
        $this->assertGreaterThanOrEqual(1, (int) $ff['count']);
    }

    public function test_unknown_only_brand_hidden_while_ml_visible(): void
    {
        $digi = $this->digiOnline();
        // Brand without game_profiles / Digi desc evidence must stay hidden.
        $this->seedGameSku('Totally Unknown Galaxy Game', 'unk-galaxy-no-evidence', $digi);
        $this->seedGameSku('Mobile Legends', 'pre33639301', $digi);

        $response = $this->getJson('/api/v1/products/providers?category=game');
        $response->assertOk();

        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertContains('Mobile Legends', $names);
        $this->assertNotContains('Totally Unknown Galaxy Game', $names);
    }

    public function test_stage4_pubg_profile_makes_brand_visible(): void
    {
        $digi = $this->digiOnline();
        $this->seedGameSku('PUBG Mobile', 'pre33817255', $digi);

        $response = $this->getJson('/api/v1/products/providers?category=game');
        $response->assertOk();

        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertContains('PUBG Mobile', $names);
    }

    public function test_digi_voucher_pin_sku_under_pubg_stays_hidden_from_count(): void
    {
        $digi = $this->digiOnline();
        // Only Digi Voucher-category PIN SKU — non_purchase; brand must stay hidden.
        $this->seedGameSku('PUBG Mobile', 'pre33926660', $digi);

        $response = $this->getJson('/api/v1/products/providers?category=game');
        $response->assertOk();

        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertNotContains('PUBG Mobile', $names);
    }

    public function test_inactive_only_brand_is_hidden(): void
    {
        $digi = $this->digiOnline();
        $this->seedGameSku('Free Fire', 'ff140', $digi, activeSku: true, opsStatus: 'inactive');

        $response = $this->getJson('/api/v1/products/providers?category=game');
        $response->assertOk();

        $names = collect($response->json('data'))->pluck('name')->all();
        $this->assertNotContains('Free Fire', $names);
    }

    public function test_non_purchase_only_brand_not_listed_as_buyable_count(): void
    {
        $digi = $this->digiOnline();
        // Cek Username utility only under Mobile Legends — not purchasable
        $this->seedGameSku('Mobile Legends', 'pre33639299', $digi);

        $response = $this->getJson('/api/v1/products/providers?category=game');
        $response->assertOk();

        $ml = collect($response->json('data'))->firstWhere('name', 'Mobile Legends');
        $this->assertNull($ml, 'Brand with only NON_PURCHASE SKUs must be hidden');
    }

    public function test_mixed_brand_counts_only_purchasable_skus(): void
    {
        $digi = $this->digiOnline();
        $this->seedGameSku('Mobile Legends', 'pre33639301', $digi);
        $this->seedGameSku('Mobile Legends', 'pre33639299', $digi); // non-purchase
        $this->seedGameSku('Mobile Legends', 'mlweek', $digi); // unknown override

        ProductCatalogCache::bump();
        Cache::flush();

        $response = $this->getJson('/api/v1/products/providers?category=game');
        $response->assertOk();

        $ml = collect($response->json('data'))->firstWhere('name', 'Mobile Legends');
        $this->assertNotNull($ml);
        $this->assertSame(1, (int) $ml['count']);
    }
}
