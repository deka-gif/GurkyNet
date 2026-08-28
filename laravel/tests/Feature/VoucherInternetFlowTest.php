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

class VoucherInternetFlowTest extends TestCase
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
            'name' => 'Voucher Internet User',
            'email' => 'voucherinternet@gurkypay.com',
            'phone_number' => '081255566688',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000077',
            'balance' => 500000.00,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'Voucher Internet',
            'slug' => 'voucher-internet',
            'icon' => 'wifi',
        ]);

        $provider = Provider::create([
            'name' => 'XL Axiata',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'XLVI5GB',
            'name' => 'Voucher Internet XL 5GB',
            'base_price' => 24000,
            'sell_price' => 24500,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    public function test_tembak_langsung_purchase_debits_wallet_and_flags_voucher_internet(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGVI001',
                    'customer_no' => '081812345678',
                    'buyer_sku_code' => 'XLVI5GB',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'Sukses. Kuota 5GB telah ditambahkan.',
                    'price' => 24000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'XLVI5GB',
            '081812345678',
            '123456'
        );

        $this->assertEquals(24500.0, (float) $transaction->total_payment);
        $this->assertEquals(500000.0 - 24500.0, (float) $this->wallet->fresh()->balance);

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(!empty($meta['is_voucher_internet']));
        $this->assertSame('XL Axiata', $meta['voucher_brand'] ?? null);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);

        $this->getJson('/api/v1/transactions/' . $transaction->invoice_number . '/receipt')
            ->assertOk()
            ->assertJsonPath('data.transaction_details.is_voucher_internet', true)
            ->assertJsonPath('data.transaction_details.target_number', '081812345678');
    }

    public function test_voucher_elektronik_purchase_exposes_redeemable_code_on_receipt(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGVI002',
                    'customer_no' => '104200000077',
                    'buyer_sku_code' => 'XLVI5GB',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'XL-VI-8842-1193-7765',
                    'price' => 24000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        // Voucher Elektronik has no real target number — the wallet number stands in,
        // matching how VoucherInternetPage.tsx submits this mode.
        $transaction = $create->execute(
            $this->user,
            'XLVI5GB',
            '104200000077',
            '123456'
        );

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $this->getJson('/api/v1/transactions/' . $transaction->invoice_number . '/receipt')
            ->assertOk()
            ->assertJsonPath('data.transaction_details.is_voucher_internet', true)
            ->assertJsonPath('data.transaction_details.voucher_internet_code', 'XL-VI-8842-1193-7765');
    }

    public function test_wrong_pin_does_not_debit_for_voucher_internet(): void
    {
        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $this->expectException(\Illuminate\Validation\ValidationException::class);

        $create = resolve(CreateTransactionAction::class);
        try {
            $create->execute($this->user, 'XLVI5GB', '081812345678', '000000');
        } finally {
            $this->assertSame($before, (float) $this->wallet->fresh()->balance);
        }
    }
}
