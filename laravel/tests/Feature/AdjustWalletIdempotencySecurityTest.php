<?php

namespace Tests\Feature;

use App\Actions\Wallet\AdjustWalletAction;
use App\Enums\UserRole;
use App\Models\IdempotencyRequest;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Transactions\IdempotencyRequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * P1-C audit proof — AdjustWallet HTTP path already uses IdempotencyRequestService (SRS 14.1).
 * Documents that missing action-level key forwarding is NOT a duplicate-mutation vulnerability.
 */
class AdjustWalletIdempotencySecurityTest extends TestCase
{
    use RefreshDatabase;

    protected User $finance;

    protected User $customer;

    protected Wallet $customerWallet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->finance = User::create([
            'name' => 'Finance P1C',
            'email' => 'finance-p1c@gurkynet.test',
            'phone_number' => '081211100011',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
        ]);

        $this->customer = User::create([
            'name' => 'Customer P1C',
            'email' => 'customer-p1c@gurkynet.test',
            'phone_number' => '081211100012',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->customerWallet = Wallet::create([
            'user_id' => $this->customer->id,
            'wallet_number' => 'W-P1C-CUST',
            'balance' => 100000.00,
            'status' => 'active',
        ]);
    }

    public function test_authorized_adjust_mutates_once_and_replay_is_exactly_once(): void
    {
        $key = 'adj-p1c-'.Str::uuid();
        $payload = [
            'user_id' => $this->customer->id,
            'amount' => 7500,
            'direction' => 'credit',
            'reason' => 'P1C compensation',
            'idempotency_key' => $key,
        ];

        $r1 = $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/wallet/adjust', $payload);
        $r1->assertOk();
        $txId = (int) $r1->json('data.id');

        $r2 = $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/wallet/adjust', $payload);
        $r2->assertOk();
        $this->assertSame($txId, (int) $r2->json('data.id'));

        $this->customerWallet->refresh();
        $this->assertEquals(107500.00, (float) $this->customerWallet->balance);
        $this->assertEquals(1, WalletMutation::query()
            ->where('wallet_id', $this->customerWallet->id)
            ->where('type', WalletMutation::TYPE_ADJUSTMENT)
            ->count());
        $this->assertEquals(1, Transaction::query()
            ->where('user_id', $this->customer->id)
            ->where('payment_method', 'adjustment')
            ->count());
        $this->assertDatabaseHas('idempotency_requests', [
            'user_id' => $this->finance->id,
            'key' => $key,
            'endpoint' => 'POST /api/v1/admin/finance/wallet/adjust',
            'status' => IdempotencyRequest::STATUS_COMPLETED,
        ]);
    }

    public function test_same_key_different_payload_rejected_without_second_mutation(): void
    {
        $key = 'adj-p1c-mismatch-'.Str::uuid();

        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/wallet/adjust', [
            'user_id' => $this->customer->id,
            'amount' => 4000,
            'direction' => 'credit',
            'reason' => 'first',
            'idempotency_key' => $key,
        ])->assertOk();

        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/wallet/adjust', [
            'user_id' => $this->customer->id,
            'amount' => 9000,
            'direction' => 'credit',
            'reason' => 'tampered',
            'idempotency_key' => $key,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['idempotency_key'], 'errors');

        $this->customerWallet->refresh();
        $this->assertEquals(104000.00, (float) $this->customerWallet->balance);
        $this->assertEquals(1, WalletMutation::query()
            ->where('wallet_id', $this->customerWallet->id)
            ->where('type', WalletMutation::TYPE_ADJUSTMENT)
            ->count());
    }

    public function test_customer_cannot_call_adjust_wallet(): void
    {
        $this->actingAs($this->customer)->postJson('/api/v1/admin/finance/wallet/adjust', [
            'user_id' => $this->customer->id,
            'amount' => 1000,
            'direction' => 'credit',
            'reason' => 'self credit',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertForbidden();

        $this->customerWallet->refresh();
        $this->assertEquals(100000.00, (float) $this->customerWallet->balance);
        $this->assertEquals(0, WalletMutation::query()
            ->where('wallet_id', $this->customerWallet->id)
            ->where('type', WalletMutation::TYPE_ADJUSTMENT)
            ->count());
    }

    public function test_owner_cannot_mutate_adjust_wallet_read_only(): void
    {
        $owner = User::create([
            'name' => 'Owner P1C',
            'email' => 'owner-p1c@gurkynet.test',
            'phone_number' => '081211100013',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
        ]);

        $this->actingAs($owner)->postJson('/api/v1/admin/finance/wallet/adjust', [
            'user_id' => $this->customer->id,
            'amount' => 1000,
            'direction' => 'credit',
            'reason' => 'owner attempt',
            'idempotency_key' => (string) Str::uuid(),
        ])->assertForbidden();

        $this->assertEquals(0, WalletMutation::query()
            ->where('wallet_id', $this->customerWallet->id)
            ->where('type', WalletMutation::TYPE_ADJUSTMENT)
            ->count());
    }

    public function test_missing_idempotency_key_rejected(): void
    {
        $this->actingAs($this->finance)->postJson('/api/v1/admin/finance/wallet/adjust', [
            'user_id' => $this->customer->id,
            'amount' => 1000,
            'direction' => 'credit',
            'reason' => 'no key',
        ])->assertStatus(422);

        $this->assertEquals(0, WalletMutation::query()
            ->where('wallet_id', $this->customerWallet->id)
            ->where('type', WalletMutation::TYPE_ADJUSTMENT)
            ->count());
    }

    /**
     * P1-D — HTTP SoT reclaim after post-commit failure must not double-credit.
     * Simulates: mutation commits, then operation throws → idempotency marked FAILED → retry same key.
     */
    public function test_post_commit_failure_reclaim_does_not_double_mutate(): void
    {
        $key = 'adj-p1d-reclaim-'.Str::uuid();
        $endpoint = 'POST /api/v1/admin/finance/wallet/adjust';
        $payload = [
            'user_id' => $this->customer->id,
            'amount' => 6000,
            'direction' => 'credit',
            'reason' => 'P1D reclaim',
        ];

        $svc = app(IdempotencyRequestService::class);
        $action = app(AdjustWalletAction::class);

        try {
            $svc->run($this->finance->id, $key, $endpoint, $payload, function () use ($action, $key) {
                $tx = $action->execute(
                    $this->customer,
                    6000,
                    'credit',
                    'P1D reclaim',
                    $this->finance,
                    $key
                );

                throw new \RuntimeException('simulated post-commit failure after wallet mutation');
            });
            $this->fail('Expected post-commit exception');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('simulated post-commit', $e->getMessage());
        }

        $this->customerWallet->refresh();
        $this->assertEquals(106000.00, (float) $this->customerWallet->balance);
        $this->assertEquals(1, WalletMutation::query()
            ->where('wallet_id', $this->customerWallet->id)
            ->where('type', WalletMutation::TYPE_ADJUSTMENT)
            ->count());

        // Reclaim same key (FAILED row rotated) — must return existing txn, no second credit.
        $replay = $svc->run($this->finance->id, $key, $endpoint, $payload, function () use ($action, $key) {
            $tx = $action->execute(
                $this->customer,
                6000,
                'credit',
                'P1D reclaim',
                $this->finance,
                $key
            );

            return [
                'result' => $tx,
                'snapshot' => ['body' => ['success' => true, 'data' => ['id' => $tx->id]], 'http_status' => 200],
                'http_status' => 200,
            ];
        });

        $this->assertFalse($replay['replay']);
        $this->customerWallet->refresh();
        $this->assertEquals(106000.00, (float) $this->customerWallet->balance);
        $this->assertEquals(1, WalletMutation::query()
            ->where('wallet_id', $this->customerWallet->id)
            ->where('type', WalletMutation::TYPE_ADJUSTMENT)
            ->count());
        $this->assertEquals(1, Transaction::query()
            ->where('user_id', $this->customer->id)
            ->where('payment_method', 'adjustment')
            ->count());
    }
}
