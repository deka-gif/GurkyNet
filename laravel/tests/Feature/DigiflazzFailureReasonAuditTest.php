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
use App\Services\ProductProviders\DigiflazzFailureReasonCatalog;
use App\Services\ProductProviders\DigiflazzProductProviderAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DigiflazzFailureReasonAuditTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

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
            'name' => 'Failure Reason User',
            'email' => 'failure-reason@example.com',
            'phone_number' => '081222233366',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104288800088',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $digi = ProductProvider::digiflazz();
        $this->assertNotNull($digi);
        $digi->update(['is_active' => true, 'partner_status' => 'online', 'api_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-fr', 'icon' => 'phone', 'is_active' => true]);
        $brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);
        Product::create([
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
            'invoice_number' => 'GRK-FR-'.uniqid(),
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

    public function test_rc_priority_over_misleading_failure_message(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Nomor Tujuan Salah',
                    'rc' => '41',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $tx,
            'xld25',
            '081234567890',
            (string) $tx->provider_ref
        );

        $this->assertSame('authentication_failure', $result->reason);
        $this->assertTrue($result->shouldFailover);
        $this->assertFalse(DigiflazzFailureReasonCatalog::resolveTransactionCreated([
            'rc' => '41',
            'message' => 'Nomor Tujuan Salah',
        ]));
    }

    public function test_fallback_koneksi_belum_didukung_without_rc(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Koneksi belum didukung',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $tx,
            'xld25',
            '081234567890',
            (string) $tx->provider_ref
        );

        $this->assertSame('failed', $result->status);
        $this->assertSame('unknown_configuration', $result->reason);
        $this->assertFalse($result->shouldFailover);
    }

    public function test_fallback_saldo_seller_digiflazz_habis_without_rc(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Saldo Seller Digiflazz Habis',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $tx,
            'xld25',
            '081234567890',
            (string) $tx->provider_ref
        );

        $this->assertSame('provider_seller_balance', $result->reason);
        $this->assertTrue($result->shouldFailover);
        $this->assertTrue(DigiflazzFailureReasonCatalog::resolveTransactionCreated([
            'message' => 'Saldo Seller Digiflazz Habis',
        ]));
    }

    public function test_fallback_produk_gangguan_non_aktif_without_rc(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Produk sedang Gangguan (Non Aktif)',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $tx,
            'xld25',
            '081234567890',
            (string) $tx->provider_ref
        );

        $this->assertTrue($result->shouldFailover);
        $this->assertSame('provider_maintenance', $result->reason);
        $this->assertFalse(DigiflazzFailureReasonCatalog::findByMessage('Produk sedang Gangguan (Non Aktif)')->transactionCreated());
    }

    public function test_fallback_nomor_tujuan_salah_is_customer_validation(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Nomor Tujuan Salah',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $tx,
            'xld25',
            '081234567890',
            (string) $tx->provider_ref
        );

        $this->assertSame('customer_validation', $result->reason);
        $this->assertFalse($result->shouldFailover);
        $this->assertTrue(DigiflazzFailureReasonCatalog::resolveTransactionCreated([
            'message' => 'Nomor Tujuan Salah',
        ]));
    }

    public function test_fallback_transaksi_refund_without_rc(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Transaksi Refund',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $tx,
            'xld25',
            '081234567890',
            (string) $tx->provider_ref
        );

        $this->assertSame('digiflazz_refund', $result->reason);
        $this->assertFalse($result->shouldFailover);
        $this->assertTrue(DigiflazzFailureReasonCatalog::findByMessage('Transaksi Refund')->shouldRefund());
    }

    public function test_substring_heuristic_no_longer_classifies_unmapped_gangguan_as_maintenance_without_catalog(): void
    {
        // Unmapped free-text — must not use old substring "gangguan" → provider_maintenance path.
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Random gangguan internal XYZ',
                ],
            ], 200),
        ]);

        $tx = $this->makeTx();
        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $tx,
            'xld25',
            '081234567890',
            (string) $tx->provider_ref
        );

        $this->assertSame('provider_rejected', $result->reason);
        $this->assertFalse($result->shouldFailover);
    }
}
