<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\ProductProviders\ProductProviderFulfillmentService;
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProductRoutingService;
use App\Services\ProductProviders\ProviderFailoverPolicy;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Services\ProductProviders\DigiflazzProductProviderAdapter;
use App\Services\ProductProviders\VipPulsaProductProviderAdapter;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Enums\TransactionStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

/**
 * Langganan Digital catalog — PRIMARY Digiflazz + FALLBACK VIP deduplication.
 */
class LanggananCatalogMergeTest extends TestCase
{
    use RefreshDatabase;

    protected ProductCategory $category;
    protected Provider $steam;
    protected Provider $tiktok;
    protected ProductProvider $digi;
    protected ProductProvider $vip;

    protected function setUp(): void
    {
        parent::setUp();

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        $this->digi->update(['is_active' => true, 'priority' => 1, 'api_status' => 'online', 'partner_status' => 'online']);
        $this->vip->update(['is_active' => true, 'priority' => 2, 'api_status' => 'online', 'partner_status' => 'online']);

        $this->category = ProductCategory::create([
            'name' => 'Langganan Digital',
            'slug' => 'langganan-digital',
            'icon' => 'play',
            'is_active' => true,
        ]);

        $this->steam = Provider::create(['name' => 'Steam', 'logo' => null, 'is_active' => true]);
        $this->tiktok = Provider::create(['name' => 'TikTok', 'logo' => null, 'is_active' => true]);
    }

    public function test_duplicate_steam_myr5_merged_to_digiflazz_card(): void
    {
        $digiProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->steam->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'STEAMMYR5',
            'name' => 'Steam Wallet MYR 5',
            'base_price' => 20000,
            'sell_price' => 22513,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $digiProduct->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'STEAMMYR5',
            'base_price' => 20000,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        $vipProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->steam->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-STEAMMYR5',
            'name' => 'Steam Wallet Code MYR 5',
            'base_price' => 21000,
            'sell_price' => 23000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $vipProduct->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'VIP_STEAM_MYR5',
            'base_price' => 21000,
            'is_preferred' => false,
            'is_active' => true,
        ]);

        Sanctum::actingAs(User::factory()->create());

        $res = $this->getJson('/api/v1/products?category=langganan-digital&provider_id=' . $this->steam->id);
        $res->assertOk();

        $myr5 = collect($res->json('data'))->filter(
            fn ($row) => str_contains(strtolower((string) ($row['name'] ?? '')), 'myr 5')
        );
        $this->assertCount(1, $myr5);
        $this->assertSame('STEAMMYR5', $myr5->first()['code'] ?? null);
        $this->assertSame(22513.0, (float) ($myr5->first()['price'] ?? 0));
    }

    public function test_steam_myr10_vip_only_still_listed(): void
    {
        $digiMyr5 = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->steam->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'STEAMMYR5',
            'name' => 'Steam Wallet MYR 5',
            'base_price' => 20000,
            'sell_price' => 22513,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $digiMyr5->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'STEAMMYR5',
            'base_price' => 20000,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        $vipOnly = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->steam->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-STEAMMYR10',
            'name' => 'Steam Wallet MYR 10',
            'base_price' => 40000,
            'sell_price' => 45000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $vipOnly->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'VIP_STEAM_MYR10',
            'base_price' => 40000,
            'is_active' => true,
        ]);

        Sanctum::actingAs(User::factory()->create());

        $res = $this->getJson('/api/v1/products?category=langganan-digital&provider_id=' . $this->steam->id);
        $res->assertOk();

        $names = collect($res->json('data'))->pluck('name')->map(fn ($n) => strtolower((string) $n));
        $this->assertTrue($names->contains(fn ($n) => str_contains($n, 'myr 5')));
        $this->assertTrue($names->contains(fn ($n) => str_contains($n, 'myr 10')));
        $this->assertCount(2, $res->json('data'));
    }

    public function test_tiktok_premium_vip_only_appears(): void
    {
        $vipOnly = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->tiktok->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-TIKTOK30',
            'name' => 'TikTok Premium 30 Hari',
            'base_price' => 35000,
            'sell_price' => 36000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $vipOnly->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'TIKTOK30VIP',
            'base_price' => 35000,
            'is_active' => true,
        ]);

        Sanctum::actingAs(User::factory()->create());

        $res = $this->getJson('/api/v1/products?category=langganan-digital&provider_id=' . $this->tiktok->id);
        $res->assertOk();
        $this->assertCount(1, $res->json('data'));
        $this->assertSame('VIP-TIKTOK30', $res->json('data.0.code'));
    }

    public function test_langganan_sibling_routing_includes_vip_fallback_offer(): void
    {
        $digiProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->steam->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'STEAMMYR8',
            'name' => 'Steam Wallet MYR 8',
            'base_price' => 30000,
            'sell_price' => 32000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $digiProduct->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'STEAMMYR8',
            'base_price' => 30000,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        $vipProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->steam->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-STEAMMYR8',
            'name' => 'Steam Wallet Code MYR 8',
            'base_price' => 31000,
            'sell_price' => 33000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $vipProduct->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'VIP_STEAM_MYR8',
            'base_price' => 31000,
            'is_active' => true,
        ]);

        $routing = app(ProductRoutingService::class);
        $offers = $routing->orderedOffersForProduct($digiProduct->fresh(['category', 'provider', 'providerSkus.productProvider']));

        $this->assertGreaterThanOrEqual(2, $offers->count());
        $this->assertSame('digiflazz', $offers->first()->productProvider->code);
        $this->assertTrue($offers->contains(fn ($o) => $o->productProvider?->code === 'vip'));
    }

    public function test_repository_merge_returns_single_steam_myr5(): void
    {
        $digiMyr5 = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->steam->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'STEAMMYR5',
            'name' => 'Steam Wallet MYR 5',
            'base_price' => 20000,
            'sell_price' => 22513,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $digiMyr5->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'STEAMMYR5',
            'is_active' => true,
        ]);

        $vipMyr5 = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->steam->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-STEAMMYR5',
            'name' => 'Steam Wallet Code MYR 5',
            'base_price' => 21000,
            'sell_price' => 23000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $vipMyr5->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'VIP_STEAM_MYR5',
            'is_active' => true,
        ]);

        $repo = app(ProductRepositoryInterface::class);
        $merged = $repo->getActiveProductsForCategory('langganan-digital');

        $steamMyr5 = $merged->filter(fn (Product $p) => str_contains(strtolower($p->name), 'myr 5'));
        $this->assertCount(1, $steamMyr5);
        $this->assertSame('STEAMMYR5', $steamMyr5->first()->sku_code);
    }
}
