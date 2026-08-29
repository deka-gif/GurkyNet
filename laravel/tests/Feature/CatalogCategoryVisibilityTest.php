<?php

namespace Tests\Feature;

use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\User;
use App\Enums\UserRole;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CatalogCategoryVisibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function seedGameCategoryWithProvider(string $providerName, string $skuCode): array
    {
        ProductProvider::digiflazz()?->update(['is_active' => true, 'api_status' => 'online']);

        $category = ProductCategory::firstOrCreate(
            ['slug' => 'game'],
            ['name' => 'Game', 'icon' => 'gamepad']
        );

        $provider = Provider::create([
            'name' => $providerName,
            'logo' => null,
            'is_active' => true,
        ]);

        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => $skuCode,
            'name' => "{$providerName} Test Product",
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
            'provider_sku' => strtolower($skuCode),
            'base_price' => 20000,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        return [$category, $provider, $product, $digi];
    }

    public function test_game_category_lists_product_with_active_control_center_sku(): void
    {
        [, , $product] = $this->seedGameCategoryWithProvider('Mobile Legends', 'MLBB-TEST-86');

        $response = $this->getJson('/api/v1/products?category=game&per_page=100');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonFragment(['code' => 'MLBB-TEST-86']);

        $this->assertGreaterThanOrEqual(1, (int) $response->json('pagination.total'));
    }

    public function test_category_provider_summary_groups_by_brand_with_correct_count(): void
    {
        [, $provider, $firstProduct] = $this->seedGameCategoryWithProvider('Mobile Legends', 'MLBB-SUM-1');

        $second = Product::create([
            'product_category_id' => $firstProduct->product_category_id,
            'provider_id' => $provider->id,
            'sku_code' => 'MLBB-SUM-2',
            'name' => 'Mobile Legends 172 Diamond',
            'base_price' => 40000,
            'sell_price' => 41000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        $digi = ProductProvider::digiflazz();
        ProductProviderSku::create([
            'product_id' => Product::where('sku_code', 'MLBB-SUM-2')->value('id'),
            'product_provider_id' => $digi->id,
            'provider_sku' => 'mlbbsum2',
            'base_price' => 40000,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/products/providers?category=game');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $rows = collect($response->json('data'));
        $ml = $rows->firstWhere('name', 'Mobile Legends');
        $this->assertNotNull($ml);
        $this->assertSame(2, (int) $ml['count']);
        $this->assertSame((int) $provider->id, (int) $ml['providerId']);
    }

    public function test_provider_id_filter_does_not_match_similar_provider_names(): void
    {
        [, $pubgProvider] = $this->seedGameCategoryWithProvider('PUBG', 'PUBG-TEST-1');
        [, $pubgMobileProvider, $pubgMobileProduct] = $this->seedGameCategoryWithProvider('PUBG Mobile', 'PUBGM-TEST-1');

        $response = $this->getJson('/api/v1/products?category=game&provider_id='.$pubgProvider->id.'&per_page=100');

        $response->assertOk()->assertJsonPath('success', true);

        $codes = collect($response->json('data'))->pluck('code')->all();
        $this->assertContains('PUBG-TEST-1', $codes);
        $this->assertNotContains('PUBGM-TEST-1', $codes);
        $this->assertNotSame((int) $pubgProvider->id, (int) $pubgMobileProduct->provider_id);
    }

    public function test_listing_provider_fulfillment_cache_does_not_leak_between_requests(): void
    {
        [, , , $digi] = $this->seedGameCategoryWithProvider('Free Fire', 'FF-CACHE-1');

        ProductResource::resetListingCache();

        $first = $this->getJson('/api/v1/products?category=game&per_page=100');
        $first->assertOk();
        $this->assertSame(
            'tersedia',
            collect($first->json('data'))->firstWhere('code', 'FF-CACHE-1')['status'] ?? null
        );

        $digi->update(['is_active' => false]);
        ProductResource::resetListingCache();
        Cache::forget(ProductCatalogCache::searchKey(['category' => 'game', 'per_page' => 100, 'page' => 1]));

        $second = $this->getJson('/api/v1/products?category=game&per_page=100');
        $second->assertOk();

        $this->assertSame(
            'gangguan',
            collect($second->json('data'))->firstWhere('code', 'FF-CACHE-1')['status'] ?? null
        );
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

        Product::create([
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
            'product_id' => Product::where('sku_code', 'VIP-CHINA100')->value('id'),
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

    public function test_listing_then_show_product_returns_full_precision_status(): void
    {
        $this->seedGameCategoryWithProvider('Mobile Legends', 'MLBB-EXIT-A');
        $this->seedGameCategoryWithProvider('Free Fire', 'FF-EXIT-B');

        $baselineA = $this->getJson('/api/v1/products/MLBB-EXIT-A');
        $baselineA->assertOk();

        $this->getJson('/api/v1/products?category=game&per_page=100')->assertOk();
        $this->assertTrue(ProductResource::isListingMode(), 'listing request must enable listing mode');

        $afterListingA = $this->getJson('/api/v1/products/MLBB-EXIT-A');
        $afterListingA->assertOk();

        $this->assertFalse(
            ProductResource::isListingMode(),
            'findBySku() must call exitListingMode() after showProduct'
        );

        $this->assertSame($baselineA->json('data.status'), $afterListingA->json('data.status'));
        $this->assertSame(
            $baselineA->json('data.availabilityStatus'),
            $afterListingA->json('data.availabilityStatus')
        );
    }

    public function test_listing_then_operations_products_returns_full_precision_status(): void
    {
        $this->seedGameCategoryWithProvider('Mobile Legends', 'MLBB-OPS-EXIT');

        $ops = User::create([
            'name' => 'Ops Listing Exit',
            'email' => 'ops-listing-exit@gurkypay.com',
            'phone_number' => '081299900099',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->getJson('/api/v1/products?category=game&per_page=100')->assertOk();
        $this->assertTrue(ProductResource::isListingMode(), 'listing request must enable listing mode');

        $showAfterListing = $this->getJson('/api/v1/products/MLBB-OPS-EXIT');
        $showAfterListing->assertOk();

        $this->assertFalse(
            ProductResource::isListingMode(),
            'findBySku() must call exitListingMode() after showProduct'
        );

        Sanctum::actingAs($ops);

        $opsResponse = $this->getJson('/api/v1/admin/operations/products?category=game&per_page=100');
        $opsResponse->assertOk();

        $opsRow = collect($opsResponse->json('data'))->firstWhere('code', 'MLBB-OPS-EXIT');
        $this->assertNotNull($opsRow);

        $this->assertSame($showAfterListing->json('data.status'), $opsRow['status'] ?? null);
        $this->assertSame(
            $showAfterListing->json('data.availabilityStatus'),
            $opsRow['availabilityStatus'] ?? null
        );
    }
}
