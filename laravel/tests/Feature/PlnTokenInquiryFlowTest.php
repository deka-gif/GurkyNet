<?php

namespace Tests\Feature;

use App\Actions\Transaction\CreateTransactionAction;
use App\Actions\Transaction\GetReceiptAction;
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
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlnTokenInquiryFlowTest extends TestCase
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
            'name' => 'PLN User',
            'email' => 'pln.token@gurkypay.com',
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
            'name' => 'Token PLN',
            'slug' => 'pln',
            'icon' => 'zap',
        ]);

        $provider = Provider::create([
            'name' => 'PLN',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'PLN20',
            'name' => 'Token Listrik 20.000',
            'base_price' => 20000.00,
            'sell_price' => 20500.00,
            'admin_fee' => 0.00,
            'status' => true,
        ]);
    }

    public function test_inquiry_pln_uses_dedicated_endpoint_and_returns_provider_name(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/inquiry-pln' => Http::response([
                'data' => [
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'customer_no' => '141234567890',
                    'meter_no' => '141234567890',
                    'subscriber_id' => '523300817840',
                    'name' => 'AMINAH',
                    'segment_power' => 'R1 / 900',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/pln/inquiry', [
            'customer_no' => '141234567890',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.customer_name', 'AMINAH')
            ->assertJsonPath('data.customer_no', '141234567890')
            ->assertJsonPath('data.segment_power', 'R1 / 900');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return str_contains($request->url(), '/inquiry-pln')
                && ($body['customer_no'] ?? null) === '141234567890'
                && !empty($body['sign'])
                && !isset($body['buyer_sku_code']);
        });
    }

    public function test_inquiry_does_not_debit_wallet(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/inquiry-pln' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Nomor tidak ditemukan',
                    'rc' => '14',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $this->postJson('/api/v1/pln/inquiry', [
            'customer_no' => '141234567890',
        ])->assertStatus(422);

        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_purchase_requires_prior_inquiry_session(): void
    {
        Queue::fake();
        $this->expectException(ValidationException::class);

        resolve(CreateTransactionAction::class)->execute(
            $this->user,
            'PLN20',
            '141234567890',
            '123456'
        );
    }

    public function test_buy_token_after_inquiry_and_receipt_exposes_provider_token(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/inquiry-pln' => Http::response([
                'data' => [
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'customer_no' => '141234567890',
                    'meter_no' => '141234567890',
                    'subscriber_id' => '523300817840',
                    'name' => 'AMINAH',
                    'segment_power' => 'R1 / 900',
                ],
            ], 200),
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GRK-PLN-TEST',
                    'customer_no' => '141234567890',
                    'buyer_sku_code' => 'PLN20',
                    'status' => 'Success',
                    'sn' => '141234567890/AMINAH/12345678901234567890/50.5',
                    'message' => 'Transaksi Sukses',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/pln/inquiry', [
            'customer_no' => '141234567890',
        ])->assertOk();

        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'PLN20',
            '141234567890',
            '123456'
        );

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(!empty($meta['pln_prepaid']));
        $this->assertSame('AMINAH', $meta['customer_name'] ?? null);
        $this->assertSame('R1 / 900', $meta['segment_power'] ?? null);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);

        $digi = DigiflazzTransaction::where('transaction_id', $transaction->id)->first();
        $this->assertNotNull($digi);
        $this->assertStringContainsString('12345678901234567890', (string) $digi->sn);

        $receipt = resolve(GetReceiptAction::class)->execute($transaction->fresh(['items', 'digiflazzTransaction']));
        $this->assertSame('AMINAH', $receipt['transaction_details']['customer_name']);
        $this->assertSame('12345678901234567890', $receipt['transaction_details']['token_code']);
        $this->assertSame(
            '1234 - 5678 - 9012 - 3456 - 7890',
            $receipt['transaction_details']['token_code_grouped']
        );
    }

    public function test_digiflazz_service_inquiry_pln_hits_correct_path(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/inquiry-pln' => Http::response(['data' => ['status' => 'Sukses']], 200),
        ]);

        resolve(DigiflazzService::class)->inquiryPln('141234567890');

        Http::assertSent(function ($request) {
            return str_contains($request->url(), '/inquiry-pln')
                && ($request->data()['customer_no'] ?? null) === '141234567890';
        });
    }

    public function test_inquiry_succeeds_when_name_is_missing(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/inquiry-pln' => Http::response([
                'data' => [
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'customer_no' => '141234567890',
                    'meter_no' => '141234567890',
                    'subscriber_id' => '523300817840',
                    'segment_power' => 'R1 /000001300',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/pln/inquiry', [
            'customer_no' => '141234567890',
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.customer_no', '141234567890')
            ->assertJsonPath('data.customer_name', '')
            ->assertJsonPath('data.segment_power', 'R1 /000001300');
    }

    public function test_inquiry_failure_prefers_message_over_rc_description(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/inquiry-pln' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Nomor tidak ditemukan',
                    'rc' => '54',
                    'customer_no' => '141234567890',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/pln/inquiry', [
            'customer_no' => '141234567890',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Nomor tidak ditemukan');
    }

    public function test_inquiry_failure_uses_rc_description_when_message_empty(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/inquiry-pln' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => '',
                    'rc' => '54',
                    'customer_no' => '141234567890',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/pln/inquiry', [
            'customer_no' => '141234567890',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Nomor Tujuan Salah');
    }

    public function test_inquiry_status_primary_over_success_rc(): void
    {
        // Misleading RC 00 with Gagal status — status wins.
        Http::fake([
            'https://api.digiflazz.com/v1/inquiry-pln' => Http::response([
                'data' => [
                    'status' => 'Gagal',
                    'message' => 'Gagal meski RC 00',
                    'rc' => '00',
                    'customer_no' => '141234567890',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/pln/inquiry', [
            'customer_no' => '141234567890',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Gagal meski RC 00');
    }

    public function test_purchase_after_inquiry_without_name_still_allowed(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/inquiry-pln' => Http::response([
                'data' => [
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'customer_no' => '141234567890',
                    'meter_no' => '141234567890',
                    'subscriber_id' => '523300817840',
                    'segment_power' => 'R1 / 900',
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/pln/inquiry', [
            'customer_no' => '141234567890',
        ])->assertOk();

        Queue::fake();

        $transaction = resolve(CreateTransactionAction::class)->execute(
            $this->user,
            'PLN20',
            '141234567890',
            '123456'
        );

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(! empty($meta['pln_prepaid']));
        $this->assertTrue(($meta['customer_name'] ?? null) === null || $meta['customer_name'] === '');
    }
}
