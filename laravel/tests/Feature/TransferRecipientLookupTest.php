<?php

namespace Tests\Feature;

use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Read-only GET /wallet/transfer/recipient/{walletNumber}
 * for Sesama GurkyPay confirmation preview.
 */
class TransferRecipientLookupTest extends TestCase
{
    use RefreshDatabase;

    protected User $sender;
    protected User $recipient;
    protected Wallet $senderWallet;
    protected Wallet $recipientWallet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sender = User::create([
            'name' => 'Adipati Sender',
            'email' => 'sender-lookup@gurkypay.com',
            'phone_number' => '081111111111',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
            'gurky_pay_id' => '20263128001',
        ]);

        $this->senderWallet = Wallet::create([
            'user_id' => $this->sender->id,
            'wallet_number' => '20263128001',
            'previous_wallet_number' => '104211111111',
            'balance' => 100000.00,
            'status' => 'active',
        ]);

        $this->recipient = User::create([
            'name' => 'Srikandi Recipient',
            'email' => 'recipient-lookup@gurkypay.com',
            'phone_number' => '082222222222',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('654321'),
            'gurky_pay_id' => '20263128002',
        ]);

        $this->recipientWallet = Wallet::create([
            'user_id' => $this->recipient->id,
            'wallet_number' => '20263128002',
            'previous_wallet_number' => '104222222222',
            'balance' => 50000.00,
            'status' => 'active',
        ]);
    }

    public function test_recipient_exists_returns_name(): void
    {
        $txBefore = Transaction::count();
        $mutBefore = WalletMutation::count();
        $balanceBefore = (float) $this->recipientWallet->fresh()->balance;

        $response = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/transfer/recipient/20263128002');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'recipient' => [
                        'wallet_number' => '20263128002',
                        'name' => 'Srikandi Recipient',
                    ],
                ],
            ]);

        $this->assertArrayNotHasKey('email', $response->json('data.recipient') ?? []);
        $this->assertArrayNotHasKey('phone', $response->json('data.recipient') ?? []);
        $this->assertArrayNotHasKey('balance', $response->json('data.recipient') ?? []);
        $this->assertArrayNotHasKey('id', $response->json('data.recipient') ?? []);

        $this->assertSame($txBefore, Transaction::count());
        $this->assertSame($mutBefore, WalletMutation::count());
        $this->assertSame($balanceBefore, (float) $this->recipientWallet->fresh()->balance);
        $this->assertSame(100000.00, (float) $this->senderWallet->fresh()->balance);
    }

    public function test_recipient_not_found(): void
    {
        $response = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/transfer/recipient/99999999999');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'message' => 'Nomor GurkyPay tidak ditemukan.',
            ]);
    }

    public function test_lookup_by_previous_wallet_number(): void
    {
        $response = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/transfer/recipient/104222222222');

        $response->assertStatus(200)
            ->assertJsonPath('data.recipient.wallet_number', '20263128002')
            ->assertJsonPath('data.recipient.name', 'Srikandi Recipient');
    }

    public function test_lookup_by_gurky_pay_id(): void
    {
        $response = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/transfer/recipient/20263128002');

        $response->assertStatus(200)
            ->assertJsonPath('data.recipient.wallet_number', '20263128002')
            ->assertJsonPath('data.recipient.name', 'Srikandi Recipient');
    }

    public function test_self_lookup_rejects_without_mutation(): void
    {
        $txBefore = Transaction::count();
        $mutBefore = WalletMutation::count();

        $response = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/transfer/recipient/20263128001');

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'Anda tidak dapat melakukan transfer ke rekening GurkyPay sendiri.',
            ]);

        $this->assertSame($txBefore, Transaction::count());
        $this->assertSame($mutBefore, WalletMutation::count());
        $this->assertSame(100000.00, (float) $this->senderWallet->fresh()->balance);
    }

    public function test_self_lookup_by_previous_wallet_number_rejects(): void
    {
        $response = $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/transfer/recipient/104211111111');

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Anda tidak dapat melakukan transfer ke rekening GurkyPay sendiri.');
    }

    public function test_unauthorized(): void
    {
        $this->getJson('/api/v1/wallet/transfer/recipient/20263128002')
            ->assertStatus(401);
    }

    public function test_lookup_does_not_create_transaction_or_mutation(): void
    {
        $txBefore = Transaction::count();
        $mutBefore = WalletMutation::count();

        $this->actingAs($this->sender)
            ->getJson('/api/v1/wallet/transfer/recipient/20263128002')
            ->assertStatus(200);

        $this->assertSame($txBefore, Transaction::count());
        $this->assertSame($mutBefore, WalletMutation::count());
        $this->assertDatabaseMissing('transactions', [
            'user_id' => $this->sender->id,
            'service_name' => 'Transfer Saldo',
            'target_number' => '20263128002',
            'amount' => 0,
        ]);
    }
}
