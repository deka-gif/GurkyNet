<?php

namespace Tests\Feature;

use App\Models\DigiflazzTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\DigiflazzService;
use App\Services\ProductProviders\ProductProviderFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DigiflazzTopupAuditTest extends TestCase
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
            'services.digiflazz.testing' => null,
            'services.digiflazz.max_price' => null,
            'services.digiflazz.cb_url' => null,
            'services.digiflazz.allow_dot' => null,
        ]);
    }

    public function test_normal_buy_request_has_required_fields_only(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'REF-1',
                    'customer_no' => '087800001233',
                    'buyer_sku_code' => 'xld25',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'SN1',
                    'price' => 25000,
                ],
            ], 200),
        ]);

        app(DigiflazzService::class)->buy('xld25', '087800001233', 'REF-1');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return $request->url() === 'https://api.digiflazz.com/v1/transaction'
                && $request->method() === 'POST'
                && ($body['username'] ?? null) === 'buyer-user'
                && ($body['buyer_sku_code'] ?? null) === 'xld25'
                && ($body['customer_no'] ?? null) === '087800001233'
                && ($body['ref_id'] ?? null) === 'REF-1'
                && ($body['sign'] ?? null) === md5('buyer-user'.'buyer-key'.'REF-1')
                && ! array_key_exists('testing', $body)
                && ! array_key_exists('max_price', $body)
                && ! array_key_exists('cb_url', $body)
                && ! array_key_exists('allow_dot', $body);
        });
    }

    public function test_buy_request_with_testing_true(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Pending', 'rc' => '03']], 200),
        ]);

        app(DigiflazzService::class)->buy('xld25', '087800001233', 'REF-T', [
            'testing' => true,
        ]);

        Http::assertSent(fn ($request) => ($request->data()['testing'] ?? null) === true);
    }

    public function test_buy_request_with_max_price(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Pending', 'rc' => '03']], 200),
        ]);

        app(DigiflazzService::class)->buy('xld25', '087800001233', 'REF-M', [
            'max_price' => 26000,
        ]);

        Http::assertSent(fn ($request) => ($request->data()['max_price'] ?? null) === 26000);
    }

    public function test_buy_request_with_cb_url(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Pending', 'rc' => '03']], 200),
        ]);

        app(DigiflazzService::class)->buy('xld25', '087800001233', 'REF-C', [
            'cb_url' => 'https://example.com/hooks/digi',
        ]);

        Http::assertSent(fn ($request) => ($request->data()['cb_url'] ?? null) === 'https://example.com/hooks/digi');
    }

    public function test_buy_request_with_allow_dot(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Pending', 'rc' => '03']], 200),
        ]);

        app(DigiflazzService::class)->buy('xld25', '087800001233', 'REF-D', [
            'allow_dot' => true,
        ]);

        Http::assertSent(fn ($request) => ($request->data()['allow_dot'] ?? null) === true);
    }

    public function test_extract_topup_response_fields_parses_rc_price_saldo_tele_wa(): void
    {
        $fields = DigiflazzService::extractTopupResponseFields([
            'data' => [
                'ref_id' => 'some1d',
                'status' => 'Pending',
                'rc' => '03',
                'sn' => '',
                'buyer_last_saldo' => 100000,
                'price' => 25000,
                'tele' => '@telegram',
                'wa' => '081234512345',
                'message' => 'Transaksi Pending',
            ],
        ]);

        $this->assertSame('03', $fields['rc']);
        $this->assertSame(25000, $fields['price']);
        $this->assertSame(100000.0, $fields['buyer_last_saldo']);
        $this->assertSame('@telegram', $fields['tele']);
        $this->assertSame('081234512345', $fields['wa']);
        $this->assertNull($fields['sn']); // empty string treated as absent
    }

    public function test_extract_topup_response_compatible_with_partial_legacy_payload(): void
    {
        $fields = DigiflazzService::extractTopupResponseFields([
            'data' => [
                'status' => 'Success',
                'message' => 'OK',
                'sn' => 'SN999',
            ],
        ]);

        $this->assertNull($fields['rc']);
        $this->assertNull($fields['price']);
        $this->assertNull($fields['buyer_last_saldo']);
        $this->assertNull($fields['tele']);
        $this->assertNull($fields['wa']);
        $this->assertSame('SN999', $fields['sn']);
    }

    public function test_fulfillment_persists_topup_response_fields_on_success(): void
    {
        Setting::updateOrCreate(['key' => 'default_margin'], ['value' => '1000']);

        $user = User::create([
            'name' => 'Topup User',
            'email' => 'topup@example.com',
            'phone_number' => '081111111111',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $user->id,
            'wallet_number' => '104299900001',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $digi = ProductProvider::digiflazz();
        $this->assertNotNull($digi);
        $digi->update(['is_active' => true, 'partner_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-topup', 'icon' => 'phone', 'is_active' => true]);
        $brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'xld25',
            'name' => 'XL 25',
            'base_price' => 25000,
            'sell_price' => 26000,
            'admin_fee' => 0,
            'status' => true,
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'xld25',
            'is_active' => true,
            'is_preferred' => true,
            'priority' => 1,
            'base_price' => 25000,
        ]);

        $tx = Transaction::create([
            'user_id' => $user->id,
            'invoice_number' => 'GRK-TOPUP-001',
            'service_name' => 'XL 25',
            'target_number' => '087800001233',
            'amount' => 26000,
            'admin_fee' => 0,
            'total_payment' => 26000,
            'payment_method' => 'wallet',
            'status' => 'pending',
            'fulfillment_provider_code' => 'digiflazz',
        ]);
        $tx->items()->create([
            'product_code' => 'xld25',
            'product_name' => 'XL 25',
            'price' => 26000,
            'quantity' => 1,
        ]);

        DigiflazzTransaction::create([
            'transaction_id' => $tx->id,
            'ref_id' => 'GRK-TOPUP-001',
            'buyer_sku_code' => 'xld25',
            'customer_no' => '087800001233',
            'digiflazz_status' => 'pending',
        ]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GRK-TOPUP-001',
                    'customer_no' => '087800001233',
                    'buyer_sku_code' => 'xld25',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'SN-ABC',
                    'buyer_last_saldo' => 500000,
                    'price' => 25000,
                    'tele' => '@seller',
                    'wa' => '08123456789',
                ],
            ], 200),
        ]);

        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items']));

        $mirror = DigiflazzTransaction::where('transaction_id', $tx->id)->first();
        $this->assertNotNull($mirror);
        $this->assertSame('success', $mirror->digiflazz_status);
        $this->assertSame('00', $mirror->rc);
        $this->assertSame(25000, $mirror->price);
        $this->assertEquals(500000, (float) $mirror->buyer_last_saldo);
        $this->assertSame('@seller', $mirror->tele);
        $this->assertSame('08123456789', $mirror->wa);
        $this->assertSame('SN-ABC', $mirror->sn);

        $this->assertSame('success', $tx->fresh()->status);
    }

    public function test_config_optional_fields_are_applied_when_set(): void
    {
        config([
            'services.digiflazz.testing' => 'true',
            'services.digiflazz.max_price' => '27000',
            'services.digiflazz.cb_url' => 'https://hooks.gurky.test/digi',
            'services.digiflazz.allow_dot' => '1',
        ]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response(['data' => ['status' => 'Pending', 'rc' => '03']], 200),
        ]);

        app(DigiflazzService::class)->buy('xld25', '087800001233', 'REF-CFG');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['testing'] ?? null) === true
                && ($body['max_price'] ?? null) === 27000
                && ($body['cb_url'] ?? null) === 'https://hooks.gurky.test/digi'
                && ($body['allow_dot'] ?? null) === true;
        });
    }
}
