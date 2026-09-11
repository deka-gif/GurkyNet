<?php

namespace Tests\Feature;

use App\Models\IdempotencyRequest;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Transactions\IdempotencyRequestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * P1-B — idempotency_requests must be scoped per authenticated user (SRS 14.1).
 */
class IdempotencyCrossUserIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected User $userA;

    protected User $userB;

    protected Wallet $walletA;

    protected Wallet $walletB;

    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Http::fake([
            'https://app.sandbox.midtrans.com/snap/v1/transactions' => Http::response([
                'token' => 'snap-test',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v1/payment-page/snap-test',
            ], 201),
        ]);

        config([
            'wallet.topup_fee' => 0,
            'wallet.transfer_fee' => 0,
            'wallet.withdraw_fee' => 0,
        ]);

        $this->userA = User::create([
            'name' => 'Idem A',
            'email' => 'idem-a@gurkynet.test',
            'phone_number' => '081234567830',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        $this->walletA = Wallet::create([
            'user_id' => $this->userA->id,
            'wallet_number' => 'W-IDEM-A',
            'balance' => 200000,
            'status' => 'active',
        ]);

        $this->userB = User::create([
            'name' => 'Idem B',
            'email' => 'idem-b@gurkynet.test',
            'phone_number' => '081234567831',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        $this->walletB = Wallet::create([
            'user_id' => $this->userB->id,
            'wallet_number' => 'W-IDEM-B',
            'balance' => 200000,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'Pulsa',
            'slug' => 'pulsa-idem',
            'icon' => 'phone',
        ]);
        $provider = Provider::create([
            'name' => 'Telkomsel',
            'logo' => 't.png',
            'is_active' => true,
        ]);
        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'IDEM-TSEL10K',
            'name' => 'Telkomsel 10K',
            'base_price' => 10000.00,
            'sell_price' => 11000.00,
            'admin_fee' => 0.00,
            'status' => true,
        ]);
    }

    public function test_schema_unique_is_scoped_to_user_key_endpoint(): void
    {
        $indexes = Schema::getIndexes('idempotency_requests');
        $names = collect($indexes)->pluck('name')->all();

        $this->assertContains('uniq_idempotency_user_key_endpoint', $names);
        $this->assertNotContains('uniq_idempotency_key_endpoint', $names);

        $scoped = collect($indexes)->firstWhere('name', 'uniq_idempotency_user_key_endpoint');
        $this->assertNotNull($scoped);
        $this->assertTrue($scoped['unique'] ?? false);
        $this->assertEqualsCanonicalizing(
            ['user_id', 'key', 'endpoint'],
            $scoped['columns'] ?? []
        );
    }

    public function test_user_b_cannot_replay_user_a_topup_snapshot_with_same_key(): void
    {
        $key = 'shared-topup-key-'.Str::uuid();
        $body = [
            'amount' => 50000,
            'payment_method' => 'qris',
            'idempotency_key' => $key,
        ];

        $first = $this->actingAs($this->userA)->postJson('/api/v1/wallet/topup', $body);
        $first->assertCreated();
        $txA = (int) $first->json('data.transaction.id');
        $this->assertGreaterThan(0, $txA);
        $this->assertSame($this->userA->id, (int) Transaction::findOrFail($txA)->user_id);

        // Same key + identical hashable payload — must NOT return A's snapshot.
        $second = $this->actingAs($this->userB)->postJson('/api/v1/wallet/topup', $body);
        $second->assertCreated();
        $txB = (int) $second->json('data.transaction.id');

        $this->assertNotSame($txA, $txB);
        $this->assertSame($this->userB->id, (int) Transaction::findOrFail($txB)->user_id);
        $this->assertNotSame($first->json('data.transaction.invoice_number'), $second->json('data.transaction.invoice_number'));

        $this->assertEquals(2, IdempotencyRequest::query()->where('key', $key)->count());
        $this->assertDatabaseHas('idempotency_requests', [
            'user_id' => $this->userA->id,
            'key' => $key,
            'endpoint' => 'POST /api/v1/wallet/topup',
            'status' => IdempotencyRequest::STATUS_COMPLETED,
        ]);
        $this->assertDatabaseHas('idempotency_requests', [
            'user_id' => $this->userB->id,
            'key' => $key,
            'endpoint' => 'POST /api/v1/wallet/topup',
            'status' => IdempotencyRequest::STATUS_COMPLETED,
        ]);
    }

    public function test_same_user_replay_still_exactly_once_for_purchase(): void
    {
        $key = 'same-user-purchase-'.Str::uuid();
        $payload = [
            'sku_code' => 'IDEM-TSEL10K',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => $key,
        ];

        $first = $this->actingAs($this->userA)->postJson('/api/v1/transactions', $payload);
        $first->assertCreated();
        $txId = $first->json('data.id');

        $this->walletA->refresh();
        $balanceAfterFirst = (float) $this->walletA->balance;

        $second = $this->actingAs($this->userA)->postJson('/api/v1/transactions', $payload);
        $second->assertCreated();
        $this->assertSame($txId, $second->json('data.id'));

        $this->walletA->refresh();
        $this->assertEquals($balanceAfterFirst, (float) $this->walletA->balance);
        $this->assertEquals(1, Transaction::where('user_id', $this->userA->id)->count());
        $this->assertEquals(1, WalletMutation::where('wallet_id', $this->walletA->id)->where('type', 'hold')->count());
    }

    public function test_user_b_with_same_purchase_key_gets_own_transaction_not_a(): void
    {
        $key = 'shared-purchase-key-'.Str::uuid();
        $payload = [
            'sku_code' => 'IDEM-TSEL10K',
            'target_number' => '081234567890',
            'pin' => '123456',
            'idempotency_key' => $key,
        ];

        $a = $this->actingAs($this->userA)->postJson('/api/v1/transactions', $payload)->assertCreated();
        $b = $this->actingAs($this->userB)->postJson('/api/v1/transactions', $payload)->assertCreated();

        $this->assertNotSame($a->json('data.id'), $b->json('data.id'));
        $this->assertSame($this->userA->id, (int) Transaction::findOrFail($a->json('data.id'))->user_id);
        $this->assertSame($this->userB->id, (int) Transaction::findOrFail($b->json('data.id'))->user_id);

        $this->walletA->refresh();
        $this->walletB->refresh();
        $this->assertEquals(189000.00, (float) $this->walletA->balance);
        $this->assertEquals(189000.00, (float) $this->walletB->balance);
    }

    public function test_service_level_cross_user_isolation_and_same_user_replay(): void
    {
        $svc = app(IdempotencyRequestService::class);
        $key = 'svc-shared-'.Str::uuid();
        $endpoint = 'test:p1b:endpoint';
        $payload = ['amount' => 1000];

        $first = $svc->run($this->userA->id, $key, $endpoint, $payload, function () {
            return [
                'result' => ['owner' => 'A'],
                'snapshot' => ['body' => ['owner' => 'A'], 'http_status' => 200],
                'http_status' => 200,
            ];
        });
        $this->assertFalse($first['replay']);
        $this->assertSame('A', $first['snapshot']['body']['owner']);

        $replay = $svc->run($this->userA->id, $key, $endpoint, $payload, function () {
            $this->fail('Same-user replay must not re-run operation');
        });
        $this->assertTrue($replay['replay']);
        $this->assertSame('A', $replay['snapshot']['body']['owner']);

        $other = $svc->run($this->userB->id, $key, $endpoint, $payload, function () {
            return [
                'result' => ['owner' => 'B'],
                'snapshot' => ['body' => ['owner' => 'B'], 'http_status' => 200],
                'http_status' => 200,
            ];
        });
        $this->assertFalse($other['replay']);
        $this->assertSame('B', $other['snapshot']['body']['owner']);
    }
}
