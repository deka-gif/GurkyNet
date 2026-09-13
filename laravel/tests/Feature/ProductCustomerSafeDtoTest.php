<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\HomepageFeaturedProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Customer-facing product DTOs must omit cost fields; ops ProductResource must keep them.
 */
class ProductCustomerSafeDtoTest extends TestCase
{
    use RefreshDatabase;

    protected ProductCategory $category;
    protected Provider $provider;
    protected ProductProvider $digi;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $this->digi->update(['is_active' => true, 'api_status' => 'online']);

        $this->category = ProductCategory::create([
            'name' => 'Pulsa',
            'slug' => 'pulsa',
            'icon' => 'phone',
        ]);

        $this->provider = Provider::create([
            'name' => 'Telkomsel',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->provider->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'SAFEDTO001',
            'name' => 'Safe DTO Pulsa 10rb',
            'base_price' => 1000,
            'sell_price' => 2500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'SAFEDTO001',
            'provider_name' => $this->product->name,
            'base_price' => 1000,
            'provider_price' => 1000,
            'provider_status' => 'available',
            'is_active' => true,
            'is_preferred' => true,
        ]);
    }

    protected function assertNoCostFields(?array $row): void
    {
        $this->assertIsArray($row);
        $this->assertArrayNotHasKey('basePrice', $row);
        $this->assertArrayNotHasKey('providerCost', $row);
        $this->assertArrayNotHasKey('margin', $row);
        $this->assertArrayHasKey('price', $row);
    }

    public function test_customer_detail_omits_cost_fields(): void
    {
        $response = $this->getJson('/api/v1/products/SAFEDTO001');
        $response->assertOk();
        $this->assertNoCostFields($response->json('data'));
        $this->assertArrayHasKey('notPurchasableReason', $response->json('data'));
    }

    public function test_catalog_search_products_omit_cost_fields(): void
    {
        $response = $this->getJson('/api/v1/catalog/search?q=SAFEDTO001');
        $response->assertOk();
        $products = $response->json('data.products') ?? [];
        $this->assertNotEmpty($products);
        foreach ($products as $row) {
            $this->assertNoCostFields($row);
        }
    }

    public function test_homepage_featured_and_preview_omit_cost_fields(): void
    {
        HomepageFeaturedProduct::create([
            'product_id' => $this->product->id,
            'display_order' => 1,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/public/homepage');
        $response->assertOk();

        $featured = $response->json('data.featuredProducts') ?? [];
        $this->assertNotEmpty($featured);
        foreach ($featured as $row) {
            $this->assertNoCostFields($row);
        }

        $buckets = $response->json('data.homepageCategories') ?? [];
        foreach ($buckets as $bucket) {
            if (! empty($bucket['previewProduct'])) {
                $this->assertNoCostFields($bucket['previewProduct']);
            }
            foreach ($bucket['products'] ?? [] as $row) {
                $this->assertNoCostFields($row);
            }
        }
    }

    public function test_operations_product_list_still_includes_cost_fields(): void
    {
        $ops = User::create([
            'name' => 'Ops Safe DTO',
            'email' => 'ops-safe-dto@gurkynet.test',
            'phone_number' => '081299990001',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Sanctum::actingAs($ops);

        $response = $this->getJson('/api/v1/admin/operations/products?search=SAFEDTO001');
        $response->assertOk();
        $rows = $response->json('data');
        $this->assertIsArray($rows);
        $this->assertNotEmpty($rows);
        $row = collect($rows)->first(fn ($r) => ($r['code'] ?? null) === 'SAFEDTO001') ?? $rows[0];
        $this->assertArrayHasKey('basePrice', $row);
        $this->assertArrayHasKey('margin', $row);
        $this->assertArrayHasKey('providerCost', $row);
    }
}
