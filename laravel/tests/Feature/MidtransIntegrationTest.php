<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Models\MidtransTransaction;
use App\Models\WalletHistory;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use App\Actions\Wallet\TopUpWalletAction;
use App\Services\MidtransService;
use App\Jobs\ProcessMidtransCallback;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class MidtransIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        // Reset accumulated HTTP stubs from the base TestCase so each test controls responses.
        Http::swap(new \Illuminate\Http\Client\Factory());

        // Establish the user and wallet ecosystem
        $this->user = User::create([
            'name' => 'John Midtrans',
            'email' => 'john.midtrans@gurkypay.com',
            'phone_number' => '081234567891',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000003',
            'balance' => 50000.00,
            'status' => 'active',
        ]);
    }

    /**
     * Test Snap token creation flow via TopUpWalletAction.
     */
    public function test_create_snap_transaction_success(): void
    {
        // 1. Mock Midtrans Snap API response
        Http::fake([
            'https://app.sandbox.midtrans.com/snap/v1/transactions' => Http::response([
                'token' => 'mock-snap-token-12345',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v1/payment-page/mock-snap-token-12345',
            ], 201),
        ]);

        $topUpAction = resolve(TopUpWalletAction::class);
        $transaction = $topUpAction->execute($this->user, 25000.00, 1000.00, 'pending');

        // 2. Assert transaction state and Midtrans persistence
        $this->assertEquals('pending', $transaction->status);
        $this->assertEquals('mock-snap-token-12345', $transaction->snap_token);
        $this->assertEquals('https://app.sandbox.midtrans.com/snap/v1/payment-page/mock-snap-token-12345', $transaction->redirect_url);

        $this->assertDatabaseHas('midtrans_transactions', [
            'transaction_id' => $transaction->id,
            'order_id' => $transaction->invoice_number,
            'snap_token' => 'mock-snap-token-12345',
            'gross_amount' => 26000.00,
        ]);
    }

    /**
     * Test that Webhook Callback endpoint validates and dispatches the processing job to the Queue.
     */
    public function test_webhook_dispatches_queue_job(): void
    {
        Queue::fake();

        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-TEST-WEBHOOK-1',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 50000.00,
            'total_payment' => 50000.00,
            'status' => 'pending',
            'payment_method' => 'midtrans',
        ]);

        $payload = [
            'order_id' => $transaction->invoice_number,
            'status_code' => '200',
            'gross_amount' => '50000.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'credit_card',
            'signature_key' => hash('sha512', $transaction->invoice_number . '200' . '50000.00' . config('services.midtrans.server_key', env('MIDTRANS_SERVER_KEY', 'testing_server_key'))),
        ];

        $response = $this->postJson('/api/v1/webhooks/midtrans', $payload);

        $response->assertStatus(200);
        Queue::assertPushed(ProcessMidtransCallback::class, function ($job) use ($payload) {
            return $job->payload['order_id'] === $payload['order_id'];
        });
    }

    /**
     * Test settlement status webhook processing updates transaction and credits the wallet balance.
     */
    public function test_webhook_settlement_updates_transaction_and_credits_wallet(): void
    {
        // 1. Setup pending top-up transaction
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-TEST-SETTLEMENT-2',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 30000.00,
            'total_payment' => 30000.00,
            'status' => 'pending',
            'payment_method' => 'midtrans',
        ]);

        $payload = [
            'order_id' => $transaction->invoice_number,
            'status_code' => '200',
            'gross_amount' => '30000.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'bank_transfer',
            'transaction_time' => now()->format('Y-m-d H:i:s'),
        ];

        // 2. Execute background job manually
        $job = new ProcessMidtransCallback($payload);
        $job->handle();

        // 3. Verify database states
        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);

        $this->wallet->refresh();
        $this->assertEquals(80000.00, $this->wallet->balance);

        // 4. Verify wallet history creation
        $this->assertDatabaseHas('wallet_histories', [
            'wallet_id' => $this->wallet->id,
            'amount' => 30000.00,
            'type' => WalletHistoryType::CREDIT->value,
            'reference_id' => $transaction->id,
        ]);

        // 5. Verify monitoring metric was recorded in activity logs
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $this->user->id,
            'activity' => 'midtrans_callback_metric',
        ]);
    }

    /**
     * Test pending webhook callback does not credit wallet and leaves transaction as pending.
     */
    public function test_webhook_pending_does_not_credit_wallet(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-TEST-PENDING-3',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 15000.00,
            'total_payment' => 15000.00,
            'status' => 'pending',
            'payment_method' => 'midtrans',
        ]);

        $payload = [
            'order_id' => $transaction->invoice_number,
            'status_code' => '201',
            'gross_amount' => '15000.00',
            'transaction_status' => 'pending',
        ];

        $job = new ProcessMidtransCallback($payload);
        $job->handle();

        $transaction->refresh();
        // Midtrans "pending" maps to local processing (awaiting settlement).
        $this->assertEquals('processing', $transaction->status);

        $this->wallet->refresh();
        $this->assertEquals(50000.00, $this->wallet->balance); // balance unchanged
    }

    /**
     * Test cancel webhook transitions transaction to canceled.
     */
    public function test_webhook_cancel_transitions_status(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-TEST-CANCEL-4',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 10000.00,
            'total_payment' => 10000.00,
            'status' => 'pending',
            'payment_method' => 'midtrans',
        ]);

        $payload = [
            'order_id' => $transaction->invoice_number,
            'status_code' => '200',
            'gross_amount' => '10000.00',
            'transaction_status' => 'cancel',
        ];

        $job = new ProcessMidtransCallback($payload);
        $job->handle();

        $transaction->refresh();
        $this->assertEquals('canceled', $transaction->status);
    }

    /**
     * Test expire webhook transitions transaction to expired.
     */
    public function test_webhook_expire_transitions_status(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-TEST-EXPIRE-5',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 10000.00,
            'total_payment' => 10000.00,
            'status' => 'pending',
            'payment_method' => 'midtrans',
        ]);

        $payload = [
            'order_id' => $transaction->invoice_number,
            'status_code' => '200',
            'gross_amount' => '10000.00',
            'transaction_status' => 'expire',
        ];

        $job = new ProcessMidtransCallback($payload);
        $job->handle();

        $transaction->refresh();
        $this->assertEquals('expired', $transaction->status);
    }

    /**
     * Test that MidtransService Refund works as expected.
     */
    public function test_midtrans_service_refund_success(): void
    {
        Http::fake([
            'https://api.sandbox.midtrans.com/v2/*/refund' => Http::response([
                'status_code' => '200',
                'transaction_status' => 'refund',
                'refund_chargeback_amount' => '10000.00',
            ], 200),
        ]);

        $service = resolve(MidtransService::class);
        $response = $service->refund('TRX-ORDER-111', 10000.00, 'Customer request');

        $this->assertEquals('200', $response['status_code']);
        $this->assertEquals('refund', $response['transaction_status']);
    }

    /**
     * Test replay and duplicate protection. Same settlement webhook must not credit wallet twice.
     */
    public function test_webhook_idempotency_prevents_duplicate_credits(): void
    {
        $transaction = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-TEST-DUP-6',
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 20000.00,
            'total_payment' => 20000.00,
            'status' => 'pending',
            'payment_method' => 'midtrans',
        ]);

        $payload = [
            'order_id' => $transaction->invoice_number,
            'status_code' => '200',
            'gross_amount' => '20000.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'bank_transfer',
        ];

        // First callback
        $job1 = new ProcessMidtransCallback($payload);
        $job1->handle();

        $this->wallet->refresh();
        $this->assertEquals(70000.00, $this->wallet->balance);

        // Second duplicate callback
        $job2 = new ProcessMidtransCallback($payload);
        $job2->handle();

        $this->wallet->refresh();
        $this->assertEquals(70000.00, $this->wallet->balance); // balance remains 70000 (no duplicate credit)
    }
}
