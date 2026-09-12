<?php

namespace Tests\Feature;

use App\Actions\Transaction\CreateTransactionAction;
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
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Digi category split: Voucher ↔ Tembak/Elektronik; Aktivasi Voucher ↔ Fisik.
 */
class VoucherInternetDigiCategoryGateTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;
    protected ProductCategory $viCategory;
    protected Provider $provider;
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
        $this->digi?->update(['is_active' => true, 'api_status' => 'online']);

        $this->user = User::create([
            'name' => 'VI Gate User',
            'email' => 'vigate@gurkypay.com',
            'phone_number' => '081299900011',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000099',
            'balance' => 500000.00,
            'status' => 'active',
        ]);

        $this->viCategory = ProductCategory::create([
            'name' => 'Voucher Internet',
            'slug' => 'voucher-internet',
            'icon' => 'wifi',
        ]);

        $this->provider = Provider::create([
            'name' => 'Telkomsel',
            'logo' => null,
            'is_active' => true,
        ]);
    }

    protected function makeViProduct(string $sku, string $name, string $digiCategory, string $type = 'Umum'): Product
    {
        $product = Product::create([
            'product_category_id' => $this->viCategory->id,
            'provider_id' => $this->provider->id,
            'product_provider_id' => $this->digi?->id,
            'sku_code' => $sku,
            'name' => $name,
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
            'zone_label' => $type === 'Umum' ? null : $type,
        ]);

        DigiflazzProduct::create([
            'buyer_sku_code' => $sku,
            'list_type' => 'prepaid',
            'product_name' => $name,
            'category' => $digiCategory,
            'brand' => 'TELKOMSEL',
            'type' => $type,
            'seller_name' => 'Test Seller',
            'seller_price' => 10000,
            'buyer_product_status' => true,
            'seller_product_status' => true,
            'unlimited_stock' => true,
            'stock' => '0',
            'multi' => true,
            'desc' => $digiCategory === 'Aktivasi Voucher'
                ? 'Aktivasi Voucher fisik — perhatikan zona'
                : 'Voucher paket internet',
        ]);

        if ($this->digi) {
            ProductProviderSku::create([
                'product_id' => $product->id,
                'product_provider_id' => $this->digi->id,
                'provider_sku' => $sku,
                'base_price' => 10000,
                'is_preferred' => true,
                'is_active' => true,
            ]);
        }

        return $product;
    }

    public function test_catalog_vi_mode_fisik_returns_only_aktivasi_voucher(): void
    {
        $this->makeViProduct('preVOUCHER1', 'Voucher Telkomsel 1GB', 'Voucher');
        $this->makeViProduct('preAKTIVASI1', 'Aktivasi Voucher Telkomsel 1GB (Jawa Barat)', 'Aktivasi Voucher', 'Jawa Barat');

        Sanctum::actingAs($this->user);

        $fisik = $this->getJson('/api/v1/products?category=voucher-internet&vi_mode=fisik&per_page=50');
        $fisik->assertOk();
        $codes = collect($fisik->json('data'))->pluck('code')->all();
        $this->assertContains('preAKTIVASI1', $codes);
        $this->assertNotContains('preVOUCHER1', $codes);

        $tembak = $this->getJson('/api/v1/products?category=voucher-internet&vi_mode=tembak&per_page=50');
        $tembak->assertOk();
        $codesT = collect($tembak->json('data'))->pluck('code')->all();
        $this->assertContains('preVOUCHER1', $codesT);
        $this->assertNotContains('preAKTIVASI1', $codesT);
    }

    public function test_transactions_reject_aktivasi_voucher_sku(): void
    {
        $this->makeViProduct('preAKTIVASI2', 'Aktivasi Voucher Telkomsel 2GB', 'Aktivasi Voucher', 'Jabodetabek');

        Sanctum::actingAs($this->user);

        $this->expectException(\Illuminate\Validation\ValidationException::class);

        resolve(CreateTransactionAction::class)->execute(
            $this->user,
            'preAKTIVASI2',
            '081812345678',
            '123456'
        );
    }

    public function test_physical_batch_rejects_regular_voucher_sku(): void
    {
        $this->makeViProduct('preVOUCHER2', 'Voucher Telkomsel 2GB', 'Voucher');

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/voucher-internet/physical-batches', [
            'sku_code' => 'preVOUCHER2',
            'serials' => [['serial_number' => 'SN1234567890']],
            'pin' => '123456',
            'idempotency_key' => 'vi-gate-fisik-reject-1',
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString(
            'Aktivasi Voucher',
            (string) collect($response->json('errors'))->flatten()->first()
                ?: (string) $response->json('message')
        );
    }

    public function test_physical_batch_accepts_aktivasi_voucher_sku_gate(): void
    {
        $this->makeViProduct('preAKTIVASI3', 'Aktivasi Voucher Telkomsel 0.5GB', 'Aktivasi Voucher', 'Sulawesi Zona 3');

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'BATCHREF1',
                    'customer_no' => 'SNACCEPT01',
                    'buyer_sku_code' => 'preAKTIVASI3',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'ACT-OK',
                    'price' => 10000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/voucher-internet/physical-batches', [
            'sku_code' => 'preAKTIVASI3',
            'serials' => [['serial_number' => 'SNACCEPT01']],
            'pin' => '123456',
            'idempotency_key' => 'vi-gate-fisik-ok-1',
        ]);

        $response->assertStatus(201);
    }
}
