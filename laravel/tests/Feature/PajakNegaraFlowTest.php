<?php

namespace Tests\Feature;

use App\Actions\Transaction\CreateTransactionAction;
use App\Actions\Transaction\GetReceiptAction;
use App\Jobs\ProcessProductProviderTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use App\Support\WilayahMatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PajakNegaraFlowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;
    protected Product $pbbProduct;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory());

        config([
            'services.digiflazz.username' => 'gurky_test_user',
            'services.digiflazz.api_key' => 'gurky_test_key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
        ]);

        ProductProvider::digiflazz()?->update([
            'is_active' => true,
            'api_status' => 'online',
        ]);

        $this->user = User::create([
            'name' => 'Pajak User',
            'email' => 'pajak@gurkypay.com',
            'phone_number' => '081233344455',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000077',
            'balance' => 1000000.00,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'PBB',
            'slug' => 'pbb',
            'icon' => 'home',
        ]);

        $provider = Provider::create([
            'name' => 'Kota Cimahi',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->pbbProduct = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'cimahi',
            'name' => 'PBB Kota Cimahi',
            'base_price' => 0,
            'sell_price' => 0,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    public function test_wilayah_matcher_resolves_cimahi_to_jawa_barat(): void
    {
        $this->assertSame('Jawa Barat', WilayahMatcher::resolveProvince('PBB Kota Cimahi'));
    }

    public function test_pajak_regions_built_from_catalog(): void
    {
        $response = $this->getJson('/api/v1/catalog/pajak-regions/pbb');
        $response->assertOk()->assertJsonPath('success', true);

        $provinces = $response->json('data.provinces');
        $this->assertIsArray($provinces);
        $this->assertNotEmpty($provinces);

        $flatSkus = collect($provinces)->flatMap(fn ($p) => collect($p['cities'])->pluck('sku_code'))->all();
        $this->assertContains('cimahi', $flatSkus);
    }

    public function test_pbb_inquiry_sends_year_and_returns_provider_fields(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQPBBREF1',
                    'customer_no' => '329801092375999991',
                    'customer_name' => 'DEWI LESTARI',
                    'buyer_sku_code' => 'cimahi',
                    'admin' => 5000,
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'price' => 350000,
                    'selling_price' => 355000,
                    'desc' => [
                        'tahun_pajak' => '2026',
                        'alamat' => 'JL CONTOH',
                        'kab_kota' => 'PEMKOT CIMAHI',
                        'denda' => '0',
                    ],
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/tagihan/inquiry', [
            'sku_code' => 'cimahi',
            'customer_no' => '329801092375999991',
            'year' => 2026,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.customer_name', 'DEWI LESTARI')
            ->assertJsonPath('data.selling_price', 355000)
            ->assertJsonPath('data.admin_fee', 5000)
            ->assertJsonPath('data.tax_details.tahun_pajak', '2026');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'inq-pasca'
                && ($body['year'] ?? null) === 2026
                && ($body['customer_no'] ?? null) === '329801092375999991';
        });
    }

    public function test_samsat_inquiry_and_pay_persists_tax_receipt_fields(): void
    {
        $samsatCat = ProductCategory::create([
            'name' => 'SAMSAT',
            'slug' => 'samsat',
            'icon' => 'car',
        ]);
        $provider = Provider::create([
            'name' => 'SAMSAT Bali',
            'logo' => null,
            'is_active' => true,
        ]);
        $samsat = Product::create([
            'product_category_id' => $samsatCat->id,
            'provider_id' => $provider->id,
            'sku_code' => 'samsat',
            'name' => 'SAMSAT Bali',
            'base_price' => 0,
            'sell_price' => 0,
            'admin_fee' => 0,
            'status' => true,
        ]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::sequence()
                ->push([
                    'data' => [
                        'ref_id' => 'GNQSAMSAT1',
                        'customer_no' => 'B1234ABC,MHKV5EA2JFJ001044,0212502110170100',
                        'customer_name' => 'DEWI LESTARI',
                        'buyer_sku_code' => 'samsat',
                        'admin' => 5000,
                        'message' => 'Transaksi Sukses',
                        'status' => 'Sukses',
                        'rc' => '00',
                        'price' => 350000,
                        'selling_price' => 355000,
                        'desc' => [
                            'nomor_polisi' => 'B 1234 ABC',
                            'merek_kb' => 'Honda',
                            'model_kb' => 'Vario 150',
                            'tahun_buatan' => '2022',
                            'biaya_denda_pkb' => '0',
                            'biaya_pokok_pkb' => '350000',
                        ],
                    ],
                ], 200)
                ->push([
                    'data' => [
                        'ref_id' => 'GNQSAMSAT1',
                        'customer_no' => 'B1234ABC,MHKV5EA2JFJ001044,0212502110170100',
                        'customer_name' => 'DEWI LESTARI',
                        'buyer_sku_code' => 'samsat',
                        'admin' => 5000,
                        'message' => 'Transaksi Sukses',
                        'status' => 'Sukses',
                        'rc' => '00',
                        'sn' => 'NTPN:9988776655',
                        'price' => 350000,
                        'selling_price' => 355000,
                    ],
                ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $inq = $this->postJson('/api/v1/tagihan/inquiry', [
            'sku_code' => 'samsat',
            'customer_no' => 'B1234ABC,MHKV5EA2JFJ001044,0212502110170100',
        ])->assertOk();

        $ref = $inq->json('data.inquiry_ref_id');
        $this->assertNotEmpty($ref);
        $this->assertSame('Honda Vario 150', $inq->json('data.tax_details.vehicle_label'));

        Queue::fake();
        $trx = resolve(CreateTransactionAction::class)->execute(
            $this->user,
            'samsat',
            'B1234ABC,MHKV5EA2JFJ001044,0212502110170100',
            '123456',
            $ref
        );

        $meta = $trx->items->first()?->custom_metadata ?? [];
        $this->assertTrue(!empty($meta['is_pajak_negara']));
        $this->assertSame('samsat', $meta['pajak_jenis'] ?? null);
        $this->assertSame('DEWI LESTARI', $meta['customer_name'] ?? null);
        $this->assertEquals(355000.0, (float) $trx->total_payment);

        $job = new ProcessProductProviderTransaction($trx->id);
        app()->call([$job, 'handle']);
        $trx->refresh();
        $this->assertEquals('success', $trx->status);

        $receipt = resolve(GetReceiptAction::class)->execute($trx->fresh(['items', 'digiflazzTransaction']));
        $this->assertTrue($receipt['transaction_details']['is_pajak_negara']);
        $this->assertSame('DEWI LESTARI', $receipt['transaction_details']['customer_name']);
        $this->assertSame('B 1234 ABC', $receipt['transaction_details']['tax_details']['nomor_polisi'] ?? null);
        $this->assertNotEmpty($receipt['transaction_details']['nomor_pengesahan'] ?? $receipt['transaction_details']['ntpn']);
    }
}
