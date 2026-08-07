<?php

namespace Tests\Feature;

use App\Actions\Transaction\CreateTransactionAction;
use App\Jobs\ProcessProductProviderTransaction;
use App\Models\DigiflazzTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use App\Services\DigiflazzService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TagihanPascaFlowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory());

        config([
            'services.digiflazz.username' => 'gurky_test_user',
            'services.digiflazz.api_key' => 'gurky_test_key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
            'services.digiflazz.testing' => null,
        ]);

        ProductProvider::digiflazz()?->update([
            'is_active' => true,
            'api_status' => 'online',
        ]);

        $this->user = User::create([
            'name' => 'Tagihan User',
            'email' => 'tagihan@gurkypay.com',
            'phone_number' => '081298765432',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000099',
            'balance' => 500000.00,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'PDAM',
            'slug' => 'pdam',
            'icon' => 'droplets',
        ]);

        $provider = Provider::create([
            'name' => 'PDAM Kota Surabaya',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'PDAMSURABAYA',
            'name' => 'PDAM Kota Surabaya',
            'base_price' => 0,
            'sell_price' => 0,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    public function test_inquiry_uses_inq_pasca_and_returns_provider_fields(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQTESTREF001',
                    'customer_no' => '5123456789',
                    'customer_name' => 'BUDI SANTOSO',
                    'buyer_sku_code' => 'PDAMSURABAYA',
                    'admin' => 2500,
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'price' => 125000,
                    'selling_price' => 127500,
                    'desc' => [
                        'lembar_tagihan' => 1,
                        'detail' => [
                            [
                                'periode' => '202608',
                                'nilai_tagihan' => '125000',
                                'admin' => '2500',
                                'denda' => '0',
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/tagihan/inquiry', [
            'sku_code' => 'PDAMSURABAYA',
            'customer_no' => '5123456789',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.customer_name', 'BUDI SANTOSO')
            ->assertJsonPath('data.customer_no', '5123456789')
            ->assertJsonPath('data.bill_amount', 125000)
            ->assertJsonPath('data.admin_fee', 2500)
            ->assertJsonPath('data.selling_price', 127500);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'inq-pasca'
                && ($body['buyer_sku_code'] ?? null) === 'PDAMSURABAYA'
                && ($body['customer_no'] ?? null) === '5123456789'
                && !empty($body['ref_id']);
        });
    }

    public function test_inquiry_failure_from_provider_does_not_debit_wallet(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQFAIL',
                    'customer_no' => '000',
                    'status' => 'Gagal',
                    'message' => 'Nomor pelanggan tidak ditemukan',
                    'rc' => '14',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $response = $this->postJson('/api/v1/tagihan/inquiry', [
            'sku_code' => 'PDAMSURABAYA',
            'customer_no' => '000',
        ]);

        $response->assertStatus(422);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_inquiry_failure_uses_rc_message_when_provider_message_empty(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQRC54',
                    'customer_no' => '000',
                    'status' => 'Gagal',
                    'message' => '',
                    'rc' => '54',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/tagihan/inquiry', [
            'sku_code' => 'PDAMSURABAYA',
            'customer_no' => '000',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['inquiry']);
        $this->assertStringContainsString(
            'Nomor Tujuan Salah',
            (string) data_get($response->json(), 'errors.inquiry.0')
        );
    }

    public function test_pay_pasca_uses_same_inquiry_ref_and_debits_selling_price(): void
    {
        $inquiryRef = 'GNQSAMEREFID99';

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::sequence()
                ->push([
                    'data' => [
                        'ref_id' => $inquiryRef,
                        'customer_no' => '5123456789',
                        'customer_name' => 'BUDI SANTOSO',
                        'buyer_sku_code' => 'PDAMSURABAYA',
                        'admin' => 2500,
                        'message' => 'Transaksi Sukses',
                        'status' => 'Sukses',
                        'rc' => '00',
                        'price' => 125000,
                        'selling_price' => 127500,
                        'desc' => [
                            'lembar_tagihan' => 1,
                            'detail' => [
                                [
                                    'periode' => '202608',
                                    'nilai_tagihan' => '125000',
                                    'admin' => '2500',
                                ],
                            ],
                        ],
                    ],
                ], 200)
                ->push([
                    'data' => [
                        'ref_id' => $inquiryRef,
                        'customer_no' => '5123456789',
                        'customer_name' => 'BUDI SANTOSO',
                        'buyer_sku_code' => 'PDAMSURABAYA',
                        'admin' => 2500,
                        'message' => 'Transaksi Sukses',
                        'status' => 'Sukses',
                        'rc' => '00',
                        'sn' => 'REF-BILLER-998877',
                        'price' => 125000,
                        'selling_price' => 127500,
                    ],
                ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $inq = $this->postJson('/api/v1/tagihan/inquiry', [
            'sku_code' => 'PDAMSURABAYA',
            'customer_no' => '5123456789',
        ])->assertOk();

        $refId = $inq->json('data.inquiry_ref_id');
        $this->assertNotEmpty($refId);

        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'PDAMSURABAYA',
            '5123456789',
            '123456',
            $refId
        );

        $this->assertEquals(127500.0, (float) $transaction->total_payment);
        $this->assertEquals(2500.0, (float) $transaction->admin_fee);
        $this->assertSame($refId, $transaction->provider_ref);
        $this->assertEquals(500000.0 - 127500.0, (float) $this->wallet->fresh()->balance);

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(!empty($meta['is_pasca']));
        $this->assertSame($refId, $meta['inquiry_ref_id'] ?? null);

        // Run fulfillment (pay-pasca)
        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);
        $this->assertStringContainsString('REF-BILLER-998877', (string) $transaction->notes);

        $digi = DigiflazzTransaction::where('transaction_id', $transaction->id)->first();
        $this->assertNotNull($digi);
        $this->assertSame($refId, $digi->ref_id);

        $payCalls = 0;
        Http::assertSent(function ($request) use ($refId, &$payCalls) {
            $body = $request->data();
            if (($body['commands'] ?? null) === 'pay-pasca') {
                $payCalls++;
                return ($body['ref_id'] ?? null) === $refId
                    && ($body['buyer_sku_code'] ?? null) === 'PDAMSURABAYA';
            }

            return true;
        });
        $this->assertGreaterThanOrEqual(1, $payCalls);
    }

    public function test_digiflazz_service_inquiry_includes_inq_pasca_command(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Sukses']], 200),
        ]);

        $service = resolve(DigiflazzService::class);
        $service->inquiryPasca('PDAMSURABAYA', '5123456789', 'REF123');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'inq-pasca'
                && ($body['ref_id'] ?? null) === 'REF123'
                && ! array_key_exists('testing', $body);
        });
    }

    public function test_inquiry_pasca_omits_testing_by_default(): void
    {
        config(['services.digiflazz.testing' => null]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Sukses']], 200),
        ]);

        resolve(DigiflazzService::class)->inquiryPasca('PDAMSURABAYA', '5123456789', 'REF-NO-TEST');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'inq-pasca'
                && ! array_key_exists('testing', $body);
        });
    }

    public function test_inquiry_pasca_includes_testing_when_config_enabled(): void
    {
        config(['services.digiflazz.testing' => 'true']);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Sukses']], 200),
        ]);

        resolve(DigiflazzService::class)->inquiryPasca('PDAMSURABAYA', '5123456789', 'REF-TEST-CFG');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'inq-pasca'
                && ($body['testing'] ?? null) === true;
        });
    }

    public function test_inquiry_pasca_includes_testing_when_option_override_true(): void
    {
        config(['services.digiflazz.testing' => null]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Sukses']], 200),
        ]);

        resolve(DigiflazzService::class)->inquiryPasca(
            'PDAMSURABAYA',
            '5123456789',
            'REF-TEST-OPT',
            null,
            null,
            ['testing' => true]
        );

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'inq-pasca'
                && ($body['testing'] ?? null) === true;
        });
    }

    public function test_resolve_optional_inquiry_fields_matches_topup_testing_flag_rules(): void
    {
        $service = resolve(DigiflazzService::class);

        config(['services.digiflazz.testing' => null]);
        $this->assertSame([], $service->resolveOptionalInquiryFields());

        config(['services.digiflazz.testing' => 'false']);
        $this->assertSame([], $service->resolveOptionalInquiryFields());

        config(['services.digiflazz.testing' => '1']);
        $this->assertSame(['testing' => true], $service->resolveOptionalInquiryFields());

        config(['services.digiflazz.testing' => null]);
        $this->assertSame(['testing' => true], $service->resolveOptionalInquiryFields(['testing' => true]));
        $this->assertSame([], $service->resolveOptionalInquiryFields(['testing' => false]));
    }

    public function test_pay_pasca_omits_testing_by_default(): void
    {
        config(['services.digiflazz.testing' => null]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Sukses']], 200),
        ]);

        resolve(DigiflazzService::class)->payPasca('PDAMSURABAYA', '5123456789', 'REF-PAY-NO-TEST');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'pay-pasca'
                && ! array_key_exists('testing', $body);
        });
    }

    public function test_pay_pasca_includes_testing_when_config_enabled(): void
    {
        config(['services.digiflazz.testing' => true]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Sukses']], 200),
        ]);

        resolve(DigiflazzService::class)->payPasca('PDAMSURABAYA', '5123456789', 'REF-PAY-TEST');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'pay-pasca'
                && ($body['testing'] ?? null) === true;
        });
    }

    public function test_pay_pasca_includes_testing_when_option_override_true(): void
    {
        config(['services.digiflazz.testing' => null]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Sukses']], 200),
        ]);

        resolve(DigiflazzService::class)->payPasca(
            'PDAMSURABAYA',
            '5123456789',
            'REF-PAY-OPT',
            ['testing' => true]
        );

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'pay-pasca'
                && ($body['testing'] ?? null) === true;
        });
    }

    public function test_pay_rejected_when_inquiry_date_differs_and_digiflazz_not_called(): void
    {
        $inquiryRef = 'GNQDAYMISMATCH01';

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => $inquiryRef,
                    'customer_no' => '5123456789',
                    'customer_name' => 'BUDI SANTOSO',
                    'buyer_sku_code' => 'PDAMSURABAYA',
                    'admin' => 2500,
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'price' => 125000,
                    'selling_price' => 127500,
                    'desc' => [
                        'lembar_tagihan' => 1,
                        'detail' => [
                            ['periode' => '202608', 'nilai_tagihan' => '125000', 'admin' => '2500'],
                        ],
                    ],
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        // Inquire late in the day so TTL (15m) still covers shortly after midnight.
        $this->travelTo(now()->timezone(config('app.timezone'))->copy()->startOfDay()->setTime(23, 50, 0));

        $inq = $this->postJson('/api/v1/tagihan/inquiry', [
            'sku_code' => 'PDAMSURABAYA',
            'customer_no' => '5123456789',
        ])->assertOk();

        $refId = $inq->json('data.inquiry_ref_id');
        $this->assertNotEmpty($refId);

        $before = (float) $this->wallet->fresh()->balance;

        // Next calendar day, still within session TTL — Digiflazz same-day rule must block.
        $this->travelTo(now()->timezone(config('app.timezone'))->copy()->addDay()->startOfDay()->setTime(0, 1, 0));

        $create = resolve(CreateTransactionAction::class);

        try {
            $create->execute(
                $this->user,
                'PDAMSURABAYA',
                '5123456789',
                '123456',
                $refId
            );
            $this->fail('Expected ValidationException for cross-day pay-pasca.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->assertStringContainsString(
                'tanggal yang sama',
                collect($e->errors())->flatten()->first() ?? ''
            );
        }

        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);

        Http::assertNotSent(function ($request) {
            return ($request->data()['commands'] ?? null) === 'pay-pasca';
        });
    }

    public function test_same_day_pay_still_allowed_within_ttl(): void
    {
        $inquiryRef = 'GNQSAMEDAYOK01';

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::sequence()
                ->push([
                    'data' => [
                        'ref_id' => $inquiryRef,
                        'customer_no' => '5123456789',
                        'customer_name' => 'BUDI SANTOSO',
                        'buyer_sku_code' => 'PDAMSURABAYA',
                        'admin' => 2500,
                        'message' => 'Transaksi Sukses',
                        'status' => 'Sukses',
                        'rc' => '00',
                        'price' => 125000,
                        'selling_price' => 127500,
                        'desc' => [
                            'lembar_tagihan' => 1,
                            'detail' => [
                                ['periode' => '202608', 'nilai_tagihan' => '125000', 'admin' => '2500'],
                            ],
                        ],
                    ],
                ], 200)
                ->push([
                    'data' => [
                        'ref_id' => $inquiryRef,
                        'status' => 'Sukses',
                        'sn' => 'SN-SAME-DAY',
                        'rc' => '00',
                    ],
                ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $inq = $this->postJson('/api/v1/tagihan/inquiry', [
            'sku_code' => 'PDAMSURABAYA',
            'customer_no' => '5123456789',
        ])->assertOk();

        $refId = $inq->json('data.inquiry_ref_id');

        // Same calendar day, a few minutes later — still allowed.
        $this->travel(5)->minutes();

        Queue::fake();

        $transaction = resolve(CreateTransactionAction::class)->execute(
            $this->user,
            'PDAMSURABAYA',
            '5123456789',
            '123456',
            $refId
        );

        $this->assertSame($refId, $transaction->provider_ref);
        $this->assertEquals(127500.0, (float) $transaction->total_payment);
    }
}
