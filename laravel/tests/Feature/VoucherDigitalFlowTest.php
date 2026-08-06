<?php

namespace Tests\Feature;

use App\Actions\Transaction\CreateTransactionAction;
use App\Jobs\ProcessProductProviderTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VoucherDigitalFlowTest extends TestCase
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
        ]);

        ProductProvider::digiflazz()?->update([
            'is_active' => true,
            'api_status' => 'online',
        ]);

        $this->user = User::create([
            'name' => 'Voucher User',
            'email' => 'voucher@gurkypay.com',
            'phone_number' => '081255566677',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000066',
            'balance' => 500000.00,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'Voucher Digital',
            'slug' => 'voucher-digital',
            'icon' => 'gift',
        ]);

        $provider = Provider::create([
            'name' => 'Alfamart Voucher',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'ALFA50',
            'name' => 'Voucher Belanja Rp50.000',
            'base_price' => 49000,
            'sell_price' => 49200,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    public function test_voucher_purchase_debits_wallet_and_exposes_provider_code(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGVOUCHER001',
                    'customer_no' => '104200000066',
                    'buyer_sku_code' => 'ALFA50',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'ALFA-9812-3981-2391',
                    'price' => 49000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'ALFA50',
            '104200000066',
            '123456'
        );

        $this->assertEquals(49200.0, (float) $transaction->total_payment);
        $this->assertEquals(500000.0 - 49200.0, (float) $this->wallet->fresh()->balance);

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(!empty($meta['is_voucher']));
        $this->assertSame('Alfamart Voucher', $meta['voucher_brand'] ?? null);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);

        $this->getJson('/api/v1/transactions/' . $transaction->invoice_number . '/receipt')
            ->assertOk()
            ->assertJsonPath('data.transaction_details.is_voucher', true)
            ->assertJsonPath('data.transaction_details.voucher_code', 'ALFA-9812-3981-2391')
            ->assertJsonPath('data.transaction_details.serial_number', 'ALFA-9812-3981-2391')
            ->assertJsonPath('data.transaction_details.is_pln_token', false);
    }

    public function test_voucher_url_sn_is_exposed_as_url(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGVOUCHER002',
                    'customer_no' => '104200000066',
                    'buyer_sku_code' => 'ALFA50',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'https://redeem.example.com/v/xyz789',
                    'price' => 49000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'ALFA50',
            '104200000066',
            '123456'
        );

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $this->getJson('/api/v1/transactions/' . $transaction->invoice_number . '/receipt')
            ->assertOk()
            ->assertJsonPath('data.transaction_details.is_voucher', true)
            ->assertJsonPath('data.transaction_details.voucher_url', 'https://redeem.example.com/v/xyz789')
            ->assertJsonPath('data.transaction_details.voucher_code', null);
    }

    public function test_wrong_pin_does_not_debit_for_voucher(): void
    {
        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $this->expectException(\Illuminate\Validation\ValidationException::class);

        $create = resolve(CreateTransactionAction::class);
        try {
            $create->execute($this->user, 'ALFA50', '104200000066', '000000');
        } finally {
            $this->assertSame($before, (float) $this->wallet->fresh()->balance);
        }
    }
}
