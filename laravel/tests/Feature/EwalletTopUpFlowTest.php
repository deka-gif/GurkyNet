<?php

namespace Tests\Feature;

use App\Actions\Transaction\CreateTransactionAction;
use App\Jobs\ProcessProductProviderTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Catalog\EwalletBrandResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * E-Wallet = Digiflazz Pascabayar / Bebas Nominal open-amount flow.
 */
class EwalletTopUpFlowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;
    protected Product $product;
    protected ProductProvider $digi;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory());

        config([
            'services.digiflazz.username' => 'gurky_test_user',
            'services.digiflazz.api_key' => 'gurky_test_key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
        ]);

        $this->digi = ProductProvider::digiflazz();
        $this->digi?->update([
            'is_active' => true,
            'api_status' => 'online',
        ]);

        $this->user = User::create([
            'name' => 'Ewallet User',
            'email' => 'ewallet@gurkypay.com',
            'phone_number' => '081211122233',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000088',
            'balance' => 500000.00,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'Top Up Digital',
            'slug' => 'topup-digital',
            'icon' => 'wallet',
        ]);

        $provider = Provider::create([
            'name' => 'DANA',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'product_provider_id' => $this->digi?->id,
            'sku_code' => 'post733506',
            'name' => 'Dana Bebas Nominal',
            'base_price' => 0,
            'sell_price' => 1500,
            'admin_fee' => 1500,
            'status' => true,
            'ops_status' => 'active',
        ]);

        if ($this->digi) {
            ProductProviderSku::create([
                'product_id' => $this->product->id,
                'product_provider_id' => $this->digi->id,
                'provider_sku' => 'post733506',
                'base_price' => 0,
                'is_preferred' => true,
                'is_active' => true,
            ]);
        }
    }

    public function test_open_amount_limits_config_for_required_brands(): void
    {
        $resolver = app(EwalletBrandResolver::class);

        $this->assertSame(['min_amount' => 1, 'max_amount' => 800000], $resolver->openAmountLimitsForBrand('DANA'));
        $this->assertSame(['min_amount' => 1000, 'max_amount' => 500000], $resolver->openAmountLimitsForBrand('GoPay'));
        $this->assertSame(['min_amount' => 1000, 'max_amount' => 500000], $resolver->openAmountLimitsForBrand('LinkAja'));
        $this->assertSame(['min_amount' => 1000, 'max_amount' => 500000], $resolver->openAmountLimitsForBrand('OVO'));
        $this->assertSame(['min_amount' => 1000, 'max_amount' => 500000], $resolver->openAmountLimitsForBrand('ShopeePay'));
    }

    public function test_canonicalize_collapses_go_pay_duplicate(): void
    {
        $resolver = app(EwalletBrandResolver::class);
        $this->assertSame('GoPay', $resolver->canonicalize('GO PAY'));
        $this->assertSame('GoPay', $resolver->canonicalize('GoPay'));
        $this->assertSame('GoPay', $resolver->canonicalize('E-MONEY', 'Gopay Bebas Nominal'));
        $this->assertSame('ShopeePay', $resolver->canonicalize('SHOPEE PAY'));
    }

    public function test_dana_open_amount_bounds(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQEWALLET001',
                    'customer_no' => '08123456789',
                    'customer_name' => 'REZA ADITYA',
                    'buyer_sku_code' => 'post733506',
                    'admin' => 1500,
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'price' => 1,
                    'selling_price' => 1501,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        // Digiflazz RC 87 — even DANA (config min 1) must send multiples of Rp1.000.
        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733506',
            'customer_no' => '08123456789',
            'amount' => 1,
        ])->assertStatus(422)->assertJsonValidationErrors(['amount']);

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733506',
            'customer_no' => '08123456789',
            'amount' => 1500,
        ])->assertStatus(422)->assertJsonValidationErrors(['amount']);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQEWALLET001',
                    'customer_no' => '08123456789',
                    'customer_name' => 'REZA ADITYA',
                    'buyer_sku_code' => 'post733506',
                    'admin' => 1500,
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'price' => 1000,
                    'selling_price' => 2500,
                ],
            ], 200),
        ]);

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733506',
            'customer_no' => '08123456789',
            'amount' => 1000,
        ])->assertOk()->assertJsonPath('data.nominal_amount', 1000);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQEWALLET800',
                    'customer_no' => '08123456789',
                    'customer_name' => 'REZA ADITYA',
                    'buyer_sku_code' => 'post733506',
                    'admin' => 1500,
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'price' => 800000,
                    'selling_price' => 801500,
                ],
            ], 200),
        ]);

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733506',
            'customer_no' => '08123456789',
            'amount' => 800000,
        ])->assertOk()->assertJsonPath('data.nominal_amount', 800000);

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733506',
            'customer_no' => '08123456789',
            'amount' => 0,
        ])->assertStatus(422);

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733506',
            'customer_no' => '08123456789',
            'amount' => 800001,
        ])->assertStatus(422)->assertJsonValidationErrors(['amount']);
    }

    public function test_gopay_open_amount_bounds(): void
    {
        $gopay = Provider::create(['name' => 'GoPay', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $this->product->product_category_id,
            'provider_id' => $gopay->id,
            'product_provider_id' => $this->digi?->id,
            'sku_code' => 'post733505',
            'name' => 'Gopay Bebas Nominal',
            'base_price' => 0,
            'sell_price' => 1500,
            'admin_fee' => 1500,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'post733505',
            'base_price' => 0,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQGOPAY',
                    'customer_no' => '08123456789',
                    'customer_name' => 'REZA ADITYA',
                    'buyer_sku_code' => 'post733505',
                    'admin' => 1500,
                    'status' => 'Sukses',
                    'rc' => '00',
                    'price' => 1000,
                    'selling_price' => 2500,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733505',
            'customer_no' => '08123456789',
            'amount' => 1000,
        ])->assertOk();

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733505',
            'customer_no' => '08123456789',
            'amount' => 500000,
        ])->assertOk();

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733505',
            'customer_no' => '08123456789',
            'amount' => 999,
        ])->assertStatus(422);

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733505',
            'customer_no' => '08123456789',
            'amount' => 1500,
        ])->assertStatus(422)->assertJsonValidationErrors(['amount']);

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733505',
            'customer_no' => '08123456789',
            'amount' => 500001,
        ])->assertStatus(422);
    }

    public function test_rejects_fixed_denomination_prepaid_sku(): void
    {
        $fixed = Product::create([
            'product_category_id' => $this->product->product_category_id,
            'provider_id' => $this->product->provider_id,
            'product_provider_id' => $this->digi?->id,
            'sku_code' => 'DANA50',
            'name' => 'TOP UP DANA Rp50.000',
            'base_price' => 50000,
            'sell_price' => 50500,
            'admin_fee' => 500,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $fixed->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'DANA50',
            'base_price' => 50000,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'DANA50',
            'customer_no' => '08123456789',
            'amount' => 50000,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['sku_code']);
    }

    public function test_providers_summary_canonicalizes_go_pay_and_exposes_limits(): void
    {
        $catId = $this->product->product_category_id;

        $goPay = Provider::create(['name' => 'GoPay', 'is_active' => true]);
        $goPaySpaced = Provider::create(['name' => 'GO PAY', 'is_active' => true]);

        $open = Product::create([
            'product_category_id' => $catId,
            'provider_id' => $goPay->id,
            'product_provider_id' => $this->digi?->id,
            'sku_code' => 'post733505',
            'name' => 'Gopay Bebas Nominal',
            'base_price' => 0,
            'sell_price' => 1500,
            'admin_fee' => 1500,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $open->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'post733505',
            'base_price' => 0,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        // Prepaid under spaced name — must not create a second customer-facing GoPay.
        $prepaid = Product::create([
            'product_category_id' => $catId,
            'provider_id' => $goPaySpaced->id,
            'product_provider_id' => $this->digi?->id,
            'sku_code' => 'go100',
            'name' => 'Go Pay 100.000',
            'base_price' => 100000,
            'sell_price' => 103000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $prepaid->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'go100',
            'base_price' => 100000,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/products/providers?category=topup-digital');
        $response->assertOk();

        $rows = collect($response->json('data') ?? []);
        $gopayRows = $rows->filter(fn ($r) => strcasecmp((string) ($r['name'] ?? ''), 'GoPay') === 0);
        $this->assertCount(1, $gopayRows);
        $row = $gopayRows->first();
        $this->assertTrue((bool) ($row['is_open_amount'] ?? false));
        $this->assertSame('post733505', $row['sku_code'] ?? null);
        $this->assertSame(1000, $row['min_amount'] ?? null);
        $this->assertSame(500000, $row['max_amount'] ?? null);
    }

    public function test_ewallet_inquiry_sends_client_amount(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQEWALLET001',
                    'customer_no' => '08123456789',
                    'customer_name' => 'REZA ADITYA',
                    'buyer_sku_code' => 'post733506',
                    'admin' => 1500,
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'price' => 25000,
                    'selling_price' => 26500,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733506',
            'customer_no' => '08123456789',
            'amount' => 25000,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.nominal_amount', 25000)
            ->assertJsonPath('data.is_ewallet', true);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'inq-pasca'
                && ($body['buyer_sku_code'] ?? null) === 'post733506'
                && (int) ($body['amount'] ?? 0) === 25000;
        });
    }

    public function test_ewallet_pay_uses_same_inquiry_ref_and_debits_selling_price(): void
    {
        $inquiryRef = 'GNQEWALLETREF99';

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::sequence()
                ->push([
                    'data' => [
                        'ref_id' => $inquiryRef,
                        'customer_no' => '08123456789',
                        'customer_name' => 'REZA ADITYA',
                        'buyer_sku_code' => 'post733506',
                        'admin' => 1500,
                        'message' => 'Transaksi Sukses',
                        'status' => 'Sukses',
                        'rc' => '00',
                        'price' => 25000,
                        'selling_price' => 26500,
                    ],
                ], 200)
                ->push([
                    'data' => [
                        'ref_id' => $inquiryRef,
                        'customer_no' => '08123456789',
                        'customer_name' => 'REZA ADITYA',
                        'buyer_sku_code' => 'post733506',
                        'admin' => 1500,
                        'message' => 'Transaksi Sukses',
                        'status' => 'Sukses',
                        'rc' => '00',
                        'sn' => '81723918239123',
                        'price' => 25000,
                        'selling_price' => 26500,
                    ],
                ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $inq = $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'post733506',
            'customer_no' => '08123456789',
            'amount' => 25000,
        ])->assertOk();

        $refId = $inq->json('data.inquiry_ref_id');
        $this->assertNotEmpty($refId);

        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'post733506',
            '08123456789',
            '123456',
            $refId
        );

        $this->assertEquals(26500.0, (float) $transaction->total_payment);
        $this->assertSame($refId, $transaction->provider_ref);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);
    }
}
