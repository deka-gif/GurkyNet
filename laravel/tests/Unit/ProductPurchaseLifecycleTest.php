<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Services\Catalog\ProductPurchaseLifecycleService;
use App\Services\Catalog\ProductTransactionCapabilityRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductPurchaseLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_capability_registry_maps_core_categories(): void
    {
        $reg = app(ProductTransactionCapabilityRegistry::class);

        $pulsa = $reg->forCategorySlug('pulsa');
        $this->assertSame('PREPAID_DIRECT', $pulsa['mode']);
        $this->assertTrue($pulsa['mobile_purchase']);

        $game = $reg->forCategorySlug('game');
        $this->assertSame('SCHEMA_ACCOUNT', $game['mode']);
        $this->assertTrue($game['requires_resolved_account_schema']);

        $tagihan = $reg->forCategorySlug('pdam');
        $this->assertSame('POSTPAID_INQUIRY_PAYMENT', $tagihan['mode']);
        $this->assertTrue($tagihan['mobile_purchase']);
        $this->assertTrue($tagihan['web_purchase']);
    }

    public function test_unknown_game_hidden_from_customer_catalog(): void
    {
        $digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $digi->update(['is_active' => true, 'api_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Game', 'slug' => 'game', 'icon' => 'g']);
        $brand = Provider::create(['name' => 'Mystery Unknown Game', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'myst-unk-1',
            'name' => 'Mystery Pack',
            'base_price' => 1000,
            'sell_price' => 1100,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'myst-unk-1',
            'provider_name' => 'Mystery Pack',
            'base_price' => 1000,
            'provider_price' => 1000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        $life = app(ProductPurchaseLifecycleService::class)->evaluate($product->fresh());
        $this->assertFalse($life['purchasable']);
        $this->assertFalse($life['catalog_visible']);
        $this->assertSame('UNKNOWN_SCHEMA', $life['reason']);
    }

    public function test_free_fire_purchasable_via_profile(): void
    {
        $digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $digi->update(['is_active' => true, 'api_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Game', 'slug' => 'game', 'icon' => 'g']);
        $brand = Provider::create(['name' => 'Free Fire', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'ff50',
            'name' => 'FF 50',
            'base_price' => 7000,
            'sell_price' => 7500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'ff50',
            'provider_name' => 'FF 50',
            'base_price' => 7000,
            'provider_price' => 7000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        $life = app(ProductPurchaseLifecycleService::class)->evaluate($product->fresh());
        $this->assertTrue($life['purchasable']);
        $this->assertTrue($life['catalog_visible']);
        $this->assertSame(ProductPurchaseLifecycleService::STAGE_PURCHASABLE, $life['stage']);
        $this->assertSame('PLAYER_ID', $life['account_schema']['schema_key'] ?? null);
    }

    public function test_pulsa_capability_still_purchasable(): void
    {
        $digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $digi->update(['is_active' => true, 'api_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'p']);
        $brand = Provider::create(['name' => 'Telkomsel', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'pulsa10',
            'name' => 'Pulsa 10k',
            'base_price' => 10000,
            'sell_price' => 10500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'pulsa10',
            'provider_name' => 'Pulsa 10k',
            'base_price' => 10000,
            'provider_price' => 10000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        $life = app(ProductPurchaseLifecycleService::class)->evaluate($product->fresh());
        $this->assertTrue($life['purchasable']);
        $this->assertSame('PREPAID_DIRECT', $life['capability']['mode'] ?? null);
    }

    public function test_langganan_voucher_schema_is_purchasable(): void
    {
        $digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $digi->update(['is_active' => true, 'api_status' => 'online']);

        $category = ProductCategory::create([
            'name' => 'Langganan Digital',
            'slug' => 'langganan-digital',
            'icon' => 'l',
        ]);
        $brand = Provider::create(['name' => 'Vidio', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'VIDIO30',
            'name' => 'Vidio 30 Hari',
            'base_price' => 30000,
            'sell_price' => 31000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'VIDIO30',
            'provider_name' => 'Vidio 30 Hari',
            'base_price' => 30000,
            'provider_price' => 30000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        $life = app(ProductPurchaseLifecycleService::class)->evaluate($product->fresh());
        $this->assertTrue($life['purchasable']);
        $this->assertTrue($life['catalog_visible']);
        $this->assertSame(ProductPurchaseLifecycleService::STAGE_PURCHASABLE, $life['stage']);
        $this->assertSame('voucher', $life['account_schema']['delivery'] ?? null);
    }

    public function test_langganan_digi_phone_sku_is_purchasable(): void
    {
        $digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $digi->update(['is_active' => true, 'api_status' => 'online']);

        $category = ProductCategory::create([
            'name' => 'Langganan Digital',
            'slug' => 'langganan-digital',
            'icon' => 'l',
        ]);
        $brand = Provider::create(['name' => 'Vidio', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'pre33615183',
            'name' => 'Vidio Digi Phone',
            'base_price' => 20000,
            'sell_price' => 21000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'pre33615183',
            'provider_name' => 'Vidio Digi Phone',
            'base_price' => 20000,
            'provider_price' => 20000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        $life = app(ProductPurchaseLifecycleService::class)->evaluate($product->fresh());
        $this->assertTrue($life['purchasable']);
        $this->assertSame('account', $life['account_schema']['delivery'] ?? null);
        $this->assertSame(['phone'], collect($life['account_schema']['fields'] ?? [])->pluck('key')->all());
    }

    public function test_langganan_unknown_sku_is_needs_review_hidden(): void
    {
        $digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $digi->update(['is_active' => true, 'api_status' => 'online']);

        $category = ProductCategory::create([
            'name' => 'Langganan Digital',
            'slug' => 'langganan-digital',
            'icon' => 'l',
        ]);
        $brand = Provider::create(['name' => 'K-Vision Mystery', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'kvision30d',
            'name' => 'KVision 30D',
            'base_price' => 50000,
            'sell_price' => 51000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'kvision30d',
            'provider_name' => 'KVision 30D',
            'base_price' => 50000,
            'provider_price' => 50000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        $life = app(ProductPurchaseLifecycleService::class)->evaluate($product->fresh());
        $this->assertFalse($life['purchasable']);
        $this->assertFalse($life['catalog_visible']);
        $this->assertSame(ProductPurchaseLifecycleService::STAGE_NEEDS_REVIEW, $life['stage']);
        $this->assertSame(ProductPurchaseLifecycleService::REASON_UNKNOWN_SCHEMA, $life['reason']);
    }

    public function test_postpaid_capability_enables_mobile_purchase(): void
    {
        $reg = app(ProductTransactionCapabilityRegistry::class);
        foreach ([
            'pln-pascabayar',
            'pdam',
            'bpjs-kesehatan',
            'bpjs-tk',
            'pbb',
            'samsat',
            'multifinance',
            'tagihan',
            'hp-pascabayar',
            'gas',
            'sms-telepon',
            'masa-aktif',
            'aktivasi-perdana',
            'esim',
            'voucher-digital',
            'international',
            'gas-prepaid',
        ] as $slug) {
            $cap = $reg->forCategorySlug($slug);
            $this->assertNotNull($cap, $slug);
            $this->assertTrue($cap['mobile_purchase'], $slug.' must allow mobile_purchase');
            $this->assertTrue($cap['web_purchase'], $slug);
        }
    }
}
