<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Models\MidtransTransaction;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Models\WithdrawRequest;
use App\Services\Kyc\WithdrawEligibilityService;
use App\Services\Wallet\WalletAdminFeeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * P0 — client admin_fee must never become authoritative for wallet money moves.
 */
class WalletAdminFeeTamperingTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected User $recipient;

    protected Wallet $wallet;

    protected Wallet $recipientWallet;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'wallet.topup_fee' => 0,
            'wallet.transfer_fee' => 0,
            'wallet.withdraw_fee' => 0,
            'features.withdraw_enabled' => true,
        ]);

        $this->mock(WithdrawEligibilityService::class, function ($mock) {
            $mock->shouldReceive('assertEligible')->andReturnNull();
            $mock->shouldReceive('evaluate')->andReturn([
                'eligible' => true,
                'reasons' => [],
                'kyc_ok' => true,
                'agent_ok' => true,
                'bank_ok' => true,
            ]);
        });

        $this->user = User::create([
            'name' => 'Fee Tamper User',
            'email' => 'fee-tamper@gurkypay.com',
            'phone_number' => '081233334444',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W-FEE-TAMPER-1',
            'balance' => 200000,
            'status' => 'active',
        ]);

        $this->recipient = User::create([
            'name' => 'Fee Tamper Recipient',
            'email' => 'fee-tamper-rx@gurkypay.com',
            'phone_number' => '081255556666',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('654321'),
        ]);

        $this->recipientWallet = Wallet::create([
            'user_id' => $this->recipient->id,
            'wallet_number' => 'W-FEE-TAMPER-2',
            'balance' => 10000,
            'status' => 'active',
        ]);
    }

    public function test_topup_ignores_client_admin_fee_tampering(): void
    {
        $authoritative = WalletAdminFeeResolver::topUpFee();
        $amount = 50000;

        foreach ([0, 1, 999999999, '0'] as $i => $tamperFee) {
            $response = $this->actingAs($this->user)->postJson('/api/v1/wallet/topup', [
                'amount' => $amount,
                'admin_fee' => $tamperFee,
                'idempotency_key' => 'topup-fee-tamper-'.$i.'-'.Str::uuid(),
                'payment_method' => 'qris',
            ]);
            $response->assertCreated();

            $tx = Transaction::query()
                ->where('user_id', $this->user->id)
                ->where('service_name', 'Top Up Saldo')
                ->latest('id')
                ->first();

            $this->assertNotNull($tx);
            $this->assertEquals($authoritative, (float) $tx->admin_fee);
            $this->assertEquals($amount + $authoritative, (float) $tx->total_payment);
            $this->assertEquals($amount, (float) $tx->amount);

            $mt = MidtransTransaction::where('transaction_id', $tx->id)->first();
            $this->assertNotNull($mt);
            $this->assertEquals($amount + $authoritative, (float) $mt->gross_amount);
        }

        // Omitted admin_fee → still server fee.
        $this->actingAs($this->user)->postJson('/api/v1/wallet/topup', [
            'amount' => $amount,
            'idempotency_key' => 'topup-fee-omit-'.Str::uuid(),
            'payment_method' => 'qris',
        ])->assertCreated();

        // Negative is stripped (not validated) → still server fee.
        $this->actingAs($this->user)->postJson('/api/v1/wallet/topup', [
            'amount' => $amount,
            'admin_fee' => -5000,
            'idempotency_key' => 'topup-fee-neg-'.Str::uuid(),
            'payment_method' => 'qris',
        ])->assertCreated();

        $tx = Transaction::query()
            ->where('user_id', $this->user->id)
            ->where('service_name', 'Top Up Saldo')
            ->latest('id')
            ->first();
        $this->assertEquals($authoritative, (float) $tx->admin_fee);
    }

    public function test_transfer_ignores_client_admin_fee_tampering(): void
    {
        $authoritative = WalletAdminFeeResolver::transferFee();
        $amount = 25000;
        $before = (float) $this->wallet->fresh()->balance;

        $response = $this->actingAs($this->user)->postJson('/api/v1/wallet/transfer', [
            'recipient_wallet_number' => $this->recipientWallet->wallet_number,
            'amount' => $amount,
            'pin' => '123456',
            'admin_fee' => 999999,
            'idempotency_key' => (string) Str::uuid(),
        ]);

        $response->assertOk();

        $tx = Transaction::query()
            ->where('user_id', $this->user->id)
            ->where('service_name', 'Transfer Saldo')
            ->latest('id')
            ->first();

        $this->assertNotNull($tx);
        $this->assertEquals($authoritative, (float) $tx->admin_fee);
        $this->assertEquals($amount + $authoritative, (float) $tx->total_payment);

        $this->wallet->refresh();
        $this->assertEquals($before - ($amount + $authoritative), (float) $this->wallet->balance);

        $debit = WalletMutation::where('reference_id', (string) $tx->id)
            ->where('type', WalletMutation::TYPE_WITHDRAW)
            ->first();
        $this->assertNotNull($debit);
        $this->assertEquals($amount + $authoritative, abs((float) $debit->amount));
    }

    public function test_transfer_uses_server_fee_when_config_set(): void
    {
        config(['wallet.transfer_fee' => 1500]);
        $this->assertEquals(1500.0, WalletAdminFeeResolver::transferFee());

        $amount = 20000;
        $before = (float) $this->wallet->fresh()->balance;

        $this->actingAs($this->user)->postJson('/api/v1/wallet/transfer', [
            'recipient_wallet_number' => $this->recipientWallet->wallet_number,
            'amount' => $amount,
            'pin' => '123456',
            'admin_fee' => 0,
            'idempotency_key' => (string) Str::uuid(),
        ])->assertOk();

        $this->wallet->refresh();
        $this->assertEquals($before - ($amount + 1500), (float) $this->wallet->balance);

        $tx = Transaction::query()
            ->where('user_id', $this->user->id)
            ->where('service_name', 'Transfer Saldo')
            ->latest('id')
            ->first();
        $this->assertEquals(1500.0, (float) $tx->admin_fee);
        $this->assertEquals($amount + 1500, (float) $tx->total_payment);
    }

    public function test_withdraw_ignores_client_admin_fee_including_web_ui_5000(): void
    {
        config(['wallet.withdraw_fee' => 0]);
        $authoritative = WalletAdminFeeResolver::withdrawFee();
        $amount = 50000;
        $before = (float) $this->wallet->fresh()->balance;

        // Web WalletPage historically sent admin_fee: 5000 — must be ignored.
        $response = $this->actingAs($this->user)->postJson('/api/v1/wallet/withdraw', [
            'amount' => $amount,
            'pin' => '123456',
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'admin_fee' => 5000,
            'idempotency_key' => (string) Str::uuid(),
        ]);

        $response->assertCreated();

        $tx = Transaction::query()
            ->where('user_id', $this->user->id)
            ->where('service_name', 'Penarikan Dana')
            ->latest('id')
            ->first();

        $this->assertNotNull($tx);
        $this->assertEquals($authoritative, (float) $tx->admin_fee);
        $this->assertEquals($amount + $authoritative, (float) $tx->total_payment);
        $this->assertSame(TransactionStatus::LOCKED->value, $tx->status);

        $this->wallet->refresh();
        $this->assertEquals($before - ($amount + $authoritative), (float) $this->wallet->balance);

        $wr = WithdrawRequest::where('transaction_id', $tx->id)->first();
        $this->assertNotNull($wr);
        $this->assertEquals($authoritative, (float) $wr->admin_fee);

        $hold = WalletMutation::where('reference_id', (string) $tx->id)
            ->where('type', WalletMutation::TYPE_HOLD)
            ->first();
        $this->assertNotNull($hold);
        $this->assertEquals($amount + $authoritative, abs((float) $hold->amount));
    }

    public function test_withdraw_uses_server_fee_when_config_set(): void
    {
        config(['wallet.withdraw_fee' => 5000]);
        $amount = 40000;
        $before = (float) $this->wallet->fresh()->balance;

        $this->actingAs($this->user)->postJson('/api/v1/wallet/withdraw', [
            'amount' => $amount,
            'pin' => '123456',
            'bank_name' => 'BCA',
            'account_number' => '9876543210',
            'admin_fee' => 0,
            'idempotency_key' => (string) Str::uuid(),
        ])->assertCreated();

        $tx = Transaction::query()
            ->where('user_id', $this->user->id)
            ->where('service_name', 'Penarikan Dana')
            ->latest('id')
            ->first();

        $this->assertEquals(5000.0, (float) $tx->admin_fee);
        $this->assertEquals($amount + 5000, (float) $tx->total_payment);
        $this->wallet->refresh();
        $this->assertEquals($before - ($amount + 5000), (float) $this->wallet->balance);
    }
}
