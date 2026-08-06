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

class EwalletTopUpFlowTest extends TestCase
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
            'sku_code' => 'DANA50',
            'name' => 'TOP UP DANA Rp50.000',
            'base_price' => 50000,
            'sell_price' => 50500,
            'admin_fee' => 500,
            'status' => true,
        ]);
    }

    public function test_ewallet_inquiry_sends_amount_and_returns_provider_name(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQEWALLET001',
                    'customer_no' => '08123456789',
                    'customer_name' => 'REZA ADITYA',
                    'buyer_sku_code' => 'DANA50',
                    'admin' => 500,
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'price' => 50000,
                    'selling_price' => 50500,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'DANA50',
            'customer_no' => '08123456789',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.customer_name', 'REZA ADITYA')
            ->assertJsonPath('data.customer_no', '08123456789')
            ->assertJsonPath('data.nominal_amount', 50000)
            ->assertJsonPath('data.bill_amount', 50000)
            ->assertJsonPath('data.admin_fee', 500)
            ->assertJsonPath('data.selling_price', 50500)
            ->assertJsonPath('data.is_ewallet', true);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'inq-pasca'
                && ($body['buyer_sku_code'] ?? null) === 'DANA50'
                && ($body['customer_no'] ?? null) === '08123456789'
                && (int) ($body['amount'] ?? 0) === 50000
                && !empty($body['ref_id']);
        });
    }

    public function test_ewallet_inquiry_failure_does_not_debit_wallet(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNQEFAIL',
                    'customer_no' => '081200000000',
                    'status' => 'Gagal',
                    'message' => 'Nomor tidak terdaftar',
                    'rc' => '14',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $response = $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'DANA50',
            'customer_no' => '081200000000',
        ]);

        $response->assertStatus(422);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
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
                        'buyer_sku_code' => 'DANA50',
                        'admin' => 500,
                        'message' => 'Transaksi Sukses',
                        'status' => 'Sukses',
                        'rc' => '00',
                        'price' => 50000,
                        'selling_price' => 50500,
                    ],
                ], 200)
                ->push([
                    'data' => [
                        'ref_id' => $inquiryRef,
                        'customer_no' => '08123456789',
                        'customer_name' => 'REZA ADITYA',
                        'buyer_sku_code' => 'DANA50',
                        'admin' => 500,
                        'message' => 'Transaksi Sukses',
                        'status' => 'Sukses',
                        'rc' => '00',
                        'sn' => '81723918239123',
                        'price' => 50000,
                        'selling_price' => 50500,
                    ],
                ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $inq = $this->postJson('/api/v1/ewallet/inquiry', [
            'sku_code' => 'DANA50',
            'customer_no' => '08123456789',
        ])->assertOk();

        $refId = $inq->json('data.inquiry_ref_id');
        $this->assertNotEmpty($refId);

        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'DANA50',
            '08123456789',
            '123456',
            $refId
        );

        $this->assertEquals(50500.0, (float) $transaction->total_payment);
        $this->assertEquals(500.0, (float) $transaction->admin_fee);
        $this->assertSame($refId, $transaction->provider_ref);
        $this->assertEquals(500000.0 - 50500.0, (float) $this->wallet->fresh()->balance);

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(!empty($meta['is_pasca']));
        $this->assertTrue(!empty($meta['is_ewallet']));
        $this->assertSame('REZA ADITYA', $meta['customer_name'] ?? null);
        $this->assertSame($refId, $meta['inquiry_ref_id'] ?? null);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);
        $this->assertStringContainsString('81723918239123', (string) $transaction->notes);

        $receipt = $this->getJson('/api/v1/transactions/' . $transaction->invoice_number . '/receipt')
            ->assertOk();

        $receipt->assertJsonPath('data.transaction_details.customer_name', 'REZA ADITYA')
            ->assertJsonPath('data.transaction_details.is_ewallet', true)
            ->assertJsonPath('data.transaction_details.serial_number', '81723918239123');
    }
}
