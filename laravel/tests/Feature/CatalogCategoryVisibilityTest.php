<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogCategoryVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_game_category_lists_product_with_active_control_center_sku(): void
    {
        ProductProvider::digiflazz()?->update(['is_active' => true, 'api_status' => 'online']);

        $category = ProductCategory::create([
            'name' => 'Game',
            'slug' => 'game',
            'icon' => 'gamepad',
        ]);

        $provider = Provider::create([
            'name' => 'Mobile Legends',
            'logo' => null,
            'is_active' => true,
        ]);

        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'MLBB-TEST-86',
            'name' => 'Mobile Legends 86 Diamond',
            'base_price' => 20000,
            'sell_price' => 21000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        $digi = ProductProvider::digiflazz();
        $this->assertNotNull($digi);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'mlbb86',
            'base_price' => 20000,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/products?category=game&per_page=100');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonFragment(['code' => 'MLBB-TEST-86']);

        $this->assertGreaterThanOrEqual(1, (int) $response->json('pagination.total'));
    }

    public function test_international_category_returns_empty_without_server_error_when_no_visible_skus(): void
    {
        ProductProvider::vip()?->update(['is_active' => true]);

        $category = ProductCategory::create([
            'name' => 'International Top Up',
            'slug' => 'international',
            'icon' => 'globe',
        ]);

        $provider = Provider::create([
            'name' => 'China Mobile',
            'logo' => null,
            'is_active' => true,
        ]);

        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'product_provider_id' => ProductProvider::vip()?->id,
            'sku_code' => 'VIP-CHINA100',
            'name' => 'China 100',
            'base_price' => 100000,
            'sell_price' => 101000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'inactive',
        ]);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => ProductProvider::vip()->id,
            'provider_sku' => 'VIP-CHINA100',
            'base_price' => 100000,
            'is_preferred' => true,
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/v1/products?category=international&per_page=100');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('pagination.total', 0);
    }
}
