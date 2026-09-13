<?php

namespace Tests\Feature;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * API-level Tembak Langsung operator mismatch — backend rejects before Digiflazz.
 */
class VoucherInternetTembakOperatorGuardTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected ProductCategory $viCategory;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Http::swap(new \Illuminate\Http\Client\Factory());
        Http::fake([
            'https://api.digiflazz.com/*' => Http::response(['data' => ['status' => 'Pending']], 200),
        ]);

        ProductProvider::digiflazz()?->update([
            'is_active' => true,
            'api_status' => 'online',
        ]);

        $this->user = User::create([
            'name' => 'Tembak Guard User',
            'email' => 'tembakguard@gurkypay.com',
            'phone_number' => '081255500001',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000088',
            'balance' => 500000.00,
            'status' => 'active',
        ]);

        $this->viCategory = ProductCategory::create([
            'name' => 'Voucher Internet',
            'slug' => 'voucher-internet',
            'icon' => 'wifi',
        ]);
    }

    protected function makeViSku(string $brandName, string $sku): Product
    {
        $provider = Provider::create([
            'name' => $brandName,
            'logo' => null,
            'is_active' => true,
        ]);

        $product = Product::create([
            'product_category_id' => $this->viCategory->id,
            'provider_id' => $provider->id,
            'sku_code' => $sku,
            'name' => $brandName.' VI Test',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        $digi = ProductProvider::digiflazz();
        if ($digi) {
            $product->update(['product_provider_id' => $digi->id]);
            DigiflazzProduct::create([
                'buyer_sku_code' => $sku,
                'list_type' => 'prepaid',
                'product_name' => $brandName.' VI Test',
                'category' => 'Voucher',
                'brand' => $brandName,
                'type' => 'Umum',
                'seller_name' => 'Test',
                'seller_price' => 10000,
                'buyer_product_status' => true,
                'seller_product_status' => true,
                'unlimited_stock' => true,
                'stock' => '0',
                'multi' => true,
                'desc' => 'test',
            ]);
            ProductProviderSku::create([
                'product_id' => $product->id,
                'product_provider_id' => $digi->id,
                'provider_sku' => $sku,
                'base_price' => 10000,
                'is_preferred' => true,
                'is_active' => true,
            ]);
        }

        return $product;
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    protected function postTembak(string $sku, string $target, array $extra = [])
    {
        Sanctum::actingAs($this->user);

        return $this->postJson('/api/v1/transactions', array_merge([
            'sku_code' => $sku,
            'target_number' => $target,
            'pin' => '123456',
            'idempotency_key' => 'idem-tembak-'.uniqid('', true),
            'voucher_internet_mode' => 'tembak',
        ], $extra));
    }

    public function test_rejects_telkomsel_number_with_xl_sku(): void
    {
        $this->makeViSku('XL Axiata', 'XLVI-MISMATCH');
        $before = (float) $this->wallet->fresh()->balance;

        $res = $this->postTembak('XLVI-MISMATCH', '081234567890');

        $res->assertStatus(422);
        $res->assertJsonFragment([
            'message' => 'Nomor terdeteksi Telkomsel, tidak sesuai dengan produk XL. Transaksi dibatalkan.',
        ]);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_rejects_xl_number_with_indosat_sku(): void
    {
        $this->makeViSku('Indosat', 'ISATVI-MISMATCH');
        $before = (float) $this->wallet->fresh()->balance;

        $res = $this->postTembak('ISATVI-MISMATCH', '081812345678');

        $res->assertStatus(422);
        $res->assertJsonFragment([
            'message' => 'Nomor terdeteksi XL, tidak sesuai dengan produk Indosat. Transaksi dibatalkan.',
        ]);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_rejects_tri_number_with_telkomsel_sku(): void
    {
        $this->makeViSku('Telkomsel', 'TSELVI-MISMATCH');
        $before = (float) $this->wallet->fresh()->balance;

        $res = $this->postTembak('TSELVI-MISMATCH', '089512345678');

        $res->assertStatus(422);
        $res->assertJsonFragment([
            'message' => 'Nomor terdeteksi Tri, tidak sesuai dengan produk Telkomsel. Transaksi dibatalkan.',
        ]);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_rejects_unknown_prefix_on_tembak(): void
    {
        $this->makeViSku('Telkomsel', 'TSELVI-UNK');
        $before = (float) $this->wallet->fresh()->balance;

        $res = $this->postTembak('TSELVI-UNK', '080012345678');

        $res->assertStatus(422);
        $res->assertJsonFragment([
            'message' => 'Nomor HP tidak dikenali operatornya. Transaksi Tembak Langsung dibatalkan.',
        ]);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_matching_xl_number_and_sku_still_succeeds(): void
    {
        $this->makeViSku('XL Axiata', 'XLVI-OK');
        $before = (float) $this->wallet->fresh()->balance;

        $res = $this->postTembak('XLVI-OK', '081812345678');

        $res->assertStatus(201);
        $this->assertEqualsWithDelta($before - 11000.0, (float) $this->wallet->fresh()->balance, 0.01);
    }

    public function test_elektronik_wallet_target_is_not_blocked(): void
    {
        $this->makeViSku('XL Axiata', 'XLVI-ELEC');
        $before = (float) $this->wallet->fresh()->balance;

        Sanctum::actingAs($this->user);
        $res = $this->postJson('/api/v1/transactions', [
            'sku_code' => 'XLVI-ELEC',
            'target_number' => '104200000088',
            'pin' => '123456',
            'idempotency_key' => 'idem-tembak-elec-ok',
            'voucher_internet_mode' => 'elektronik',
        ]);

        $res->assertStatus(201);
        $this->assertEqualsWithDelta($before - 11000.0, (float) $this->wallet->fresh()->balance, 0.01);
    }

    public function test_pulsa_mismatch_is_not_in_scope(): void
    {
        $pulsa = ProductCategory::create([
            'name' => 'Pulsa',
            'slug' => 'pulsa',
            'icon' => 'phone',
        ]);
        $xl = Provider::create(['name' => 'XL Axiata', 'logo' => null, 'is_active' => true]);
        Product::create([
            'product_category_id' => $pulsa->id,
            'provider_id' => $xl->id,
            'sku_code' => 'PULSA-XL-SKIP',
            'name' => 'Pulsa XL',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        $before = (float) $this->wallet->fresh()->balance;
        Sanctum::actingAs($this->user);
        $res = $this->postJson('/api/v1/transactions', [
            'sku_code' => 'PULSA-XL-SKIP',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => 'idem-pulsa-not-tembak',
        ]);

        $res->assertStatus(201);
        $this->assertEqualsWithDelta($before - 11000.0, (float) $this->wallet->fresh()->balance, 0.01);
    }
}
