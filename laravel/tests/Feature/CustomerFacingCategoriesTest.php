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

class CustomerFacingCategoriesTest extends TestCase
{
    use RefreshDatabase;

    protected ProductProvider $digi;

    protected Provider $brand;

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
        $this->digi->update(['is_active' => true, 'priority' => 1, 'api_status' => 'online']);

        $this->brand = Provider::create([
            'name' => 'Telkomsel',
            'is_active' => true,
        ]);

        Cache::flush();
        ProductCatalogCache::bump();
    }

    protected function seedDigiProduct(string $slug, string $name, string $sku): Product
    {
        $category = ProductCategory::firstOrCreate(
            ['slug' => $slug],
            ['name' => $name, 'icon' => 'box']
        );

        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $this->brand->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => $sku,
            'name' => $sku.' name',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => $sku,
            'provider_name' => $sku,
            'base_price' => 10000,
            'provider_price' => 10000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        return $product;
    }

    public function test_categories_hide_raw_provider_slugs(): void
    {
        $this->seedDigiProduct('game', 'Game', 'ML10');
        $this->seedDigiProduct('topup-digital', 'E-Wallet', 'GOPAY10');
        $this->seedDigiProduct('voucher-digital', 'Voucher Digital', 'GP100');
        $this->seedDigiProduct('voucher-internet', 'Voucher Internet', 'QAVI1');
        $this->seedDigiProduct('pln', 'Token PLN', 'PLN20');

        // Orphan / raw rows that must never appear as CF menus
        ProductCategory::create(['name' => 'Game Feature', 'slug' => 'game-feature', 'icon' => 'x']);
        ProductCategory::create(['name' => 'Gamed', 'slug' => 'gamed', 'icon' => 'x']);
        ProductCategory::create(['name' => 'Saldo EMoney', 'slug' => 'saldo-emoney', 'icon' => 'x']);
        ProductCategory::create(['name' => 'Streaming TV', 'slug' => 'streaming-tv', 'icon' => 'x']);
        ProductCategory::create(['name' => 'Voucher Game', 'slug' => 'voucher-game', 'icon' => 'x']);
        ProductCategory::create(['name' => 'Pulsa Reguler', 'slug' => 'pulsa-reguler', 'icon' => 'x']);
        ProductCategory::create(['name' => 'Paket Lainnya', 'slug' => 'paket-lainnya', 'icon' => 'x']);
        ProductCategory::create(['name' => 'E-Money', 'slug' => 'e-money', 'icon' => 'x']);

        ProductCatalogCache::bump();

        $res = $this->getJson('/api/v1/categories');
        $res->assertOk();
        $slugs = collect($res->json('data'))->pluck('slug')->all();

        $this->assertContains('game', $slugs);
        $this->assertContains('topup-digital', $slugs);
        $this->assertContains('voucher-digital', $slugs);
        $this->assertContains('voucher-internet', $slugs);
        $this->assertContains('pln', $slugs);

        foreach ([
            'game-feature', 'gamed', 'saldo-emoney', 'streaming-tv', 'voucher-game',
            'pulsa-reguler', 'paket-lainnya', 'e-money', 'ewallet',
        ] as $raw) {
            $this->assertNotContains($raw, $slugs, "Raw slug {$raw} must not appear in GET /categories");
        }

        $ewallet = collect($res->json('data'))->firstWhere('slug', 'topup-digital');
        $this->assertSame('E-Wallet', $ewallet['name'] ?? null);

        $pln = collect($res->json('data'))->firstWhere('slug', 'pln');
        $this->assertSame('Token PLN', $pln['name'] ?? null);

        // Voucher Digital and Voucher Internet remain distinct
        $this->assertNotSame(
            collect($res->json('data'))->firstWhere('slug', 'voucher-digital')['name'] ?? null,
            collect($res->json('data'))->firstWhere('slug', 'voucher-internet')['name'] ?? null
        );
    }

    public function test_raw_slug_detail_is_hidden(): void
    {
        ProductCategory::create(['name' => 'Game Feature', 'slug' => 'game-feature', 'icon' => 'x']);
        ProductCatalogCache::bump();

        $this->getJson('/api/v1/categories/game-feature')->assertNotFound();
    }

    public function test_category_without_digi_active_sku_is_hidden(): void
    {
        ProductCategory::create(['name' => 'Game', 'slug' => 'game', 'icon' => 'box']);
        // No Digi SKU mapping — must not appear
        ProductCatalogCache::bump();

        $slugs = collect($this->getJson('/api/v1/categories')->json('data'))->pluck('slug')->all();
        $this->assertNotContains('game', $slugs);
    }

    public function test_legacy_digi_products_activate_canonical_cf_category(): void
    {
        // Products still on orphan rows — CF menus must show canonical slugs only.
        $this->seedDigiProduct('game-feature', 'Game Feature', 'ML-LEGACY');
        $this->seedDigiProduct('gamed', 'Gamed', 'FF-LEGACY');
        $this->seedDigiProduct('saldo-emoney', 'Saldo EMoney', 'GOPAY-LEGACY');
        $this->seedDigiProduct('streaming-tv', 'Streaming TV', 'NETFLIX-LEGACY');
        $this->seedDigiProduct('voucher-game', 'Voucher Game', 'STEAM-LEGACY');
        ProductCategory::firstOrCreate(['slug' => 'game'], ['name' => 'Game', 'icon' => 'box']);
        ProductCategory::firstOrCreate(['slug' => 'topup-digital'], ['name' => 'E-Wallet', 'icon' => 'box']);
        ProductCategory::firstOrCreate(['slug' => 'langganan-digital'], ['name' => 'Langganan Digital', 'icon' => 'box']);

        ProductCatalogCache::bump();

        $res = $this->getJson('/api/v1/categories');
        $res->assertOk();
        $slugs = collect($res->json('data'))->pluck('slug')->all();

        $this->assertContains('game', $slugs);
        $this->assertContains('topup-digital', $slugs);
        $this->assertContains('langganan-digital', $slugs);

        foreach (['game-feature', 'gamed', 'saldo-emoney', 'streaming-tv', 'voucher-game'] as $raw) {
            $this->assertNotContains($raw, $slugs);
        }

        $this->assertSame(
            'E-Wallet',
            collect($res->json('data'))->firstWhere('slug', 'topup-digital')['name'] ?? null
        );
    }
}
