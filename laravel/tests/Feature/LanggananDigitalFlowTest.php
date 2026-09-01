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

class LanggananDigitalFlowTest extends TestCase
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
            'name' => 'Langganan User',
            'email' => 'langganan@gurkypay.com',
            'phone_number' => '081277788899',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000055',
            'balance' => 500000.00,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'Langganan Digital',
            'slug' => 'langganan-digital',
            'icon' => 'tv',
        ]);

        $provider = Provider::create([
            'name' => 'Vidio',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'VIDIO30',
            'name' => 'Vidio Platinum 30 Hari',
            'base_price' => 38000,
            'sell_price' => 39000,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    public function test_langganan_purchase_debits_and_exposes_activation_code(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGLANG001',
                    'customer_no' => '104200000055',
                    'buyer_sku_code' => 'VIDIO30',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'VDEO-PREM-8192-3891',
                    'price' => 38000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'VIDIO30',
            '104200000055',
            '123456'
        );

        $this->assertEquals(39000.0, (float) $transaction->total_payment);
        $this->assertEquals(500000.0 - 39000.0, (float) $this->wallet->fresh()->balance);

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(!empty($meta['is_langganan']));
        $this->assertSame('Vidio', $meta['langganan_brand'] ?? null);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);

        $this->getJson('/api/v1/transactions/' . $transaction->invoice_number . '/receipt')
            ->assertOk()
            ->assertJsonPath('data.transaction_details.is_langganan', true)
            ->assertJsonPath('data.transaction_details.activation_code', 'VDEO-PREM-8192-3891')
            ->assertJsonPath('data.transaction_details.serial_number', 'VDEO-PREM-8192-3891')
            ->assertJsonPath('data.transaction_details.is_pln_token', false);
    }

    public function test_langganan_activation_url_from_provider_sn(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGLANG002',
                    'customer_no' => '104200000055',
                    'buyer_sku_code' => 'VIDIO30',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'https://activate.example.com/vidio/abc',
                    'price' => 38000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'VIDIO30',
            '104200000055',
            '123456'
        );

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $this->getJson('/api/v1/transactions/' . $transaction->invoice_number . '/receipt')
            ->assertOk()
            ->assertJsonPath('data.transaction_details.is_langganan', true)
            ->assertJsonPath('data.transaction_details.activation_url', 'https://activate.example.com/vidio/abc')
            ->assertJsonPath('data.transaction_details.activation_code', null);
    }

    public function test_wrong_pin_does_not_debit_langganan(): void
    {
        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $this->expectException(\Illuminate\Validation\ValidationException::class);

        $create = resolve(CreateTransactionAction::class);
        try {
            $create->execute($this->user, 'VIDIO30', '104200000055', '000000');
        } finally {
            $this->assertSame($before, (float) $this->wallet->fresh()->balance);
        }
    }

    public function test_langganan_account_delivery_rejects_voucher_placeholder(): void
    {
        $provider = Provider::create([
            'name' => 'Netflix',
            'logo' => null,
            'is_active' => true,
        ]);

        $product = Product::create([
            'product_category_id' => $this->product->product_category_id,
            'provider_id' => $provider->id,
            'sku_code' => 'NFLX30',
            'name' => 'Netflix Premium 30 Hari',
            'base_price' => 55000,
            'sell_price' => 56000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        Sanctum::actingAs($this->user);

        $this->expectException(\Illuminate\Validation\ValidationException::class);

        $create = resolve(CreateTransactionAction::class);
        $create->execute($this->user, $product->sku_code, 'LANGGANAN', '123456');
    }

    public function test_langganan_account_schema_requires_sku(): void
    {
        Sanctum::actingAs($this->user);

        $this->getJson('/api/v1/langganan/account-schema?brand=Vidio')
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_langganan_account_schema_returns_voucher_for_vidio_sku(): void
    {
        Sanctum::actingAs($this->user);

        $this->getJson('/api/v1/langganan/account-schema?brand=Vidio&sku=VIDIO30')
            ->assertOk()
            ->assertJsonPath('data.delivery', 'voucher')
            ->assertJsonPath('data.fields', []);
    }

    public function test_langganan_account_delivery_stores_email_target(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGLANG003',
                    'customer_no' => 'user@example.com',
                    'buyer_sku_code' => 'NFLX30',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'NFLX-ACTIVATED',
                    'price' => 55000,
                ],
            ], 200),
        ]);

        $provider = Provider::create([
            'name' => 'Netflix',
            'logo' => null,
            'is_active' => true,
        ]);

        $product = Product::create([
            'product_category_id' => $this->product->product_category_id,
            'provider_id' => $provider->id,
            'sku_code' => 'NFLX30',
            'name' => 'Netflix Premium 30 Hari',
            'base_price' => 55000,
            'sell_price' => 56000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        Sanctum::actingAs($this->user);
        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            $product->sku_code,
            'user@example.com',
            '123456'
        );

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertSame('account', $meta['langganan_delivery'] ?? null);
        $this->assertSame('user@example.com', $meta['langganan_target_display'] ?? null);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $this->getJson('/api/v1/transactions/' . $transaction->invoice_number . '/receipt')
            ->assertOk()
            ->assertJsonPath('data.transaction_details.langganan_target_display', 'user@example.com')
            ->assertJsonPath('data.transaction_details.activation_code', 'NFLX-ACTIVATED');
    }
}
