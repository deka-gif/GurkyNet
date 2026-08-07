<?php

namespace Tests\Feature;

use App\Actions\Admin\Operations\SyncDigiflazzCatalogAction;
use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DigiflazzPriceListSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory);

        config([
            'services.digiflazz.username' => 'buyer-user',
            'services.digiflazz.api_key' => 'buyer-key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
        ]);

        Setting::updateOrCreate(['key' => 'default_margin'], ['value' => '1000']);

        $this->assertNotNull(ProductProvider::digiflazz());
    }

    public function test_price_list_request_uses_post_pricelist_signature(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => Http::response(['data' => []], 200),
        ]);

        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid']]);

        Http::assertSent(function ($request) {
            $payload = $request->data();

            return $request->url() === 'https://api.digiflazz.com/v1/price-list'
                && $request->method() === 'POST'
                && ($payload['cmd'] ?? null) === 'prepaid'
                && ($payload['username'] ?? null) === 'buyer-user'
                && ($payload['sign'] ?? null) === md5('buyer-user'.'buyer-key'.'pricelist');
        });
    }

    public function test_prepaid_fields_are_persisted_on_digiflazz_products(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => function ($request) {
                $cmd = $request->data()['cmd'] ?? null;
                if ($cmd === 'prepaid') {
                    return Http::response([
                        'data' => [[
                            'product_name' => 'Xl 100.000',
                            'category' => 'Pulsa',
                            'brand' => 'XL',
                            'type' => 'Umum',
                            'seller_name' => 'PT. ABC',
                            'price' => 98000,
                            'buyer_sku_code' => 'X100',
                            'buyer_product_status' => true,
                            'seller_product_status' => true,
                            'unlimited_stock' => true,
                            'stock' => 0,
                            'multi' => true,
                            'start_cut_off' => '23:45',
                            'end_cut_off' => '00:15',
                            'desc' => 'Pulsa Xl Rp 100.000',
                        ]],
                    ], 200);
                }

                return Http::response(['data' => []], 200);
            },
        ]);

        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid', 'pasca']]);

        $row = DigiflazzProduct::where('buyer_sku_code', 'X100')->first();
        $this->assertNotNull($row);
        $this->assertSame('prepaid', $row->list_type);
        $this->assertSame('Umum', $row->type);
        $this->assertSame('PT. ABC', $row->seller_name);
        $this->assertSame('0', $row->stock);
        $this->assertTrue($row->multi);
        $this->assertSame('23:45', $row->start_cut_off);
        $this->assertSame('00:15', $row->end_cut_off);
        $this->assertEquals(98000, (float) $row->seller_price);
        $this->assertNull($row->admin);
        $this->assertNull($row->commission);

        $product = Product::where('sku_code', 'X100')->first();
        $this->assertNotNull($product);
        $this->assertTrue((bool) $product->status);
        $this->assertEquals(98000, (float) $product->base_price);
        $this->assertEquals(99000, (float) $product->sell_price); // margin 1000 preserved formula
    }

    public function test_pasca_admin_and_commission_are_persisted_without_changing_price_source(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => function ($request) {
                $cmd = $request->data()['cmd'] ?? null;
                if ($cmd === 'pasca') {
                    return Http::response([
                        'data' => [[
                            'product_name' => 'Pln Postpaid',
                            'category' => 'Pascabayar',
                            'brand' => 'PLN',
                            'seller_name' => 'PT. ABC',
                            'admin' => 2750,
                            'commission' => 1800,
                            'buyer_sku_code' => 'pln',
                            'buyer_product_status' => true,
                            'seller_product_status' => true,
                            'desc' => '-',
                        ]],
                    ], 200);
                }

                return Http::response(['data' => []], 200);
            },
        ]);

        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid', 'pasca']]);

        $row = DigiflazzProduct::where('buyer_sku_code', 'pln')->first();
        $this->assertNotNull($row);
        $this->assertSame('pasca', $row->list_type);
        $this->assertSame('PT. ABC', $row->seller_name);
        $this->assertSame(2750, $row->admin);
        $this->assertSame(1800, $row->commission);
        $this->assertEquals(0, (float) $row->seller_price);

        $product = Product::where('sku_code', 'pln')->first();
        $this->assertNotNull($product);
        $this->assertEquals(0, (float) $product->base_price);
        // Pricing engine unchanged: sell_price = base_price + default_margin (admin Digiflazz not copied to admin_fee)
        $this->assertEquals(1000, (float) $product->sell_price);
        $this->assertEquals(0, (float) $product->admin_fee);
    }

    public function test_missing_sku_is_deactivated_not_deleted(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => Http::sequence()
                ->push([
                    'data' => [[
                        'product_name' => 'Keep Me',
                        'category' => 'Pulsa',
                        'brand' => 'XL',
                        'type' => 'Umum',
                        'seller_name' => 'Seller',
                        'price' => 5000,
                        'buyer_sku_code' => 'KEEP1',
                        'buyer_product_status' => true,
                        'seller_product_status' => true,
                        'unlimited_stock' => true,
                        'stock' => 0,
                        'multi' => false,
                        'start_cut_off' => '00:00',
                        'end_cut_off' => '00:00',
                        'desc' => 'keep',
                    ], [
                        'product_name' => 'Drop Me',
                        'category' => 'Pulsa',
                        'brand' => 'XL',
                        'type' => 'Umum',
                        'seller_name' => 'Seller',
                        'price' => 6000,
                        'buyer_sku_code' => 'DROP1',
                        'buyer_product_status' => true,
                        'seller_product_status' => true,
                        'unlimited_stock' => true,
                        'stock' => 0,
                        'multi' => false,
                        'start_cut_off' => '00:00',
                        'end_cut_off' => '00:00',
                        'desc' => 'drop',
                    ]],
                ], 200)
                ->push(['data' => []], 200) // pasca empty
                ->push([
                    'data' => [[
                        'product_name' => 'Keep Me',
                        'category' => 'Pulsa',
                        'brand' => 'XL',
                        'type' => 'Umum',
                        'seller_name' => 'Seller',
                        'price' => 5000,
                        'buyer_sku_code' => 'KEEP1',
                        'buyer_product_status' => true,
                        'seller_product_status' => true,
                        'unlimited_stock' => true,
                        'stock' => 0,
                        'multi' => false,
                        'start_cut_off' => '00:00',
                        'end_cut_off' => '00:00',
                        'desc' => 'keep',
                    ]],
                ], 200)
                ->push(['data' => []], 200),
        ]);

        $action = app(SyncDigiflazzCatalogAction::class);
        $action->execute(['cmd' => ['prepaid', 'pasca']]);

        $this->assertDatabaseHas('digiflazz_products', ['buyer_sku_code' => 'DROP1']);
        $this->assertTrue((bool) Product::where('sku_code', 'DROP1')->value('status'));

        $action->execute(['cmd' => ['prepaid', 'pasca']]);

        $dropped = DigiflazzProduct::where('buyer_sku_code', 'DROP1')->first();
        $this->assertNotNull($dropped);
        $this->assertFalse((bool) $dropped->buyer_product_status);
        $this->assertFalse((bool) $dropped->seller_product_status);

        $droppedProduct = Product::where('sku_code', 'DROP1')->first();
        $this->assertNotNull($droppedProduct);
        $this->assertFalse((bool) $droppedProduct->status);

        $digi = ProductProvider::digiflazz();
        $this->assertFalse((bool) ProductProviderSku::where('product_provider_id', $digi->id)
            ->where('provider_sku', 'DROP1')
            ->value('is_active'));

        $this->assertTrue((bool) Product::where('sku_code', 'KEEP1')->value('status'));
    }

    public function test_partial_prepaid_only_sync_does_not_deactivate_pasca_skus(): void
    {
        DigiflazzProduct::create([
            'buyer_sku_code' => 'pasca-old',
            'list_type' => 'pasca',
            'product_name' => 'Old Pasca',
            'category' => 'Pascabayar',
            'brand' => 'PLN',
            'seller_price' => 0,
            'admin' => 1000,
            'commission' => 500,
            'buyer_product_status' => true,
            'seller_product_status' => true,
            'unlimited_stock' => true,
        ]);

        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => Http::response([
                'data' => [[
                    'product_name' => 'Xl 5',
                    'category' => 'Pulsa',
                    'brand' => 'XL',
                    'type' => 'Umum',
                    'seller_name' => 'Seller',
                    'price' => 5000,
                    'buyer_sku_code' => 'X5',
                    'buyer_product_status' => true,
                    'seller_product_status' => true,
                    'unlimited_stock' => true,
                    'stock' => 1,
                    'multi' => false,
                    'start_cut_off' => '00:00',
                    'end_cut_off' => '00:00',
                    'desc' => 'x5',
                ]],
            ], 200),
        ]);

        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid']]);

        $pasca = DigiflazzProduct::where('buyer_sku_code', 'pasca-old')->first();
        $this->assertNotNull($pasca);
        $this->assertTrue((bool) $pasca->buyer_product_status);
        $this->assertTrue((bool) $pasca->seller_product_status);
    }

    public function test_inactive_when_either_buyer_or_seller_status_false(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => function ($request) {
                if (($request->data()['cmd'] ?? null) === 'prepaid') {
                    return Http::response([
                        'data' => [[
                            'product_name' => 'Inactive Seller',
                            'category' => 'Pulsa',
                            'brand' => 'XL',
                            'type' => 'Umum',
                            'seller_name' => 'Seller',
                            'price' => 5000,
                            'buyer_sku_code' => 'OFF1',
                            'buyer_product_status' => true,
                            'seller_product_status' => false,
                            'unlimited_stock' => false,
                            'stock' => 1200,
                            'multi' => false,
                            'start_cut_off' => '00:00',
                            'end_cut_off' => '00:00',
                            'desc' => 'off',
                        ]],
                    ], 200);
                }

                return Http::response(['data' => []], 200);
            },
        ]);

        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid', 'pasca']]);

        $this->assertFalse((bool) Product::where('sku_code', 'OFF1')->value('status'));
    }

    public function test_existing_margin_is_preserved_on_price_update(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => Http::sequence()
                ->push([
                    'data' => [[
                        'product_name' => 'Margin SKU',
                        'category' => 'Pulsa',
                        'brand' => 'XL',
                        'type' => 'Umum',
                        'seller_name' => 'Seller',
                        'price' => 10000,
                        'buyer_sku_code' => 'M1',
                        'buyer_product_status' => true,
                        'seller_product_status' => true,
                        'unlimited_stock' => true,
                        'stock' => 0,
                        'multi' => true,
                        'start_cut_off' => '00:00',
                        'end_cut_off' => '00:00',
                        'desc' => 'm1',
                    ]],
                ], 200)
                ->push(['data' => []], 200)
                ->push([
                    'data' => [[
                        'product_name' => 'Margin SKU',
                        'category' => 'Pulsa',
                        'brand' => 'XL',
                        'type' => 'Umum',
                        'seller_name' => 'Seller',
                        'price' => 11000,
                        'buyer_sku_code' => 'M1',
                        'buyer_product_status' => true,
                        'seller_product_status' => true,
                        'unlimited_stock' => true,
                        'stock' => 0,
                        'multi' => true,
                        'start_cut_off' => '00:00',
                        'end_cut_off' => '00:00',
                        'desc' => 'm1',
                    ]],
                ], 200)
                ->push(['data' => []], 200),
        ]);

        $action = app(SyncDigiflazzCatalogAction::class);
        $action->execute(['cmd' => ['prepaid', 'pasca']]);

        $first = Product::where('sku_code', 'M1')->first();
        $this->assertEquals(10000, (float) $first->base_price);
        $this->assertEquals(11000, (float) $first->sell_price); // +1000 margin

        $action->execute(['cmd' => ['prepaid', 'pasca']]);

        $second = Product::where('sku_code', 'M1')->first();
        $this->assertEquals(11000, (float) $second->base_price);
        $this->assertEquals(12000, (float) $second->sell_price); // margin still 1000
    }

    public function test_price_list_rc_83_rate_limit_is_classified_without_crash(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => Http::response([
                'data' => [
                    'rc' => '83',
                    'status' => 'Gagal',
                    'message' => 'Anda telah mencapai limitasi pengecekan pricelist, silahkan coba beberapa saat lagi',
                ],
            ], 200),
        ]);

        try {
            app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid']]);
            $this->fail('Expected ProviderCatalogException for RC 83 price-list failure');
        } catch (\App\Exceptions\ProviderCatalogException $e) {
            $this->assertSame('Digiflazz', $e->provider);
            $this->assertSame('83', $e->providerCode);
            $this->assertTrue($e->retryable);
            $payload = $e->toArray();
            $this->assertFalse($payload['success']);
            $this->assertSame('RC83', $payload['provider_code']);
            $this->assertStringContainsString('pricelist', strtolower($e->getMessage()));
        }

        $this->assertTrue(\App\Services\ProductProviders\DigiflazzResponseCodeClassifier::classify('83')->isRateLimited());
    }
}
