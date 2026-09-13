<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Support\Catalog\CatalogProductPaging;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sparse list DTO + pagination boundary policy (threshold 30 / page 20).
 */
class ProductListSparseAndPagingTest extends TestCase
{
    use RefreshDatabase;

    protected ProductCategory $category;
    protected Provider $provider;
    protected ProductProvider $digi;

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
            'name' => 'Game',
            'slug' => 'game',
            'icon' => 'game',
        ]);

        $this->provider = Provider::create([
            'name' => 'Free Fire Test',
            'logo' => null,
            'is_active' => true,
        ]);
    }

    protected function seedSkus(int $count): void
    {
        for ($i = 1; $i <= $count; $i++) {
            $sku = sprintf('FFTEST%04d', $i);
            $product = Product::create([
                'product_category_id' => $this->category->id,
                'provider_id' => $this->provider->id,
                'product_provider_id' => $this->digi->id,
                'sku_code' => $sku,
                'name' => "FF Diamond {$i}",
                'base_price' => 1000 + $i,
                'sell_price' => 1500 + $i,
                'admin_fee' => 0,
                'status' => true,
                'ops_status' => 'active',
            ]);
            ProductProviderSku::create([
                'product_id' => $product->id,
                'product_provider_id' => $this->digi->id,
                'provider_sku' => $sku,
                'provider_name' => $product->name,
                'base_price' => 1000 + $i,
                'provider_price' => 1000 + $i,
                'provider_status' => 'available',
                'is_active' => true,
                'is_preferred' => true,
            ]);
        }
    }

    public function test_list_omits_sensitive_cost_fields(): void
    {
        $this->seedSkus(1);

        $response = $this->getJson('/api/v1/products?category=game&provider_id='.$this->provider->id.'&per_page=20');
        $response->assertOk();
        $row = $response->json('data.0');
        $this->assertIsArray($row);
        $this->assertArrayHasKey('price', $row);
        $this->assertArrayHasKey('isPurchasable', $row);
        $this->assertArrayHasKey('transactionCapability', $row);
        $this->assertArrayNotHasKey('basePrice', $row);
        $this->assertArrayNotHasKey('providerCost', $row);
        $this->assertArrayNotHasKey('margin', $row);
        $this->assertArrayNotHasKey('categoryMappingSource', $row);
        $this->assertArrayNotHasKey('productProviderDetails', $row);
    }

    public function test_detail_endpoint_omits_sensitive_cost_fields(): void
    {
        $this->seedSkus(1);

        $response = $this->getJson('/api/v1/products/FFTEST0001');
        $response->assertOk();
        $row = $response->json('data');
        $this->assertSame('FFTEST0001', $row['code']);
        $this->assertArrayHasKey('price', $row);
        $this->assertArrayHasKey('adminFee', $row);
        $this->assertArrayHasKey('isPurchasable', $row);
        $this->assertArrayHasKey('transactionCapability', $row);
        $this->assertArrayHasKey('notPurchasableReason', $row);
        $this->assertArrayNotHasKey('basePrice', $row);
        $this->assertArrayNotHasKey('providerCost', $row);
        $this->assertArrayNotHasKey('margin', $row);
        $this->assertArrayNotHasKey('productProviderDetails', $row);
        $this->assertArrayNotHasKey('categoryMappingSource', $row);
    }

    public function test_paging_policy_boundary_29_30_31(): void
    {
        $this->assertFalse(CatalogProductPaging::shouldPaginate(29));
        $this->assertFalse(CatalogProductPaging::shouldPaginate(30));
        $this->assertTrue(CatalogProductPaging::shouldPaginate(31));
        $this->assertSame(30, CatalogProductPaging::THRESHOLD);
        $this->assertSame(20, CatalogProductPaging::PAGE_SIZE);
    }

    public function test_page_size_20_returns_subset_and_total(): void
    {
        $this->seedSkus(35);

        $page1 = $this->getJson(
            '/api/v1/products?category=game&provider_id='.$this->provider->id.'&per_page=20&page=1&surface=mobile'
        );
        $page1->assertOk();
        $this->assertCount(20, $page1->json('data'));
        $this->assertSame(35, (int) $page1->json('pagination.total'));
        $this->assertSame(2, (int) $page1->json('pagination.lastPage'));
        $this->assertTrue(CatalogProductPaging::shouldPaginate((int) $page1->json('pagination.total')));

        $codes1 = collect($page1->json('data'))->pluck('code')->all();

        $page2 = $this->getJson(
            '/api/v1/products?category=game&provider_id='.$this->provider->id.'&per_page=20&page=2&surface=mobile'
        );
        $page2->assertOk();
        $this->assertCount(15, $page2->json('data'));
        $codes2 = collect($page2->json('data'))->pluck('code')->all();

        $overlap = array_intersect($codes1, $codes2);
        $this->assertSame([], array_values($overlap), 'pages must not duplicate SKUs');
        $this->assertCount(35, array_unique(array_merge($codes1, $codes2)));
    }

    public function test_total_29_fits_single_page_without_needing_client_pagination(): void
    {
        $this->seedSkus(29);

        $response = $this->getJson(
            '/api/v1/products?category=game&provider_id='.$this->provider->id.'&per_page=30&page=1&surface=mobile'
        );
        $response->assertOk();
        $total = (int) $response->json('pagination.total');
        $this->assertSame(29, $total);
        $this->assertFalse(CatalogProductPaging::shouldPaginate($total));
        $this->assertCount(29, $response->json('data'));
        $this->assertSame(1, (int) $response->json('pagination.lastPage'));
    }

    public function test_total_30_no_client_pagination_policy(): void
    {
        $this->seedSkus(30);

        $response = $this->getJson(
            '/api/v1/products?category=game&provider_id='.$this->provider->id.'&per_page=30&page=1&surface=mobile'
        );
        $response->assertOk();
        $total = (int) $response->json('pagination.total');
        $this->assertSame(30, $total);
        $this->assertFalse(CatalogProductPaging::shouldPaginate($total));
        $this->assertCount(30, $response->json('data'));
    }

    public function test_total_31_requires_pagination_policy(): void
    {
        $this->seedSkus(31);

        $response = $this->getJson(
            '/api/v1/products?category=game&provider_id='.$this->provider->id.'&per_page=20&page=1&surface=mobile'
        );
        $response->assertOk();
        $total = (int) $response->json('pagination.total');
        $this->assertSame(31, $total);
        $this->assertTrue(CatalogProductPaging::shouldPaginate($total));
        $this->assertCount(20, $response->json('data'));
        $this->assertSame(2, (int) $response->json('pagination.lastPage'));
    }
}
