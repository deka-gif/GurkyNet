<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use App\Services\ProductProviders\DigiflazzProductProviderAdapter;
use App\Services\ProductProviders\DigiflazzResponseCodeClassifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DigiflazzResponseCodeAuditTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory);

        config([
            'services.digiflazz.username' => 'buyer-user',
            'services.digiflazz.api_key' => 'buyer-key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
        ]);

        $this->user = User::create([
            'name' => 'RC Audit User',
            'email' => 'rc-audit@example.com',
            'phone_number' => '081222233355',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104288800099',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $digi = ProductProvider::digiflazz();
        $this->assertNotNull($digi);
        $digi->update(['is_active' => true, 'partner_status' => 'online', 'api_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-rc', 'icon' => 'phone', 'is_active' => true]);
        $brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);
        $this->product = Product::create([
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
    }

    protected function makeTx(array $overrides = []): Transaction
    {
        $tx = Transaction::create(array_merge([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-RC-'.uniqid(),
            'service_name' => 'XL 25',
            'target_number' => '087800001233',
            'amount' => 26000,
            'admin_fee' => 0,
            'total_payment' => 26000,
            'payment_method' => 'wallet',
            'status' => 'processing',
            'fulfillment_provider_code' => 'digiflazz',
            'provider_sku_used' => 'xld25',
            'provider_ref' => null,
        ], $overrides));

        if (! array_key_exists('provider_ref', $overrides)) {
            $tx->forceFill(['provider_ref' => $tx->invoice_number])->save();
        }

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => 'xld25',
            'product_name' => 'XL 25',
            'price' => 26000,
            'quantity' => 1,
        ]);

        return $tx->fresh(['items']);
    }

    public function test_fulfill_success_uses_status_and_rc_00(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GRK-RC-OK',
                    'status' => 'Sukses',
                    'message' => 'Transaksi Sukses',
                    'rc' => '00',
                    'sn' => 'SN-OK',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx(['invoice_number' => 'GRK-RC-OK', 'provider_ref' => 'GRK-RC-OK']);
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill($tx, 'xld25', '081234567890', 'GRK-RC-OK');

        $this->assertSame('success', $result->status);
        $this->assertTrue($result->ok);
        $this->assertFalse($result->shouldFailover);
        $this->assertSame('SN-OK', $result->sn);
    }

    public function test_fulfill_pending_rc_03(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => ['status' => 'Pending', 'rc' => '03', 'message' => 'Transaksi Pending'],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill($tx, 'xld25', '081234567890', (string) $tx->provider_ref);

        $this->assertSame('pending', $result->status);
        $this->assertTrue($result->ok);
        $this->assertFalse($result->shouldFailover);
        $this->assertSame('pending', $result->reason);
    }

    public function test_fulfill_auth_failure_rc_41_not_message_heuristic(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Nomor salah / tidak terdaftar',
                    'rc' => '41',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill($tx, 'xld25', '081234567890', (string) $tx->provider_ref);

        $this->assertSame('failed', $result->status);
        $this->assertSame('authentication_failure', $result->reason);
        $this->assertTrue($result->shouldFailover);
        $this->assertFalse(DigiflazzResponseCodeClassifier::classify('41')->transactionCreated());
    }

    public function test_fulfill_validation_rc_54_no_failover(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'timeout maintenance gangguan server',
                    'rc' => '54',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill($tx, 'xld25', '081234567890', (string) $tx->provider_ref);

        $this->assertSame('failed', $result->status);
        $this->assertSame('customer_validation', $result->reason);
        $this->assertFalse($result->shouldFailover);
    }

    public function test_fulfill_provider_issue_rc_55_failovers(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Produk Sedang Gangguan',
                    'rc' => '55',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill($tx, 'xld25', '081234567890', (string) $tx->provider_ref);

        $this->assertSame('failed', $result->status);
        $this->assertTrue($result->shouldFailover);
        $this->assertSame('provider_maintenance', $result->reason);
    }

    public function test_fulfill_refund_rc_74(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Transaksi Refund',
                    'rc' => '74',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill($tx, 'xld25', '081234567890', (string) $tx->provider_ref);

        $this->assertSame('failed', $result->status);
        $this->assertSame('digiflazz_refund', $result->reason);
        $this->assertFalse($result->shouldFailover);
        $this->assertTrue(DigiflazzResponseCodeClassifier::classify('74')->isRefundable());
        $this->assertTrue(DigiflazzResponseCodeClassifier::classify('74')->transactionCreated());
    }

    public function test_fulfill_rate_limit_rc_85(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'limitasi transaksi',
                    'rc' => '85',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill($tx, 'xld25', '081234567890', (string) $tx->provider_ref);

        $this->assertSame('failed', $result->status);
        $this->assertSame('rate_limited', $result->reason);
        $this->assertTrue($result->shouldFailover);
    }

    public function test_fulfill_unknown_rc_does_not_crash(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Future RC',
                    'rc' => '199',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill($tx, 'xld25', '081234567890', (string) $tx->provider_ref);

        $this->assertSame('failed', $result->status);
        $this->assertFalse($result->shouldFailover);
        $c = DigiflazzResponseCodeClassifier::classify('199');
        $this->assertTrue($c->isUnknown());
        $this->assertSame('199', $c->code);
    }

    public function test_check_status_failed_uses_rc_reason_without_failover(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Transaksi Refund',
                    'rc' => '74',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx(['invoice_number' => 'GRK-RC-ST', 'provider_ref' => 'GRK-RC-ST']);
        $result = app(DigiflazzProductProviderAdapter::class)->checkStatus(
            $tx,
            'xld25',
            '081234567890',
            'GRK-RC-ST'
        );

        $this->assertSame('failed', $result->status);
        $this->assertSame('digiflazz_refund', $result->reason);
        $this->assertFalse($result->shouldFailover);
    }

    public function test_transaction_created_false_auth_vs_true_failed(): void
    {
        $auth = DigiflazzResponseCodeClassifier::classify('42');
        $failed = DigiflazzResponseCodeClassifier::classify('02');

        $this->assertFalse($auth->transactionCreated());
        $this->assertFalse($auth->isRefundable());

        $this->assertTrue($failed->transactionCreated());
        $this->assertTrue($failed->isRefundable());
    }

    public function test_deprecated_rc_still_recognized_in_adapter_path(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Limit saldo seller',
                    'rc' => '56',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill($tx, 'xld25', '081234567890', (string) $tx->provider_ref);

        $this->assertSame('failed', $result->status);
        $this->assertTrue(DigiflazzResponseCodeClassifier::classify('56')->isDeprecated());
        $this->assertFalse($result->shouldFailover);
    }

    public function test_official_pdf_columns_exposed_for_all_catalog_rcs(): void
    {
        foreach (array_keys(DigiflazzResponseCodeClassifier::catalog()) as $rcKey) {
            $rc = DigiflazzResponseCodeClassifier::normalize($rcKey);
            $this->assertNotNull($rc);
            $meta = DigiflazzResponseCodeClassifier::classify($rc)->toOfficialMetadata();
            $this->assertSame($rc, $meta['rc']);
            $this->assertNotSame('', $meta['message']);
            $this->assertContains($meta['status'], ['Sukses', 'Pending', 'Gagal']);
            $this->assertIsBool($meta['transaction_created']);
            $this->assertIsString($meta['deskripsi']);
        }

        $unknown = DigiflazzResponseCodeClassifier::classify('199')->toOfficialMetadata();
        $this->assertSame('199', $unknown['rc']);
        $this->assertSame('Gagal', $unknown['status']);
        $this->assertFalse($unknown['transaction_created']);
    }
}
