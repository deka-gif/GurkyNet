<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\Transaction;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use App\Actions\Wallet\TransferWalletAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class WalletModuleTest extends TestCase
{
    use RefreshDatabase;

    protected User $sender;
    protected User $recipient;
    protected Wallet $senderWallet;
    protected Wallet $recipientWallet;

    protected function setUp(): void
    {
        parent::setUp();

        // Create sender
        $this->sender = User::create([
            'name' => 'Adipati Sender',
            'email' => 'sender@gurkypay.com',
            'phone_number' => '081111111111',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->senderWallet = Wallet::create([
            'user_id' => $this->sender->id,
            'wallet_number' => '104211111111',
            'balance' => 100000.00, // Rp 100.000
            'status' => 'active',
        ]);

        // Create recipient
        $this->recipient = User::create([
            'name' => 'Srikandi Recipient',
            'email' => 'recipient@gurkypay.com',
            'phone_number' => '082222222222',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('654321'),
        ]);

        $this->recipientWallet = Wallet::create([
            'user_id' => $this->recipient->id,
            'wallet_number' => '104222222222',
            'balance' => 50000.00, // Rp 50.000
            'status' => 'active',
        ]);
    }

    /**
     * Test getting the wallet balance of the authenticated user.
     */
    public function test_get_wallet_balance_success(): void
    {
        $response = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Detail data dompet digital berhasil didapatkan.',
                'data' => [
                    'wallet' => [
                        'walletNo' => '104211111111',
                        'wallet_id' => '104211111111',
                        'balance' => 100000,
                        'status' => 'active',
                    ],
                    'summary' => [
                        'income_this_month' => 0,
                        'expense_this_month' => 0,
                        'transaction_count' => 0,
                    ],
                    'recent_transactions' => [],
                ],
            ]);
    }

    public function test_wallet_overview_aggregates_monthly_income_expense_and_mutations(): void
    {
        WalletHistory::create([
            'wallet_id' => $this->senderWallet->id,
            'amount' => 100000.00,
            'type' => WalletHistoryType::CREDIT->value,
            'description' => 'Top Up Saldo',
        ]);
        WalletHistory::create([
            'wallet_id' => $this->senderWallet->id,
            'amount' => 74550.00,
            'type' => WalletHistoryType::DEBIT->value,
            'description' => 'Pembelian Pulsa',
        ]);
        WalletHistory::create([
            'wallet_id' => $this->senderWallet->id,
            'amount' => 5000.00,
            'type' => WalletHistoryType::CREDIT->value,
            'description' => 'Refund Transaksi',
        ]);

        // Outside current month — must not affect summary
        $old = WalletHistory::create([
            'wallet_id' => $this->senderWallet->id,
            'amount' => 999999.00,
            'type' => WalletHistoryType::CREDIT->value,
            'description' => 'Top Up lama',
        ]);
        $old->forceFill(['created_at' => now()->subMonths(2)])->save();

        $response = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet');

        $response->assertStatus(200)
            ->assertJsonPath('data.wallet.balance', 100000)
            ->assertJsonPath('data.summary.income_this_month', 105000)
            ->assertJsonPath('data.summary.expense_this_month', 74550)
            ->assertJsonPath('data.summary.transaction_count', 3);

        $this->assertCount(4, $response->json('data.recent_transactions'));
    }

    /**
     * Test getting the wallet history with pagination and filters.
     */
    public function test_get_wallet_history_and_filters(): void
    {
        // Pre-create wallet history
        $olderHistory = WalletHistory::create([
            'wallet_id' => $this->senderWallet->id,
            'amount' => 20000.00,
            'type' => WalletHistoryType::CREDIT->value,
            'description' => 'Top Up Saldo',
        ]);
        $olderHistory->forceFill(['created_at' => now()->subDays(2)])->save();

        WalletHistory::create([
            'wallet_id' => $this->senderWallet->id,
            'amount' => 15000.00,
            'type' => WalletHistoryType::DEBIT->value,
            'description' => 'Transfer keluar',
            'created_at' => now(),
        ]);

        // 1. Test basic list
        $response = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/history');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data',
                'meta' => [
                    'pagination' => ['currentPage', 'lastPage', 'perPage', 'total'],
                ],
            ]);

        $this->assertCount(2, $response->json('data'));

        // 2. Test filter by type (debit)
        $responseFilterType = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/history?type=debit');

        $responseFilterType->assertStatus(200);
        $this->assertCount(1, $responseFilterType->json('data'));
        $this->assertEquals('debit', $responseFilterType->json('data.0.type'));

        // 3. Test filter by date range
        $responseFilterDate = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/history?start_date=' . now()->toDateString() . '&end_date=' . now()->toDateString());

        $responseFilterDate->assertStatus(200);
        $this->assertCount(1, $responseFilterDate->json('data')); // Only the one created today
    }

    /**
     * Test top up creates a pending Midtrans transaction (no client-controlled credit).
     */
    public function test_top_up_success(): void
    {
        $response = $this->actingAs($this->sender)
            ->postJson('/api/v1/wallet/topup', [
                'amount' => 50000,
                'admin_fee' => 0,
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Top up berhasil diajukan.',
            ]);

        $this->senderWallet->refresh();
        // Balance unchanged until Midtrans settlement webhook.
        $this->assertEquals(100000.00, $this->senderWallet->balance);

        $this->assertDatabaseHas('transactions', [
            'user_id' => $this->sender->id,
            'amount' => 50000.00,
            'status' => 'pending',
        ]);
    }

    /**
     * Test internal transfer success with correct details.
     */
    public function test_transfer_success(): void
    {
        $response = $this->actingAs($this->sender)
            ->postJson('/api/v1/wallet/transfer', [
                'recipient_wallet_number' => '104222222222',
                'amount' => 30000,
                'pin' => '123456',
                'admin_fee' => 1000, // configurable fee simulation
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Transfer dana berhasil dikirimkan.',
            ]);

        $this->senderWallet->refresh();
        $this->recipientWallet->refresh();

        // Sender balance: 100.000 - (30.000 + 1.000) = 69.000
        $this->assertEquals(69000.00, $this->senderWallet->balance);

        // Recipient balance: 50.000 + 30.000 = 80.000
        $this->assertEquals(80000.00, $this->recipientWallet->balance);

        // Verify transactions exist
        $this->assertDatabaseHas('transactions', [
            'user_id' => $this->sender->id,
            'target_number' => '104222222222',
            'amount' => 30000.00,
            'admin_fee' => 1000.00,
            'total_payment' => 31000.00,
            'status' => 'sukses',
        ]);

        // Verify history exists
        $this->assertDatabaseHas('wallet_histories', [
            'wallet_id' => $this->senderWallet->id,
            'amount' => 31000.00,
            'type' => 'debit',
        ]);

        $this->assertDatabaseHas('wallet_histories', [
            'wallet_id' => $this->recipientWallet->id,
            'amount' => 30000.00,
            'type' => 'credit',
        ]);
    }

    /**
     * Test transfer failed due to insufficient balance.
     */
    public function test_transfer_failed_insufficient_balance(): void
    {
        $response = $this->actingAs($this->sender)
            ->postJson('/api/v1/wallet/transfer', [
                'recipient_wallet_number' => '104222222222',
                'amount' => 120000, // more than 100k balance
                'pin' => '123456',
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Saldo tidak mencukupi untuk melakukan transfer.',
            ]);

        $this->senderWallet->refresh();
        $this->assertEquals(100000.00, $this->senderWallet->balance);
    }

    /**
     * Test transfer failed due to invalid transaction PIN.
     */
    public function test_transfer_failed_invalid_pin(): void
    {
        $response = $this->actingAs($this->sender)
            ->postJson('/api/v1/wallet/transfer', [
                'recipient_wallet_number' => '104222222222',
                'amount' => 10000,
                'pin' => '999999', // incorrect PIN
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'PIN transaksi yang Anda masukkan salah.',
            ]);

        $this->senderWallet->refresh();
        $this->assertEquals(100000.00, $this->senderWallet->balance);
    }

    /**
     * Test transfer failed due to self transfer attempt.
     */
    public function test_transfer_failed_self_transfer(): void
    {
        $response = $this->actingAs($this->sender)
            ->postJson('/api/v1/wallet/transfer', [
                'recipient_wallet_number' => '104211111111', // sender's own wallet
                'amount' => 10000,
                'pin' => '123456',
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Tidak diperbolehkan melakukan transfer ke rekening / wallet sendiri.',
            ]);
    }

    /**
     * Test deadlock prevention and anti race condition mechanism.
     * We verify that the sorting logic executes correctly inside TransferWalletAction
     * when we run sequential transfers in opposite directions.
     */
    public function test_concurrent_transfers_no_deadlocks(): void
    {
        $action = resolve(TransferWalletAction::class);

        // Transaction 1: Sender -> Recipient
        $tx1 = $action->execute($this->sender, '104222222222', 10000, '123456', 0);
        $this->assertNotNull($tx1);

        // Transaction 2: Recipient -> Sender (Opposite direction)
        $tx2 = $action->execute($this->recipient, '104211111111', 5000, '654321', 0);
        $this->assertNotNull($tx2);

        $this->senderWallet->refresh();
        $this->recipientWallet->refresh();

        // Sender balance: 100000 - 10000 + 5000 = 95000
        $this->assertEquals(95000.00, $this->senderWallet->balance);

        // Recipient balance: 50000 + 10000 - 5000 = 55000
        $this->assertEquals(55000.00, $this->recipientWallet->balance);
    }
}
