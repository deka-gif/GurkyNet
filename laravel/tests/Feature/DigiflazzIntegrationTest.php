<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\DigiflazzTransaction;
use App\Models\WalletHistory;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use App\Actions\Transaction\CreateTransactionAction;
use App\Services\DigiflazzService;
use App\Jobs\ProcessDigiflazzTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class DigiflazzIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;
    protected ProductCategory $category;
    protected Provider $provider;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        // Reset accumulated HTTP stubs from the base TestCase so each test controls responses.
        Http::swap(new \Illuminate\Http\Client\Factory());

        // Setup baseline user & financial ecosystem
        $this->user = User::create([
            'name' => 'John Digiflazz',
            'email' => 'john.digi@gurkypay.com',
            'phone_number' => '081234567890',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000002',
            'balance' => 100000.00,
            'status' => 'active',
        ]);

        $this->category = ProductCategory::create([
            'name' => 'Pulsa Seluler',
            'slug' => 'pulsa-seluler',
            'icon' => 'phone',
        ]);

        $this->provider = Provider::create([
            'name' => 'Telkomsel',
            'logo' => 'telkomsel.png',
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->provider->id,
            'sku_code' => 'TSEL10K',
            'name' => 'Telkomsel 10K',
            'base_price' => 10000.00,
            'sell_price' => 11500.00,
            'admin_fee' => 0.00,
            'status' => true,
        ]);
    }

    /**
     * Test Buy Success flow.
     */
    public function test_buy_product_success(): void
    {
        // 1. Mock Digiflazz response for Success
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GRK-123456',
                    'buyer_sku_code' => 'TSEL10K',
                    'customer_no' => '081234567890',
                    'status' => 'Success',
                    'sn' => 'SN987654321',
                    'price' => 10100,
                    'message' => 'Transaksi Sukses',
                ]
            ], 200),
        ]);

        // 2. Prevent Queue from running automatically so we can run manually
        Queue::fake();

        $createAction = resolve(CreateTransactionAction::class);
        $transaction = $createAction->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            '123456',
        );

        $this->assertEquals(\App\Enums\TransactionStatus::LOCKED->value, $transaction->status);

        // 3. Execute the job manually
        $job = new ProcessDigiflazzTransaction($transaction->id);
        app()->call([$job, 'handle']);

        // 4. Assert transaction and digiflazz transaction status
        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);
        $this->assertStringContainsString('SN987654321', $transaction->notes);

        $digiTx = DigiflazzTransaction::where('transaction_id', $transaction->id)->first();
        $this->assertNotNull($digiTx);
        $this->assertEquals('success', $digiTx->digiflazz_status);
        $this->assertEquals('SN987654321', $digiTx->sn);
    }

    /**
     * Test Buy Failed flow with automated refund.
     */
    public function test_buy_product_failed_and_refunded(): void
    {
        // 1. Mock Digiflazz response for Failed
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GRK-123456',
                    'buyer_sku_code' => 'TSEL10K',
                    'customer_no' => '081234567890',
                    'status' => 'Failed',
                    'sn' => '',
                    'price' => 0,
                    'message' => 'Saldo tidak cukup / gangguan',
                ]
            ], 200),
        ]);

        Queue::fake();

        $createAction = resolve(CreateTransactionAction::class);
        $transaction = $createAction->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            '123456',
        );

        $this->wallet->refresh();
        $this->assertEquals(88500.00, $this->wallet->balance);

        // 2. Execute job
        $job = new ProcessDigiflazzTransaction($transaction->id);
        app()->call([$job, 'handle']);

        // 3. Assert states
        $transaction->refresh();
        $this->assertEquals('failed', $transaction->status);

        // 4. Wallet balance must be fully refunded
        $this->wallet->refresh();
        $this->assertEquals(100000.00, $this->wallet->balance);

        // 5. Must have credit refund history
        $this->assertDatabaseHas('wallet_histories', [
            'wallet_id' => $this->wallet->id,
            'amount' => 11500.00,
            'type' => WalletHistoryType::CREDIT->value,
            'reference_id' => $transaction->id,
        ]);
    }

    /**
     * Test API 5xx surfaces as an error (retry backoff is disabled in testing for speed).
     */
    public function test_digiflazz_service_retry_on_5xx(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response('Service Unavailable', 503),
        ]);

        $service = resolve(DigiflazzService::class);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Digiflazz API error (503)');

        $service->buy('TSEL10K', '081234567890', 'GRK-123456');
    }

    /**
     * Test API Connection Timeout.
     */
    public function test_digiflazz_service_timeout_exception(): void
    {
        // Mock connection timeout
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => function () {
                throw new \Illuminate\Http\Client\ConnectionException("Connection timed out");
            },
        ]);

        $service = resolve(DigiflazzService::class);

        $this->expectException(\Illuminate\Http\Client\ConnectionException::class);
        $service->buy('TSEL10K', '081234567890', 'GRK-123456');
    }

    /**
     * Test Webhook callback success.
     */
    public function test_webhook_callback_success_processing(): void
    {
        Queue::fake();

        // 1. Create a transaction & digiflazz transaction in pending state
        $createAction = resolve(CreateTransactionAction::class);
        $transaction = $createAction->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            '123456',
        );

        $digiTx = DigiflazzTransaction::create([
            'transaction_id' => $transaction->id,
            'ref_id' => $transaction->invoice_number,
            'buyer_sku_code' => 'TSEL10K',
            'customer_no' => '081234567890',
            'digiflazz_status' => 'pending',
        ]);

        // 2. Call Webhook Callback (legacy X-Digiflazz-Signature still supported)
        $payload = [
            'data' => [
                'ref_id' => $transaction->invoice_number,
                'buyer_sku_code' => 'TSEL10K',
                'customer_no' => '081234567890',
                'status' => 'Success',
                'sn' => 'SN-WEBHOOK-SUCCESS',
                'price' => 10100,
                'message' => 'Transaksi Sukses',
            ],
        ];
        $body = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $secret = (string) (config('services.digiflazz.webhook_secret') ?: 'testing_webhook_secret');
        $response = $this->call(
            'POST',
            '/api/v1/webhooks/digiflazz',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_DIGIFLAZZ_SIGNATURE' => 'sha1='.hash_hmac('sha1', (string) $body, $secret),
            ],
            $body
        );

        $response->assertStatus(200);

        // 3. Verify transaction & digiflazz record updated
        $transaction->refresh();
        $digiTx->refresh();

        $this->assertEquals('success', $transaction->status);
        $this->assertEquals('success', $digiTx->digiflazz_status);
        $this->assertEquals('SN-WEBHOOK-SUCCESS', $digiTx->sn);
    }

    /**
     * Test Webhook callback failed and refunded.
     */
    public function test_webhook_callback_failed_triggers_refund(): void
    {
        Queue::fake();

        // 1. Create a transaction & digiflazz transaction in pending state
        $createAction = resolve(CreateTransactionAction::class);
        $transaction = $createAction->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            '123456',
        );

        $digiTx = DigiflazzTransaction::create([
            'transaction_id' => $transaction->id,
            'ref_id' => $transaction->invoice_number,
            'buyer_sku_code' => 'TSEL10K',
            'customer_no' => '081234567890',
            'digiflazz_status' => 'pending',
        ]);

        $this->wallet->refresh();
        $this->assertEquals(88500.00, $this->wallet->balance);

        // 2. Call Webhook Callback with Failed status
        $payload = [
            'data' => [
                'ref_id' => $transaction->invoice_number,
                'buyer_sku_code' => 'TSEL10K',
                'customer_no' => '081234567890',
                'status' => 'Failed',
                'sn' => '',
                'price' => 0,
                'message' => 'Transaksi Gagal',
            ],
        ];
        $body = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $secret = (string) (config('services.digiflazz.webhook_secret') ?: 'testing_webhook_secret');
        $response = $this->call(
            'POST',
            '/api/v1/webhooks/digiflazz',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_DIGIFLAZZ_SIGNATURE' => 'sha1='.hash_hmac('sha1', (string) $body, $secret),
            ],
            $body
        );

        $response->assertStatus(200);

        // 3. Verify transaction failed, wallet refunded
        $transaction->refresh();
        $digiTx->refresh();
        $this->wallet->refresh();

        $this->assertEquals('failed', $transaction->status);
        $this->assertEquals('failed', $digiTx->digiflazz_status);
        $this->assertEquals(100000.00, $this->wallet->balance);
    }
}
