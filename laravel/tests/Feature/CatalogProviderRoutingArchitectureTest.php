<?php

namespace Tests\Feature;

use App\Actions\Admin\Operations\SyncDigiflazzCatalogAction;
use App\Actions\Admin\Operations\SyncVipCatalogAction;
use App\Enums\UserRole;
use App\Http\Resources\TransactionResource;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\User;
use App\Services\ProductProviders\ProductCatalogCache;
use App\Services\ProductProviders\ProductRoutingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Normalized catalog + provider routing architecture (Digiflazz PRIMARY, VIP FALLBACK).
 */
class CatalogProviderRoutingArchitectureTest extends TestCase
{
    use RefreshDatabase;

    protected ProductProvider $digi;
    protected ProductProvider $vip;
    protected ProductCategory $pulsa;
    protected Provider $telkomsel;
    protected User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory());
        config([
            'services.digiflazz.username' => 'gurky_test_user',
            'services.digiflazz.api_key' => 'gurky_test_key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'services.vip.username' => 'vip_test_id',
            'services.vip.merchant_id' => 'vip_test_id',
            'services.vip.api_key' => 'vip_test_key_real',
            'services.vip.signature' => '',
        ]);

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        foreach ([$this->digi, $this->vip] as $pp) {
            $pp->update([
                'is_active' => true,
                'partner_status' => 'online',
                'api_status' => 'online',
            ]);
        }
        $this->digi->update(['priority' => 1]);
        $this->vip->update(['priority' => 2]);

        $this->pulsa = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'phone', 'is_active' => true]);
        $this->telkomsel = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);

        $this->customer = User::create([
            'name' => 'Buyer',
            'email' => 'buyer-arch@gurkypay.com',
            'phone_number' => '081299900099',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        ProductCatalogCache::bump();
    }

    public function test_digiflazz_only_product_routes_to_digiflazz(): void
    {
        $product = $this->seedProduct('TSEL2K-D', 'Telkomsel 2.000', [
            ['provider' => $this->digi, 'sku' => 'TSEL2K'],
        ]);

        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($product);
        $this->assertCount(1, $offers);
        $this->assertSame(ProductProvider::CODE_DIGIFLAZZ, $offers->first()->productProvider?->code);
    }

    public function test_vip_only_product_routes_to_vip(): void
    {
        $product = $this->seedProduct('VIP-SM2', 'Telkomsel 2.000', [
            ['provider' => $this->vip, 'sku' => 'SM2'],
        ]);

        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($product);
        $this->assertCount(1, $offers);
        $this->assertSame(ProductProvider::CODE_VIP, $offers->first()->productProvider?->code);
    }

    public function test_dual_provider_prefers_digiflazz(): void
    {
        $product = $this->seedProduct('TSEL10-M', 'Telkomsel 10.000', [
            ['provider' => $this->digi, 'sku' => 'TSEL10', 'preferred' => true],
            ['provider' => $this->vip, 'sku' => 'SM10'],
        ]);

        $offers = app(ProductRoutingService::class)->orderedOffersForProduct($product);
        $this->assertGreaterThanOrEqual(2, $offers->count());
        $this->assertSame(ProductProvider::CODE_DIGIFLAZZ, $offers->first()->productProvider?->code);
    }

    public function test_catalog_shows_single_card_for_logical_duplicates(): void
    {
        $this->seedProduct('TSEL10-D', 'Telkomsel Pulsa 10.000', [
            ['provider' => $this->digi, 'sku' => 'TSEL10'],
        ]);
        $this->seedProduct('VIP-SM10', 'Telkomsel 10.000', [
            ['provider' => $this->vip, 'sku' => 'SM10'],
        ]);
        ProductCatalogCache::bump();

        Sanctum::actingAs($this->customer);
        $res = $this->getJson('/api/v1/products?category=pulsa&per_page=200');
        $res->assertOk();

        $names = collect($res->json('data'))
            ->filter(fn (array $row) => str_contains(strtolower((string) ($row['name'] ?? '')), 'telkomsel')
                && str_contains((string) ($row['name'] ?? ''), '10'))
            ->pluck('name')
            ->values();

        $this->assertCount(1, $names, 'Logical duplicates must merge to one customer-facing card');
    }

    public function test_vip_sync_attaches_offer_when_names_differ_but_logical_key_matches(): void
    {
        $this->fakeDigiflazz([[
            'product_name' => 'Telkomsel Pulsa 10.000',
            'category' => 'Pulsa',
            'brand' => 'Telkomsel',
            'buyer_sku_code' => 'TSEL10K',
            'buyer_product_status' => true,
            'seller_product_status' => true,
            'price' => 10000,
            'seller_price' => 10000,
        ]]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $master = Product::where('sku_code', 'TSEL10K')->firstOrFail();
        $this->assertSame('Telkomsel Pulsa 10.000', $master->name);

        $this->fakeVipPrepaid([[
            'code' => 'SM10',
            'name' => 'Telkomsel 10.000',
            'brand' => 'Telkomsel',
            'category' => 'pulsa',
            'price' => ['basic' => 10100, 'premium' => null, 'special' => null],
            'status' => 'available',
        ]]);
        app(SyncVipCatalogAction::class)->execute(['include_game' => false]);

        $this->assertNull(Product::where('sku_code', 'VIP-SM10')->first(), 'VIP must not create standalone row when master exists');
        $sku = ProductProviderSku::where('product_id', $master->id)
            ->where('product_provider_id', $this->vip->id)
            ->where('provider_sku', 'SM10')
            ->first();
        $this->assertNotNull($sku);
        $this->assertTrue((bool) $sku->is_active);
    }

    public function test_no_active_mapping_product_not_visible_in_catalog(): void
    {
        $product = Product::create([
            'product_category_id' => $this->pulsa->id,
            'provider_id' => $this->telkomsel->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-NOMAP',
            'name' => 'Telkomsel 99.000',
            'base_price' => 99000,
            'sell_price' => 100000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'NOMAP',
            'base_price' => 99000,
            'is_active' => false,
        ]);
        ProductCatalogCache::bump();

        Sanctum::actingAs($this->customer);
        $res = $this->getJson('/api/v1/products?category=pulsa&per_page=200');
        $res->assertOk();
        $row = collect($res->json('data'))->firstWhere('code', 'VIP-NOMAP');
        $this->assertNull($row, 'Products without active provider SKU mapping must not appear in customer catalog');
    }

    public function test_customer_transaction_resource_hides_provider_fields(): void
    {
        $tx = Transaction::factory()->create([
            'user_id' => $this->customer->id,
            'fulfillment_provider_code' => 'vip',
            'service_name' => 'Pulsa Telkomsel 2.000',
        ]);

        $request = Request::create('/api/v1/transactions', 'GET');
        $request->setUserResolver(fn () => $this->customer);

        $payload = (new TransactionResource($tx))->toArray($request);
        $this->assertArrayNotHasKey('providerCode', $payload);
        $this->assertArrayNotHasKey('providerName', $payload);
    }

    public function test_admin_transaction_resource_includes_provider_fields(): void
    {
        $admin = User::create([
            'name' => 'Ops',
            'email' => 'ops-arch@gurkypay.com',
            'phone_number' => '081299900088',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
        ]);

        $tx = Transaction::factory()->create([
            'user_id' => $this->customer->id,
            'fulfillment_provider_code' => 'digiflazz',
        ]);

        $request = Request::create('/api/v1/admin/support/transactions', 'GET');
        $request->setUserResolver(fn () => $admin);

        $payload = (new TransactionResource($tx))->toArray($request);
        $this->assertSame('digiflazz', $payload['providerCode']);
    }

    /**
     * @param  list<array{provider: ProductProvider, sku: string, preferred?: bool}>  $offers
     */
    protected function seedProduct(string $sku, string $name, array $offers): Product
    {
        $primary = $offers[0]['provider'];
        $product = Product::create([
            'product_category_id' => $this->pulsa->id,
            'provider_id' => $this->telkomsel->id,
            'product_provider_id' => $primary->id,
            'sku_code' => $sku,
            'name' => $name,
            'base_price' => 10000,
            'sell_price' => 11500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        foreach ($offers as $offer) {
            ProductProviderSku::create([
                'product_id' => $product->id,
                'product_provider_id' => $offer['provider']->id,
                'provider_sku' => $offer['sku'],
                'base_price' => 10000,
                'is_active' => true,
                'is_preferred' => (bool) ($offer['preferred'] ?? false),
            ]);
        }

        return $product->fresh(['providerSkus.productProvider', 'category', 'provider']);
    }

    protected function fakeDigiflazz(array $rows): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => Http::response(['data' => $rows], 200),
        ]);
    }

    protected function fakeVipPrepaid(array $rows): void
    {
        Http::fake([
            'https://vip-reseller.co.id/api/prepaid' => Http::response(['result' => true, 'data' => $rows], 200),
            'https://vip-reseller.co.id/api/game-feature' => Http::response(['result' => true, 'data' => []], 200),
        ]);
    }
}
