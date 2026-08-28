<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Jobs\ProcessMidtransCallback;
use App\Models\MidtransTransaction;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * FR-USR03 — user-initiated wallet top-up (NOT AUTO_TOPUP).
 */
class UserTopUpPaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected User $other;

    protected Wallet $wallet;

    protected Wallet $otherWallet;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'features.auto_topup_enabled' => false,
            'features.purchase_enabled' => false,
            'features.withdraw_enabled' => false,
            'services.midtrans.server_key' => 'testing_server_key',
            'services.midtrans.client_key' => 'testing_client_key',
            'services.midtrans.is_production' => false,
            'services.midtrans.enabled_channels' => null,
        ]);

        $this->user = User::create([
            'name' => 'TopUp User',
            'email' => 'topup-user@gurkynet.test',
            'phone_number' => '081299900001',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104299900001',
            'balance' => 25000,
            'status' => 'active',
        ]);

        $this->other = User::create([
            'name' => 'Other User',
            'email' => 'topup-other@gurkynet.test',
            'phone_number' => '081299900002',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        $this->otherWallet = Wallet::create([
            'user_id' => $this->other->id,
            'wallet_number' => '104299900002',
            'balance' => 10000,
            'status' => 'active',
        ]);
    }

    protected function acting(): static
    {
        return $this->actingAs($this->user);
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    protected function topupPayload(array $extra = []): array
    {
        return array_merge([
            'amount' => 10000,
            'payment_method' => 'qris',
            'idempotency_key' => (string) Str::uuid(),
        ], $extra);
    }

    protected function sign(array $payload): string
    {
        return hash(
            'sha512',
            $payload['order_id'].$payload['status_code'].$payload['gross_amount'].'testing_server_key'
        );
    }

    public function test_01_amount_below_10000_is_422(): void
    {
        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 9999,
        ]))->assertStatus(422)
            ->assertJsonPath('code', 'TOPUP_AMOUNT_TOO_SMALL');
    }

    public function test_02_amount_10000_is_valid(): void
    {
        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
        ]))->assertStatus(201)
            ->assertJsonPath('data.transaction.status', 'pending')
            ->assertJsonPath('data.payment.amount', 10000);
    }

    public function test_03_amount_50000_is_valid(): void
    {
        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 50000,
        ]))->assertStatus(201)
            ->assertJsonPath('data.payment.amount', 50000);
    }

    public function test_04_invalid_amount_rejected(): void
    {
        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000.5,
        ]))->assertStatus(422);

        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 0,
        ]))->assertStatus(422);

        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => -10000,
        ]))->assertStatus(422);

        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 'abc',
        ]))->assertStatus(422);
    }

    public function test_05_qris_creates_midtrans_snap_with_qris_channel(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'payment_method' => 'qris',
        ]));

        $res->assertStatus(201)
            ->assertJsonPath('data.payment.method', 'qris')
            ->assertJsonPath('data.payment.channel', 'qris')
            ->assertJsonPath('data.payment.status', 'pending');
        $this->assertNotEmpty($res->json('data.snap_token'));

        Http::assertSent(function ($request) {
            if (! str_contains((string) $request->url(), '/snap/v1/transactions')) {
                return false;
            }
            $data = $request->data();

            return ($data['enabled_payments'] ?? null) === ['other_qris']
                && ! isset($data['credit_card']);
        });
    }

    public function test_06_va_requires_bank_selection(): void
    {
        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'payment_method' => 'va',
            'channel' => null,
        ]))->assertStatus(422)
            ->assertJsonPath('code', 'TOPUP_CHANNEL_UNAVAILABLE');
    }

    public function test_07_selected_bank_reaches_backend(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'payment_method' => 'va',
            'channel' => 'bca',
        ]));

        $res->assertStatus(201)
            ->assertJsonPath('data.payment.method', 'va')
            ->assertJsonPath('data.payment.channel', 'bca_va')
            ->assertJsonPath('data.payment.channel_label', 'BCA');

        Http::assertSent(function ($request) {
            if (! str_contains((string) $request->url(), '/snap/v1/transactions')) {
                return false;
            }

            return ($request->data()['enabled_payments'] ?? null) === ['bca_va'];
        });
    }

    public function test_08_unsupported_bank_rejected(): void
    {
        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'payment_method' => 'va',
            'channel' => 'permata',
        ]))->assertStatus(422);

        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'payment_method' => 'va',
            'channel' => 'cimb',
        ]))->assertStatus(422);
    }

    public function test_09_retail_channel_works_when_enabled(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'payment_method' => 'retail',
            'channel' => 'alfamart',
        ]));

        $res->assertStatus(201)
            ->assertJsonPath('data.payment.method', 'retail')
            ->assertJsonPath('data.payment.channel', 'alfamart');

        Http::assertSent(function ($request) {
            if (! str_contains((string) $request->url(), '/snap/v1/transactions')) {
                return false;
            }

            return ($request->data()['enabled_payments'] ?? null) === ['alfamart'];
        });
    }

    public function test_10_unsupported_channel_rejected(): void
    {
        config(['services.midtrans.enabled_channels' => 'qris,bca_va']);

        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'payment_method' => 'retail',
            'channel' => 'indomaret',
        ]))->assertStatus(422);

        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'payment_method' => 'gopay',
        ]))->assertStatus(422);
    }

    public function test_11_duplicate_topup_request_safe(): void
    {
        $key = (string) Str::uuid();
        $payload = $this->topupPayload(['idempotency_key' => $key, 'amount' => 50000]);

        $first = $this->acting()->postJson('/api/v1/wallet/topup', $payload);
        $first->assertStatus(201);
        $invoice = $first->json('data.payment.order_id');

        $second = $this->acting()->postJson('/api/v1/wallet/topup', $payload);
        $second->assertStatus(201);
        $this->assertSame($invoice, $second->json('data.payment.order_id'));

        $this->assertSame(1, Transaction::query()->where('user_id', $this->user->id)->where('service_name', 'Top Up Saldo')->count());
    }

    public function test_12_same_idempotency_key_replay_safe(): void
    {
        $key = 'replay-topup-'.Str::uuid();
        $payload = $this->topupPayload(['idempotency_key' => $key]);

        $a = $this->acting()->postJson('/api/v1/wallet/topup', $payload)->assertStatus(201);
        $b = $this->acting()->postJson('/api/v1/wallet/topup', $payload)->assertStatus(201);

        $this->assertSame($a->json('data.snap_token'), $b->json('data.snap_token'));
        $this->assertSame(25000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_13_same_key_different_payload_rejected(): void
    {
        $key = 'conflict-topup-'.Str::uuid();
        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'idempotency_key' => $key,
            'amount' => 10000,
        ]))->assertStatus(201);

        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'idempotency_key' => $key,
            'amount' => 50000,
        ]))->assertStatus(422)
            ->assertJsonPath('code', 'TOPUP_IDEMPOTENCY_CONFLICT');
    }

    public function test_14_payment_starts_pending_no_credit(): void
    {
        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 25000,
        ]))->assertStatus(201)
            ->assertJsonPath('data.transaction.status', 'pending');

        $this->assertSame(25000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::query()->where('wallet_id', $this->wallet->id)->count());
    }

    public function test_15_webhook_success_one_wallet_credit(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
        ]))->assertStatus(201);

        $orderId = $res->json('data.payment.order_id');
        $payload = [
            'order_id' => $orderId,
            'status_code' => '200',
            'gross_amount' => '10000.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'qris',
        ];
        $payload['signature_key'] = $this->sign($payload);

        $this->postJson('/api/v1/webhooks/midtrans', $payload)->assertOk();

        $this->assertSame(35000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame('success', Transaction::where('invoice_number', $orderId)->value('status'));
        $this->assertSame(1, WalletMutation::query()->where('wallet_id', $this->wallet->id)->where('type', WalletMutation::TYPE_TOPUP)->count());
    }

    public function test_16_duplicate_webhook_no_second_credit(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
        ]))->assertStatus(201);
        $orderId = $res->json('data.payment.order_id');
        $payload = [
            'order_id' => $orderId,
            'status_code' => '200',
            'gross_amount' => '10000.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'qris',
        ];
        $payload['signature_key'] = $this->sign($payload);

        $this->postJson('/api/v1/webhooks/midtrans', $payload)->assertOk();
        $this->postJson('/api/v1/webhooks/midtrans', $payload)->assertOk();
        (new ProcessMidtransCallback($payload))->handle();

        $this->assertSame(35000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(1, WalletMutation::query()->where('wallet_id', $this->wallet->id)->where('type', WalletMutation::TYPE_TOPUP)->count());
    }

    public function test_17_invalid_signature_no_credit(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
        ]))->assertStatus(201);
        $orderId = $res->json('data.payment.order_id');

        $this->postJson('/api/v1/webhooks/midtrans', [
            'order_id' => $orderId,
            'status_code' => '200',
            'gross_amount' => '10000.00',
            'transaction_status' => 'settlement',
            'signature_key' => 'forged',
        ])->assertStatus(401);

        $this->assertSame(25000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::query()->where('wallet_id', $this->wallet->id)->count());
    }

    public function test_18_amount_mismatch_no_credit(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
        ]))->assertStatus(201);
        $orderId = $res->json('data.payment.order_id');
        $payload = [
            'order_id' => $orderId,
            'status_code' => '200',
            'gross_amount' => '99999.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'qris',
        ];
        $payload['signature_key'] = $this->sign($payload);

        $this->postJson('/api/v1/webhooks/midtrans', $payload)->assertOk();

        $this->assertSame(25000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::query()->where('wallet_id', $this->wallet->id)->count());
        $this->assertNotSame('success', Transaction::where('invoice_number', $orderId)->value('status'));
    }

    public function test_19_failed_payment_no_credit(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
        ]))->assertStatus(201);
        $orderId = $res->json('data.payment.order_id');
        $payload = [
            'order_id' => $orderId,
            'status_code' => '202',
            'gross_amount' => '10000.00',
            'transaction_status' => 'deny',
            'payment_type' => 'qris',
        ];
        $payload['signature_key'] = $this->sign($payload);

        $this->postJson('/api/v1/webhooks/midtrans', $payload)->assertOk();

        $this->assertSame(25000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::query()->where('wallet_id', $this->wallet->id)->count());
        $this->assertSame(TransactionStatus::FAILED->value, Transaction::where('invoice_number', $orderId)->value('status'));
    }

    public function test_20_pending_payment_no_credit(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
        ]))->assertStatus(201);
        $orderId = $res->json('data.payment.order_id');
        $payload = [
            'order_id' => $orderId,
            'status_code' => '201',
            'gross_amount' => '10000.00',
            'transaction_status' => 'pending',
            'payment_type' => 'qris',
        ];
        $payload['signature_key'] = $this->sign($payload);

        $this->postJson('/api/v1/webhooks/midtrans', $payload)->assertOk();

        $this->assertSame(25000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(0, WalletMutation::query()->where('wallet_id', $this->wallet->id)->count());
    }

    public function test_21_and_22_wallet_mutation_and_history_created_once(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
        ]))->assertStatus(201);
        $orderId = $res->json('data.payment.order_id');
        $txId = Transaction::where('invoice_number', $orderId)->value('id');
        $payload = [
            'order_id' => $orderId,
            'status_code' => '200',
            'gross_amount' => '10000.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'qris',
        ];
        $payload['signature_key'] = $this->sign($payload);
        $this->postJson('/api/v1/webhooks/midtrans', $payload)->assertOk();

        $this->assertSame(1, WalletMutation::query()
            ->where('wallet_id', $this->wallet->id)
            ->where('type', WalletMutation::TYPE_TOPUP)
            ->where('reference_id', (string) $txId)
            ->count());
        $this->assertSame(1, WalletHistory::query()
            ->where('wallet_id', $this->wallet->id)
            ->where('type', 'credit')
            ->count());
    }

    public function test_23_correct_user_owns_payment(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
            'user_id' => $this->other->id,
        ]))->assertStatus(201);

        $tx = Transaction::where('invoice_number', $res->json('data.payment.order_id'))->first();
        $this->assertNotNull($tx);
        $this->assertSame($this->user->id, $tx->user_id);
        $this->assertNotSame($this->other->id, $tx->user_id);
    }

    public function test_24_auto_topup_remains_off(): void
    {
        $this->assertFalse((bool) config('features.auto_topup_enabled'));
        $this->getJson('/api/v1/features')
            ->assertOk()
            ->assertJsonPath('data.auto_topup_enabled', false);

        $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload())->assertStatus(201);
        $this->assertFalse((bool) config('features.auto_topup_enabled'));
    }

    public function test_25_other_user_cannot_manipulate_topup(): void
    {
        $res = $this->acting()->postJson('/api/v1/wallet/topup', $this->topupPayload([
            'amount' => 10000,
        ]))->assertStatus(201);
        $orderId = $res->json('data.payment.order_id');

        $this->actingAs($this->other)->postJson('/api/v1/wallet/topup', [
            'amount' => 10000,
            'payment_method' => 'qris',
            'idempotency_key' => (string) Str::uuid(),
            'user_id' => $this->user->id,
        ])->assertStatus(201);

        $ownedByOther = Transaction::query()
            ->where('user_id', $this->other->id)
            ->where('service_name', 'Top Up Saldo')
            ->count();
        $this->assertSame(1, $ownedByOther);

        $original = Transaction::where('invoice_number', $orderId)->first();
        $this->assertSame($this->user->id, $original->user_id);

        $this->assertSame(25000.0, (float) $this->wallet->fresh()->balance);
        $this->assertSame(10000.0, (float) $this->otherWallet->fresh()->balance);
    }

    public function test_26_to_32_payment_config_catalog_for_frontend(): void
    {
        $res = $this->acting()->getJson('/api/v1/wallet/payment-config');
        $res->assertOk();
        $data = $res->json('data');

        $this->assertSame(10000, $data['min_amount']);
        $this->assertContains(10000, $data['quick_amounts']);
        $this->assertArrayNotHasKey('server_key', $data);
        $this->assertArrayHasKey('client_key', $data);

        $methods = collect($data['methods']);
        $qris = $methods->firstWhere('id', 'qris');
        $va = $methods->firstWhere('id', 'va');
        $retail = $methods->firstWhere('id', 'retail');

        $this->assertTrue((bool) $qris['enabled']);
        $this->assertArrayNotHasKey('banks', $qris);
        $this->assertNotEmpty($va['banks']);
        $this->assertTrue((bool) $va['enabled']);
        $this->assertSame(['BCA', 'BNI', 'BRI', 'Mandiri'], collect($va['banks'])->pluck('label')->all());
        $this->assertTrue((bool) $retail['enabled']);
        $this->assertSame(['alfamart', 'indomaret'], collect($retail['outlets'])->pluck('code')->all());

        config(['services.midtrans.enabled_channels' => 'qris']);
        $filtered = $this->acting()->getJson('/api/v1/wallet/payment-config')->json('data.methods');
        $this->assertTrue(collect($filtered)->firstWhere('id', 'qris')['enabled']);
        $this->assertFalse(collect($filtered)->firstWhere('id', 'va')['enabled']);
        $this->assertFalse(collect($filtered)->firstWhere('id', 'retail')['enabled']);
    }
}
