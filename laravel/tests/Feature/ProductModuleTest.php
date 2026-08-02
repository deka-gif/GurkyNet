<?php

namespace Tests\Feature;

use App\Models\ProductCategory;
use App\Models\Provider;
use App\Models\Product;
use App\Services\PricingService;
use App\Services\AvailabilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class ProductModuleTest extends TestCase
{
    use RefreshDatabase;

    protected ProductCategory $category;
    protected Provider $provider;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->category = ProductCategory::create([
            'name' => 'Pulsa Seluler',
            'slug' => 'pulsa-seluler',
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
            'sku_code' => 'TSEL10K',
            'name' => 'Telkomsel 10K',
            'base_price' => 10000.00,
            'sell_price' => 11500.00,
            'admin_fee' => 0.00,
            'status' => true,
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
                        'id', 'sku_code', 'name', 'base_price', 'margin', 'admin_fee', 'sell_price', 'status', 'availability_status'
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
        $this->assertEquals('TSEL10K', $response->json('data.0.sku_code'));
    }

    /**
     * Test Category Filter.
     */
    public function test_filter_by_category(): void
    {
        // Filter by slug
        $response = $this->getJson('/api/v1/products?category=pulsa-seluler');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));

        // Filter by other slug
        $responseEmpty = $this->getJson('/api/v1/products?category=non-existent');
        $responseEmpty->assertStatus(200);
        $this->assertCount(0, $responseEmpty->json('data'));
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

        // test inactive
        $this->product->status = false;
        $this->product->save();
        $this->assertEquals('inactive', $availabilityService->getStatus($this->product));

        // test maintenance simulation
        $maintenanceProduct = Product::create([
            'product_category_id' => $this->category->id,
            'sku_code' => 'TSEL-MAINTENANCE-10K',
            'name' => 'Tsel Maintenance 10K',
            'base_price' => 10000.00,
            'sell_price' => 11500.00,
            'admin_fee' => 0.00,
            'status' => true,
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

        // Verify cache contains categories list
        $this->assertTrue(Cache::has('product_categories_all'));

        // Trigger cache creation for providers
        $response2 = $this->getJson('/api/v1/providers');
        $response2->assertStatus(200);
        $this->assertTrue(Cache::has('providers_active_all'));
    }

    /**
     * Test Cache Refresh.
     */
    public function test_cache_refresh(): void
    {
        Cache::flush();

        // 1. Warm cache
        $this->getJson('/api/v1/categories');
        $this->assertTrue(Cache::has('product_categories_all'));

        // 2. Clear / Refresh cache tags or keys explicitly to simulate updates
        try {
            Cache::tags(['categories'])->flush();
        } catch (\BadMethodCallException $e) {
            Cache::forget('product_categories_all');
        }

        $this->assertFalse(Cache::has('product_categories_all'));
    }
}
