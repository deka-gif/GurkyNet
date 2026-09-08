<?php

namespace Tests\Feature;

use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\Product;
use App\Services\PricingService;
use App\Services\AvailabilityService;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class ProductModuleTest extends TestCase
{
    use RefreshDatabase;

    protected ProductCategory $category;
    protected Provider $provider;
    protected Product $product;
    protected ProductProvider $digi;

    protected function setUp(): void
    {
        parent::setUp();

        ProductCatalogCache::bump();
        Cache::flush();

        $this->digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $this->digi->update(['is_active' => true, 'api_status' => 'online']);

        // Canonical customer slug (capability registry key) — not legacy pulsa-seluler.
        $this->category = ProductCategory::create([
            'name' => 'Pulsa',
            'slug' => 'pulsa',
            'icon' => 'phone',
        ]);

        $this->provider = Provider::create([
            'name' => 'Telkomsel',
            'logo' => 'telkomsel.png',
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->provider->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'TSEL10K',
            'name' => 'Telkomsel 10K',
            'base_price' => 10000.00,
            'sell_price' => 11500.00,
            'admin_fee' => 0.00,
            'status' => true,
            'ops_status' => 'active',
        ]);

        ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'TSEL10K',
            'provider_name' => 'Telkomsel 10K',
            'base_price' => 10000,
            'provider_price' => 10000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);
    }

    /**
     * Test List Product.
     */
    public function test_list_products(): void
    {
        $response = $this->getJson('/api/v1/products');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id', 'code', 'name', 'basePrice', 'margin', 'adminFee', 'price', 'status', 'availabilityStatus'
                    ]
                ],
                'meta'
            ]);
    }

    /**
     * Test Search Product.
     */
    public function test_search_product_by_keyword(): void
    {
        $response = $this->getJson('/api/v1/products?keyword=TSEL');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals('TSEL10K', $response->json('data.0.code'));
    }

    /**
     * Test Category Filter.
     */
    public function test_filter_by_category(): void
    {
        // Filter by slug
        $response = $this->getJson('/api/v1/products?category=pulsa');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));

        // Filter by other slug
        $responseEmpty = $this->getJson('/api/v1/products?category=non-existent');
        $responseEmpty->assertStatus(200);
        $this->assertCount(0, $responseEmpty->json('data'));
    }

    /**
     * Voucher Internet must be strictly Kuota/Internet — a product legitimately
     * classified as a different category (e.g. pulsa) must never leak into this
     * filter, even if that product's name happens to contain "data"/"voucher".
     */
    public function test_filter_by_category_excludes_other_categories_from_voucher_internet(): void
    {
        $voucherInternetCategory = ProductCategory::create([
            'name' => 'Voucher Internet',
            'slug' => 'voucher-internet',
            'icon' => 'wifi',
        ]);

        $vi = Product::create([
            'product_category_id' => $voucherInternetCategory->id,
            'provider_id' => $this->provider->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'XLVI3GB',
            'name' => 'Voucher Internet XL 3GB',
            'base_price' => 15000.00,
            'sell_price' => 15500.00,
            'admin_fee' => 0.00,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $vi->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'XLVI3GB',
            'provider_name' => 'Voucher Internet XL 3GB',
            'base_price' => 15000,
            'provider_price' => 15000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        // Same-category (pulsa) product whose name coincidentally contains
        // "data"/"voucher" wording — must stay out of the voucher-internet filter.
        $bonus = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->provider->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'TSEL20K-BONUS',
            'name' => 'Telkomsel 20K Bonus Voucher Data',
            'base_price' => 20000.00,
            'sell_price' => 21000.00,
            'admin_fee' => 0.00,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $bonus->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'TSEL20K-BONUS',
            'provider_name' => $bonus->name,
            'base_price' => 20000,
            'provider_price' => 20000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/products?category=voucher-internet');
        $response->assertStatus(200);

        $data = collect($response->json('data'));
        $this->assertCount(1, $data);
        $this->assertSame('XLVI3GB', $data->first()['code'] ?? null);
        $this->assertTrue($data->every(fn ($p) => ($p['category'] ?? null) === 'voucher-internet'));
    }

    /**
     * Test Provider Filter.
     */
    public function test_filter_by_provider(): void
    {
        $response = $this->getJson('/api/v1/products?provider=Telkomsel');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));

        $responseEmpty = $this->getJson('/api/v1/products?provider=XL');
        $responseEmpty->assertStatus(200);
        $this->assertCount(0, $responseEmpty->json('data'));
    }

    /**
     * Test Pricing Calculation.
     */
    public function test_pricing_calculation(): void
    {
        $pricingService = resolve(PricingService::class);
        $pricing = $pricingService->calculateForProduct($this->product);

        $this->assertEquals(10000.00, $pricing['base_price']);
        $this->assertEquals(1500.00, $pricing['margin']);
        $this->assertEquals(0.00, $pricing['admin_fee']);
        $this->assertEquals(11500.00, $pricing['sell_price']);
    }

    /**
     * Test Availability Status.
     */
    public function test_availability_status(): void
    {
        $availabilityService = resolve(AvailabilityService::class);
        $status = $availabilityService->getStatus($this->product);

        $this->assertEquals('active', $status);

        // Control Center SoT: ops_status inactive (not products.status alone).
        $this->product->ops_status = 'inactive';
        $this->product->save();
        $this->assertEquals('inactive', $availabilityService->getStatus($this->product));

        // test maintenance simulation
        $maintenanceProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->provider->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'TSEL-MAINTENANCE-10K',
            'name' => 'Tsel Maintenance 10K',
            'base_price' => 10000.00,
            'sell_price' => 11500.00,
            'admin_fee' => 0.00,
            'status' => true,
            'ops_status' => 'active',
        ]);
        $this->assertEquals('maintenance', $availabilityService->getStatus($maintenanceProduct));
    }

    /**
     * Test Cache Hit.
     */
    public function test_cache_hit(): void
    {
        Cache::flush();

        // Trigger cache creation by fetching categories
        $response1 = $this->getJson('/api/v1/categories');
        $response1->assertStatus(200);

        // Verify cache contains customer-facing categories list
        $this->assertTrue($this->cacheKeyExists(
            \App\Services\ProductProviders\ProductCatalogCache::categoriesKey(),
            ['categories', 'products', 'active_products']
        ));

        // Trigger cache creation for providers
        $response2 = $this->getJson('/api/v1/providers');
        $response2->assertStatus(200);
        $this->assertTrue($this->cacheKeyExists('providers_active_all', ['providers']));
    }

    /**
     * Test Cache Refresh.
     */
    public function test_cache_refresh(): void
    {
        Cache::flush();

        // 1. Warm cache
        $this->getJson('/api/v1/categories');
        $cfKey = \App\Services\ProductProviders\ProductCatalogCache::categoriesKey();
        $this->assertTrue($this->cacheKeyExists($cfKey, ['categories', 'products', 'active_products']));

        // 2. Clear / Refresh cache tags or keys explicitly to simulate updates
        try {
            Cache::tags(['categories'])->flush();
        } catch (\BadMethodCallException $e) {
            Cache::forget($cfKey);
            Cache::forget('product_categories_all');
        }

        $this->assertFalse($this->cacheKeyExists($cfKey, ['categories', 'products', 'active_products']));
    }

    private function cacheKeyExists(string $key, array $tags = []): bool
    {
        if ($tags !== []) {
            try {
                return Cache::tags($tags)->has($key);
            } catch (\BadMethodCallException) {
                // Driver without tag support stores under the plain key
            }
        }

        return Cache::has($key);
    }
}
