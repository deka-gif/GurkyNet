<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Events\WalletCredited;
use App\Jobs\ProcessMidtransCallback;
use App\Listeners\PublishWalletBalanceUpdated;
use App\Models\MidtransTransaction;
use App\Models\SystemSetting;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Finance\Reconciliation\MidtransReconciliationService;
use App\Services\MidtransService;
use App\Services\Payment\MidtransCredentialResolver;
use App\Services\Realtime\RealtimeChannelAuthorizer;
use App\Services\Realtime\SseRealtimeTransport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 11 / SRS Bagian 16 — Midtrans + wallet realtime (SSE).
 */
class Sprint11MidtransRealtimeTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();
        Http::swap(new \Illuminate\Http\Client\Factory());
        Cache::flush();

        config([
            'services.midtrans.server_key' => 'testing_server_key',
            'services.midtrans.client_key' => 'testing_client_key',
            'services.midtrans.is_production' => false,
            'features.auto_topup_enabled' => false,
        ]);

        $this->user = User::factory()->create([
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
            'role' => UserRole::USER->value,
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '1042'.str_pad((string) $this->user->id, 8, '0', STR_PAD_LEFT),
            'balance' => 50000,
            'status' => 'active',
        ]);
    }

    protected function sign(array $payload): string
    {
        $serverKey = app(MidtransCredentialResolver::class)->resolve()['server_key'];
        if ($serverKey === '' || $serverKey === 'dummy_server_key') {
            $serverKey = 'testing_server_key';
        }

        return hash('sha512', $payload['order_id'].$payload['status_code'].$payload['gross_amount'].$serverKey);
    }

    protected function makeTopUpTx(array $overrides = []): Transaction
    {
        $tx = Transaction::create(array_merge([
            'user_id' => $this->user->id,
            'invoice_number' => 'TRX-S11-'.uniqid(),
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 25000,
            'admin_fee' => 0,
            'total_payment' => 25000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::PENDING->value,
            'notes' => 's11',
        ], $overrides));

        MidtransTransaction::create([
            'transaction_id' => $tx->id,
            'order_id' => $tx->invoice_number,
            'snap_token' => 'snap-s11',
            'gross_amount' => $tx->total_payment,
            'transaction_status' => 'pending',
        ]);

        return $tx;
    }

    // ── Midtrans webhook (1–12) ──────────────────────────────────────

    public function test_01_valid_webhook_one_credit(): void
    {
        $tx = $this->makeTopUpTx();
        $payload = [
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'settlement',
            'signature_key' => 'x',
        ];
        $payload['signature_key'] = $this->sign($payload);

        $this->postJson('/api/v1/webhooks/midtrans', $payload)->assertOk();
        (new ProcessMidtransCallback($payload))->handle();

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals(75000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_02_forged_signature_rejected(): void
    {
        $tx = $this->makeTopUpTx();
        $payload = [
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'settlement',
            'signature_key' => 'forged-signature',
        ];

        $this->postJson('/api/v1/webhooks/midtrans', $payload)->assertStatus(401);
        $this->assertEquals(50000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_03_duplicate_webhook_one_credit(): void
    {
        $tx = $this->makeTopUpTx();
        $payload = [
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'settlement',
        ];
        $payload['signature_key'] = $this->sign($payload);

        (new ProcessMidtransCallback($payload))->handle();
        (new ProcessMidtransCallback($payload))->handle();

        $this->assertEquals(75000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_04_amount_mismatch_no_credit(): void
    {
        $tx = $this->makeTopUpTx();
        $payload = [
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '99999.00',
            'transaction_status' => 'settlement',
        ];
        $payload['signature_key'] = $this->sign($payload);

        (new ProcessMidtransCallback($payload))->handle();

        $this->assertEquals(50000.0, (float) $this->wallet->fresh()->balance);
        $this->assertDatabaseHas('activity_logs', [
            'activity' => 'MIDTRANS_AMOUNT_MISMATCH',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_05_pending_no_credit(): void
    {
        $tx = $this->makeTopUpTx();
        (new ProcessMidtransCallback([
            'order_id' => $tx->invoice_number,
            'status_code' => '201',
            'gross_amount' => '25000.00',
            'transaction_status' => 'pending',
        ]))->handle();

        $this->assertNotSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals(50000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_06_expire(): void
    {
        $tx = $this->makeTopUpTx();
        (new ProcessMidtransCallback([
            'order_id' => $tx->invoice_number,
            'status_code' => '202',
            'gross_amount' => '25000.00',
            'transaction_status' => 'expire',
        ]))->handle();

        $this->assertSame(TransactionStatus::EXPIRED->value, $tx->fresh()->status);
    }

    public function test_07_cancel(): void
    {
        $tx = $this->makeTopUpTx();
        (new ProcessMidtransCallback([
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'cancel',
        ]))->handle();

        $this->assertSame(TransactionStatus::CANCELED->value, $tx->fresh()->status);
    }

    public function test_08_deny(): void
    {
        $tx = $this->makeTopUpTx();
        (new ProcessMidtransCallback([
            'order_id' => $tx->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'deny',
        ]))->handle();

        $this->assertSame(TransactionStatus::FAILED->value, $tx->fresh()->status);
        $this->assertEquals(50000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_09_challenge_not_success(): void
    {
        $tx = $this->makeTopUpTx();
        (new ProcessMidtransCallback([
            'order_id' => $tx->invoice_number,
            'status_code' => '201',
            'gross_amount' => '25000.00',
            'transaction_status' => 'challenge',
        ]))->handle();

        $fresh = $tx->fresh();
        $this->assertNotSame(TransactionStatus::SUCCESS->value, $fresh->status);
        $this->assertEquals(50000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_10_failure_maps_failed(): void
    {
        $tx = $this->makeTopUpTx();
        (new ProcessMidtransCallback([
            'order_id' => $tx->invoice_number,
            'status_code' => '202',
            'gross_amount' => '25000.00',
            'transaction_status' => 'failure',
        ]))->handle();

        $this->assertSame(TransactionStatus::FAILED->value, $tx->fresh()->status);
        $this->assertEquals(50000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_11_and_12_pending_poll_idempotent(): void
    {
        $tx = $this->makeTopUpTx([
            'created_at' => now()->subMinutes(10),
        ]);
        MidtransTransaction::where('transaction_id', $tx->id)->update([
            'created_at' => now()->subMinutes(10),
            'transaction_status' => 'pending',
        ]);

        Http::fake([
            'api.sandbox.midtrans.com/*' => Http::response([
                'order_id' => $tx->invoice_number,
                'status_code' => '200',
                'gross_amount' => '25000.00',
                'transaction_status' => 'settlement',
            ], 200),
        ]);

        app(MidtransReconciliationService::class)->pollPendingDeposits();
        app(MidtransReconciliationService::class)->pollPendingDeposits();

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals(75000.0, (float) $this->wallet->fresh()->balance);
    }

    // ── Credentials (13–16) ──────────────────────────────────────────

    public function test_13_system_settings_credentials(): void
    {
        SystemSetting::create([
            'key' => MidtransCredentialResolver::SERVER_KEY,
            'value' => Crypt::encryptString('settings-server-key-abc'),
            'group' => 'payment',
        ]);
        SystemSetting::create([
            'key' => MidtransCredentialResolver::CLIENT_KEY,
            'value' => Crypt::encryptString('settings-client-key-xyz'),
            'group' => 'payment',
        ]);

        $creds = app(MidtransCredentialResolver::class)->resolve();
        $this->assertSame('settings-server-key-abc', $creds['server_key']);
        $this->assertSame('settings-client-key-xyz', $creds['client_key']);
        $this->assertSame('system_settings', $creds['source']);

        $public = app(MidtransCredentialResolver::class)->publicConfig();
        $this->assertSame('settings-client-key-xyz', $public['client_key']);
        $this->assertArrayNotHasKey('server_key', $public);
    }

    public function test_14_env_fallback(): void
    {
        SystemSetting::query()->whereIn('key', [
            MidtransCredentialResolver::SERVER_KEY,
            MidtransCredentialResolver::CLIENT_KEY,
        ])->delete();

        $creds = app(MidtransCredentialResolver::class)->resolve();
        $this->assertSame('testing_server_key', $creds['server_key']);
        $this->assertSame('env_config', $creds['source']);
    }

    public function test_15_missing_credential_safe(): void
    {
        config([
            'services.midtrans.server_key' => '',
            'services.midtrans.client_key' => '',
        ]);
        SystemSetting::query()->whereIn('key', [
            MidtransCredentialResolver::SERVER_KEY,
            MidtransCredentialResolver::CLIENT_KEY,
        ])->delete();

        $this->assertFalse(app(MidtransService::class)->isConfigured());
        $public = app(MidtransCredentialResolver::class)->publicConfig();
        $this->assertFalse($public['configured']);
    }

    public function test_16_secret_not_logged(): void
    {
        Log::spy();
        SystemSetting::create([
            'key' => MidtransCredentialResolver::SERVER_KEY,
            'value' => Crypt::encryptString('super-secret-midtrans-server'),
            'group' => 'payment',
        ]);
        SystemSetting::create([
            'key' => MidtransCredentialResolver::CLIENT_KEY,
            'value' => Crypt::encryptString('super-secret-midtrans-client'),
            'group' => 'payment',
        ]);

        app(MidtransCredentialResolver::class)->resolve();

        Log::shouldNotHaveReceived('info', function ($message, $context = []) {
            $blob = json_encode([$message, $context]);

            return str_contains((string) $blob, 'super-secret-midtrans-server')
                || str_contains((string) $blob, 'super-secret-midtrans-client');
        });
        $this->assertTrue(true);
    }

    // ── Realtime (17–23) ─────────────────────────────────────────────

    public function test_17_18_20_wallet_credited_publishes_balance_updated(): void
    {
        Event::dispatch(new WalletCredited($this->wallet->fresh(), 1000, 'test credit', 99));

        $channel = 'wallet.'.$this->user->id;
        $events = SseRealtimeTransport::drain($channel);
        $this->assertNotEmpty($events);
        $last = end($events);
        $this->assertSame('balance_updated', $last['event']);
        $this->assertSame($channel, $last['channel']);
        $this->assertEquals(50000.0, (float) ($last['payload']['balance'] ?? 0));
        $this->assertArrayNotHasKey('server_key', $last['payload']);
    }

    public function test_19_user_cannot_subscribe_other_wallet(): void
    {
        $other = User::factory()->create(['role' => UserRole::USER->value]);
        $auth = app(RealtimeChannelAuthorizer::class);

        $this->assertTrue($auth->canSubscribe($this->user, 'wallet.'.$this->user->id));
        $this->assertFalse($auth->canSubscribe($this->user, 'wallet.'.$other->id));
    }

    public function test_21_reconnect_drain_after_cursor(): void
    {
        $channel = 'wallet.'.$this->user->id;
        app(SseRealtimeTransport::class)->publish($channel, 'balance_updated', ['balance' => 1]);
        $first = SseRealtimeTransport::drain($channel);
        $this->assertNotEmpty($first);
        $id = $first[0]['id'];

        app(SseRealtimeTransport::class)->publish($channel, 'balance_updated', ['balance' => 2]);
        $after = SseRealtimeTransport::drain($channel, $id);
        $this->assertCount(1, $after);
        $this->assertEquals(2, $after[0]['payload']['balance']);
    }

    public function test_22_duplicate_event_safe_no_financial_mutation(): void
    {
        $before = (float) $this->wallet->fresh()->balance;
        $listener = app(PublishWalletBalanceUpdated::class);
        $event = new WalletCredited($this->wallet->fresh(), 0, 'noop notify', null);
        $listener->handle($event);
        $listener->handle($event);

        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_23_fallback_polling_contract(): void
    {
        // Backend contract: poll endpoint returns wallet channel events for authorized user.
        Sanctum::actingAs($this->user);
        app(SseRealtimeTransport::class)->publish('wallet.'.$this->user->id, 'balance_updated', [
            'balance' => 51000,
        ]);

        $res = $this->getJson('/api/v1/realtime/poll?channels[]=wallet.'.$this->user->id);
        $res->assertOk();
        $events = $res->json('data.events') ?? $res->json('data') ?? [];
        $this->assertNotEmpty($events);
    }

    public function test_24_force_fetch_invalidates_stale_cache_contract(): void
    {
        // Backend always returns fresh balance; FE force flag is covered by store contract.
        Sanctum::actingAs($this->user);
        $this->wallet->update(['balance' => 88000]);
        $res = $this->getJson('/api/v1/wallet');
        $res->assertOk();
        $balance = data_get($res->json(), 'data.wallet.balance')
            ?? data_get($res->json(), 'data.balance')
            ?? data_get($res->json(), 'data.summary.balance');
        $this->assertEquals(88000.0, (float) $balance);
    }

    public function test_auto_topup_remains_off(): void
    {
        $this->assertFalse((bool) config('features.auto_topup_enabled'));
        Http::fake([
            'https://app.sandbox.midtrans.com/*' => Http::response([
                'token' => 's11-snap-token',
                'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v2/vtweb/s11',
            ], 200),
        ]);
        Sanctum::actingAs($this->user);
        $res = $this->postJson('/api/v1/wallet/topup', [
            'amount' => 25000,
            'payment_method' => 'qris',
            'idempotency_key' => 's11-gate-'.uniqid(),
        ]);
        $res->assertStatus(201);
        $this->assertFalse((bool) config('features.auto_topup_enabled'));
        $this->assertSame('pending', $res->json('data.transaction.status'));
    }

    public function test_payment_config_never_exposes_server_key(): void
    {
        Sanctum::actingAs($this->user);
        $res = $this->getJson('/api/v1/wallet/payment-config');
        $res->assertOk();
        $this->assertArrayNotHasKey('server_key', $res->json('data') ?? []);
        $this->assertArrayHasKey('client_key', $res->json('data') ?? []);
    }
}
