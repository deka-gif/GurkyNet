<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\WalletHistory;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use App\Actions\Transaction\CreateTransactionAction;
use App\Actions\Transaction\CancelTransactionAction;
use App\Actions\Transaction\GetTransactionAction;
use App\Actions\Transaction\GetReceiptAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class TransactionModuleTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;
    protected ProductCategory $category;
    protected Provider $provider;
    protected Product $activeProduct;
    protected Product $inactiveProduct;

    protected function setUp(): void
    {
        parent::setUp();

        // Keep Digiflazz fulfillment queued so create-transaction unit assertions stay deterministic.
        Queue::fake();

        // 1. Create User
        $this->user = User::create([
            'name' => 'Gurky Customer',
            'email' => 'customer@gurkypay.com',
            'phone_number' => '081234567890',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 2. Create Wallet
        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000001',
            'balance' => 50000.00, // Rp 50.000
            'status' => 'active',
        ]);

        // 3. Create Product Category
        $this->category = ProductCategory::create([
            'name' => 'Pulsa Seluler',
            'slug' => 'pulsa-seluler',
            'icon' => 'phone',
        ]);

        // 4. Create Provider
        $this->provider = Provider::create([
            'name' => 'Telkomsel',
            'logo' => 'telkomsel.png',
            'is_active' => true,
        ]);

        // 5. Create Active Product (Rp 10.000, Sell Price Rp 11.500)
        $this->activeProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->provider->id,
            'sku_code' => 'TSEL10K',
            'name' => 'Telkomsel 10K',
            'base_price' => 10000.00,
            'sell_price' => 11500.00,
            'admin_fee' => 0.00,
            'status' => true,
        ]);

        // 6. Create Inactive Product
        $this->inactiveProduct = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->provider->id,
            'sku_code' => 'TSEL50K-INACTIVE',
            'name' => 'Telkomsel 50K Inactive',
            'base_price' => 50000.00,
            'sell_price' => 51500.00,
            'admin_fee' => 0.00,
            'status' => false,
        ]);
    }

    /**
     * Test Create Transaction flow (Success path).
     */
    public function test_create_transaction_success(): void
    {
        $createAction = resolve(CreateTransactionAction::class);
        
        $transaction = $createAction->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            '123456'
        );

        $this->assertInstanceOf(Transaction::class, $transaction);
        $this->assertEquals('pending', $transaction->status);
        $this->assertEquals(11500.00, $transaction->total_payment);
        $this->assertStringStartsWith('GRK-', $transaction->invoice_number);

        // Verify balance was deducted
        $this->wallet->refresh();
        $this->assertEquals(38500.00, $this->wallet->balance);

        // Verify WalletHistory was logged
        $history = WalletHistory::where('wallet_id', $this->wallet->id)->first();
        $this->assertNotNull($history);
        $this->assertEquals(WalletHistoryType::DEBIT->value, $history->type);
        $this->assertEquals(11500.00, $history->amount);
        $this->assertEquals($transaction->id, $history->reference_id);

        // Verify database state
        $this->assertDatabaseHas('transactions', [
            'id' => $transaction->id,
            'status' => 'pending',
            'total_payment' => 11500.00,
        ]);

        $this->assertDatabaseHas('transaction_items', [
            'transaction_id' => $transaction->id,
            'product_code' => 'TSEL10K',
            'price' => 11500.00,
        ]);
    }

    /**
     * Test Create Transaction API Endpoint.
     */
    public function test_create_transaction_api_endpoint_success(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/transactions', [
                'sku_code' => 'TSEL10K',
                'target_number' => '081234567890',
                'pin' => '123456',
            ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'id', 'transactionCode', 'serviceName', 'targetNo', 'amount', 'adminFee', 'totalPayment', 'status', 'items'
                ]
            ])
            ->assertJsonPath('data.status', 'pending');

        // Check wallet balance
        $this->wallet->refresh();
        $this->assertEquals(38500.00, $this->wallet->balance);
    }

    /**
     * Test Invalid Product handling.
     */
    public function test_create_transaction_invalid_product(): void
    {
        $this->expectException(ValidationException::class);
        
        $createAction = resolve(CreateTransactionAction::class);
        $createAction->execute(
            $this->user,
            'NON-EXISTENT-SKU',
            '081234567890',
            '123456'
        );
    }

    /**
     * Test Inactive Product handling.
     */
    public function test_create_transaction_inactive_product(): void
    {
        $this->expectException(ValidationException::class);
        
        $createAction = resolve(CreateTransactionAction::class);
        $createAction->execute(
            $this->user,
            'TSEL50K-INACTIVE',
            '081234567890',
            '123456'
        );
    }

    /**
     * Test Insufficient Balance handling.
     */
    public function test_create_transaction_insufficient_balance(): void
    {
        // Change sell price to be more than wallet balance
        $this->activeProduct->sell_price = 60000.00;
        $this->activeProduct->save();

        $this->expectException(ValidationException::class);

        $createAction = resolve(CreateTransactionAction::class);
        $createAction->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            '123456'
        );
    }

    /**
     * Test Invalid PIN handling.
     */
    public function test_create_transaction_invalid_pin(): void
    {
        $this->expectException(ValidationException::class);

        $createAction = resolve(CreateTransactionAction::class);
        $createAction->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            'INVALID-PIN'
        );
    }

    /**
     * Test Rollback Success.
     * Ensures that if the process fails at some point, any database changes (draft creation, etc.) are rolled back, and balance is untouched.
     */
    public function test_rollback_success_on_failure(): void
    {
        $createAction = resolve(CreateTransactionAction::class);

        $initialTransactionsCount = Transaction::count();
        $initialHistoryCount = WalletHistory::count();

        // Triggering with invalid PIN to cause validation exception
        try {
            $createAction->execute(
                $this->user,
                'TSEL10K',
                '081234567890',
                '999999' // Invalid PIN
            );
        } catch (ValidationException $e) {
            // Expected
        }

        // Assert database state remained completely unchanged (rolled back)
        $this->assertEquals($initialTransactionsCount, Transaction::count());
        $this->assertEquals($initialHistoryCount, WalletHistory::count());

        // Assert wallet balance is exactly untouched
        $this->wallet->refresh();
        $this->assertEquals(50000.00, $this->wallet->balance);
    }

    /**
     * Test Invoice Uniqueness.
     */
    public function test_invoice_numbers_are_sequential_and_unique(): void
    {
        $createAction = resolve(CreateTransactionAction::class);

        // Transaction 1
        $t1 = $createAction->execute($this->user, 'TSEL10K', '081234567891', '123456');
        
        // Refill balance to allow transaction 2
        $this->wallet->balance = 50000.00;
        $this->wallet->save();

        // Transaction 2
        $t2 = $createAction->execute($this->user, 'TSEL10K', '081234567892', '123456');

        $this->assertNotEquals($t1->invoice_number, $t2->invoice_number);
        
        // Extract suffix
        $parts1 = explode('-', $t1->invoice_number);
        $suffix1 = (int) end($parts1);

        $parts2 = explode('-', $t2->invoice_number);
        $suffix2 = (int) end($parts2);

        $this->assertEquals($suffix1 + 1, $suffix2);
    }

    /**
     * Test Receipt Generation structure.
     */
    public function test_receipt_generation(): void
    {
        $createAction = resolve(CreateTransactionAction::class);
        $transaction = $createAction->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            '123456'
        );

        $receiptAction = resolve(GetReceiptAction::class);
        $receipt = $receiptAction->execute($transaction);

        // 1. Verify structure keys for rendering targets (Website, Android, PDF)
        $this->assertArrayHasKey('header', $receipt);
        $this->assertArrayHasKey('transaction_details', $receipt);
        $this->assertArrayHasKey('items', $receipt);
        $this->assertArrayHasKey('payment_summary', $receipt);
        $this->assertArrayHasKey('footer', $receipt);

        // 2. Verify subfields are populated correctly
        $this->assertEquals('GurkyPay', $receipt['header']['company_name']);
        $this->assertEquals($transaction->invoice_number, $receipt['transaction_details']['invoice_number']);
        $this->assertEquals($transaction->status, $receipt['transaction_details']['status']);
        $this->assertEquals('081234567890', $receipt['transaction_details']['target_number']);
        
        // 3. Verify price totals match
        $this->assertEquals(11500.00, $receipt['payment_summary']['total_payment']);
        $this->assertArrayHasKey('serial_number', $receipt['transaction_details']);
    }

    /**
     * Test cancel transaction and refund.
     */
    public function test_cancel_transaction_and_refund(): void
    {
        $createAction = resolve(CreateTransactionAction::class);
        
        // Create a transaction with 'pending' status
        $transaction = $createAction->execute(
            $this->user,
            'TSEL10K',
            '081234567890',
            '123456'
        );

        $this->assertEquals('pending', $transaction->status);
        $this->wallet->refresh();
        $this->assertEquals(38500.00, $this->wallet->balance);

        $cancelAction = resolve(CancelTransactionAction::class);
        $canceled = $cancelAction->execute($transaction, 'User canceled request');

        $this->assertEquals(TransactionStatus::CANCELED->value, $canceled->status);
        
        // Balance must be fully refunded (38500 + 11500 = 50000)
        $this->wallet->refresh();
        $this->assertEquals(50000.00, $this->wallet->balance);

        // Must have credit wallet history
        $refundHistory = WalletHistory::where('wallet_id', $this->wallet->id)
            ->where('type', WalletHistoryType::CREDIT->value)
            ->first();

        $this->assertNotNull($refundHistory);
        $this->assertEquals(11500.00, $refundHistory->amount);
        $this->assertStringContainsString('Refund Pembatalan Transaksi', $refundHistory->description);
    }
}
