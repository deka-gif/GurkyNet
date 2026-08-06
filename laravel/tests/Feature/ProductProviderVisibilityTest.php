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
 * Control Center is the single source of truth for user catalog visibility.
 */
class ProductProviderVisibilityTest extends TestCase
{
    use RefreshDatabase;

    protected ProductCategory $category;
    protected Provider $brand;
    protected Product $digiProduct;
    protected Product $vipProduct;
    protected ProductProvider $digi;
    protected ProductProvider $vip;

    protected function setUp(): void
    {
        parent::setUp();

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        $this->category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-vis', 'icon' => 'phone']);
        $this->brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);

        $this->digiProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->brand->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'XL5K_DIGI',
            'name' => 'XL 5K Digi',
            'base_price' => 5500,
            'sell_price' => 6000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $this->digiProduct->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'xl5',
            'base_price' => 5500,
            'is_active' => true,
        ]);

        $this->vipProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->brand->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-XL5K',
            'name' => 'XL 5K VIP',
            'base_price' => 5400,
            'sell_price' => 5900,
            'admin_fee' => 0,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $this->vipProduct->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'XL_5K_VIP',
            'base_price' => 5400,
            'is_active' => true,
        ]);
    }

    public function test_both_off_returns_zero_products(): void
    {
        $this->digi->update(['is_active' => false]);
        $this->vip->update(['is_active' => false]);
        ProductCatalogCache::bump();

        $res = $this->getJson('/api/v1/products?per_page=100');
        $res->assertOk();
        $this->assertCount(0, $res->json('data'));
    }

    public function test_digiflazz_on_vip_off_shows_only_digiflazz(): void
    {
        $this->digi->update(['is_active' => true]);
        $this->vip->update(['is_active' => false]);
        ProductCatalogCache::bump();

        $res = $this->getJson('/api/v1/products?per_page=100');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();

        $this->assertContains('XL5K_DIGI', $codes);
        $this->assertNotContains('VIP-XL5K', $codes);
    }

    public function test_digiflazz_off_vip_on_shows_only_vip(): void
    {
        $this->digi->update(['is_active' => false]);
        $this->vip->update(['is_active' => true]);
        ProductCatalogCache::bump();

        $res = $this->getJson('/api/v1/products?per_page=100');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();

        $this->assertNotContains('XL5K_DIGI', $codes);
        $this->assertContains('VIP-XL5K', $codes);
    }

    public function test_digi_status_false_with_active_vip_sku_is_visible_when_vip_on(): void
    {
        // Production shape: VIP SKU attached to Digi master that Digi marked status=false.
        $this->digiProduct->update(['status' => false]);
        ProductProviderSku::create([
            'product_id' => $this->digiProduct->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'XL_5K_VIP_ON_DIGI',
            'base_price' => 5400,
            'is_active' => true,
        ]);

        $this->digi->update(['is_active' => false]);
        $this->vip->update(['is_active' => true]);
        ProductCatalogCache::bump();

        $res = $this->getJson('/api/v1/products?per_page=100');
        $res->assertOk();
        $row = collect($res->json('data'))->firstWhere('code', 'XL5K_DIGI');

        $this->assertNotNull($row);
        $this->assertSame('tersedia', $row['status']);
    }

    public function test_digiflazz_off_vip_on_prepaid_category_appears_under_pulsa_filter(): void
    {
        // VIP sync historically stores category slug "prepaid"; User Dashboard requests "pulsa".
        $prepaid = ProductCategory::create(['name' => 'prepaid', 'slug' => 'prepaid', 'icon' => 'phone']);
        $this->vipProduct->update([
            'product_category_id' => $prepaid->id,
            'name' => 'XL 5K Digi',
        ]);

        $this->digi->update(['is_active' => false]);
        $this->vip->update(['is_active' => true]);
        ProductCatalogCache::bump();

        $res = $this->getJson('/api/v1/products?category=pulsa&per_page=100');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();

        $this->assertNotContains('XL5K_DIGI', $codes);
        $this->assertContains('VIP-XL5K', $codes);
    }

    public function test_both_on_merges_duplicate_logical_cards(): void
    {
        $this->digi->update(['is_active' => true, 'priority' => 1]);
        $this->vip->update(['is_active' => true, 'priority' => 2]);

        // Same logical product name/brand/category — must collapse to one card
        $this->vipProduct->update(['name' => 'XL 5K Digi']);

        ProductCatalogCache::bump();
        $res = $this->getJson('/api/v1/products?per_page=100&keyword=XL');
        $res->assertOk();

        $cards = collect($res->json('data'))->filter(fn ($row) => ($row['name'] ?? '') === 'XL 5K Digi');
        $this->assertCount(1, $cards);
        $this->assertSame('XL5K_DIGI', $cards->first()['code'] ?? null);
    }

    public function test_both_on_merges_pulsa_and_prepaid_category_family(): void
    {
        $pulsa = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'phone']);
        $prepaid = ProductCategory::create(['name' => 'prepaid', 'slug' => 'prepaid', 'icon' => 'phone']);

        $this->digiProduct->update([
            'product_category_id' => $pulsa->id,
            'name' => 'XL 5K Digi',
        ]);
        $this->vipProduct->update([
            'product_category_id' => $prepaid->id,
            'name' => 'XL 5K Digi',
        ]);

        $this->digi->update(['is_active' => true, 'priority' => 1]);
        $this->vip->update(['is_active' => true, 'priority' => 2]);
        ProductCatalogCache::bump();

        $res = $this->getJson('/api/v1/products?category=pulsa&per_page=100');
        $res->assertOk();

        $cards = collect($res->json('data'))->filter(fn ($row) => ($row['name'] ?? '') === 'XL 5K Digi');
        $this->assertCount(1, $cards);
        $this->assertSame('XL5K_DIGI', $cards->first()['code'] ?? null);
    }

    public function test_both_on_shows_both_when_names_differ(): void
    {
        $this->digi->update(['is_active' => true]);
        $this->vip->update(['is_active' => true]);
        ProductCatalogCache::bump();

        $res = $this->getJson('/api/v1/products?per_page=100');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();

        $this->assertContains('XL5K_DIGI', $codes);
        $this->assertContains('VIP-XL5K', $codes);
    }

    public function test_enable_disable_bumps_cache_and_catalog_changes(): void
    {
        $this->digi->update(['is_active' => true]);
        $this->vip->update(['is_active' => true]);

        $versionBefore = ProductCatalogCache::version();
        Cache::put(ProductCatalogCache::searchKey(['per_page' => 100]), 'stale', 600);

        $ops = \App\Models\User::factory()->create(['role' => \App\Enums\UserRole::OPERATIONS]);
        \Laravel\Sanctum\Sanctum::actingAs($ops);

        $this->postJson("/api/v1/admin/operations/product-provider-control/{$this->vip->id}/disable")
            ->assertOk();

        $this->assertNotSame($versionBefore, ProductCatalogCache::version());
        $this->assertFalse((bool) $this->vip->fresh()->is_active);

        // Unauthenticated catalog read after disable
        $this->app['auth']->forgetGuards();

        $res = $this->getJson('/api/v1/products?per_page=100');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();
        $this->assertContains('XL5K_DIGI', $codes);
        $this->assertNotContains('VIP-XL5K', $codes);

        \Laravel\Sanctum\Sanctum::actingAs($ops);
        $this->postJson("/api/v1/admin/operations/product-provider-control/{$this->vip->id}/enable")
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $res2 = $this->getJson('/api/v1/products?per_page=100');
        $codes2 = collect($res2->json('data'))->pluck('code')->all();
        $this->assertContains('VIP-XL5K', $codes2);
    }

    public function test_legacy_unmapped_digiflazz_product_is_auto_mapped_when_digiflazz_enabled(): void
    {
        $this->digi->update(['is_active' => true]);
        $this->vip->update(['is_active' => false]);

        $legacy = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->brand->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'LEGACY10',
            'name' => 'Legacy 10',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        $this->assertDatabaseMissing('product_provider_skus', [
            'product_id' => $legacy->id,
        ]);

        ProductCatalogCache::bump();
        $res = $this->getJson('/api/v1/products?keyword=LEGACY&per_page=100');
        $res->assertOk();
        $this->assertContains('LEGACY10', collect($res->json('data'))->pluck('code')->all());

        $this->assertDatabaseHas('product_provider_skus', [
            'product_id' => $legacy->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'LEGACY10',
            'is_active' => 1,
        ]);
    }
}
