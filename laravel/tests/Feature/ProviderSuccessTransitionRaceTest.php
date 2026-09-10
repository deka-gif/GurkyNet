<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Events\PaymentSettled;
use App\Events\TransactionSuccess;
use App\Models\DigiflazzTransaction;
use App\Models\PaymentHistory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Transactions\TransactionSuccessTransitionService;
use App\Services\WalletRefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * P0 — Digiflazz/VIP SUCCESS must never revive FAILED+refunded; duplicate SUCCESS idempotent.
 */
class ProviderSuccessTransitionRaceTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected Product $product;

    protected string $webhookSecret = 'testing_webhook_secret';

    protected string $vipApiId = 'api-id-test';

    protected string $vipApiKey = 'api-key-test';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.digiflazz.username' => 'buyer-user',
            'services.digiflazz.api_key' => 'buyer-key',
            'services.digiflazz.webhook_secret' => $this->webhookSecret,
            'services.vip.username' => $this->vipApiId,
            'services.vip.merchant_id' => $this->vipApiId,
            'services.vip.api_key' => $this->vipApiKey,
        ]);

        $this->user = User::create([
            'name' => 'P0 Success Race',
            'email' => 'p0-success-race@example.com',
            'phone_number' => '081299990001',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W-P0-SR-1',
            'balance' => 50000,
            'status' => 'active',
        ]);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-p0-sr', 'icon' => 'phone']);
        $brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);
        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'sku_code' => 'P0-TSEL10',
            'name' => 'Telkomsel 10K',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    protected function makeInFlightTx(string $providerCode = ProductProvider::CODE_DIGIFLAZZ, ?string $providerRef = null): Transaction
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-P0-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 11000,
            'admin_fee' => 0,
            'total_payment' => 11000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PENDING_SUPPLIER->value,
            'fulfillment_provider_code' => $providerCode,
            'provider_ref' => $providerRef ?? ('REF-'.uniqid()),
            'timeout_at' => now()->addMinutes(5),
        ]);

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => $this->product->sku_code,
            'product_name' => $this->product->name,
            'qty' => 1,
            'price' => 11000,
        ]);

        // Simulate purchase debit already held.
        $this->wallet->update(['balance' => 39000]);

        return $tx;
    }

    protected function refundTx(Transaction $tx): array
    {
        return app(WalletRefundService::class)->refundOnce(
            $tx,
            'Refund test: '.$tx->invoice_number,
            'p0_test_refund',
            'Gagal uji',
            TransactionStatus::FAILED->value
        );
    }

    protected function postDigiflazzSuccess(Transaction $tx, string $sn = 'SN-LATE-1'): \Illuminate\Testing\TestResponse
    {
        DigiflazzTransaction::query()->firstOrCreate(
            ['transaction_id' => $tx->id],
            [
                'ref_id' => $tx->invoice_number,
                'buyer_sku_code' => $this->product->sku_code,
                'customer_no' => $tx->target_number,
                'digiflazz_status' => 'pending',
            ]
        );

        $payload = [
            'data' => [
                'ref_id' => $tx->invoice_number,
                'buyer_sku_code' => $this->product->sku_code,
                'customer_no' => $tx->target_number,
                'status' => 'Sukses',
                'sn' => $sn,
                'rc' => '00',
                'message' => 'Transaksi Sukses',
            ],
        ];
        $body = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $sig = 'sha1='.hash_hmac('sha1', $body, $this->webhookSecret);

        return $this->call(
            'POST',
            '/api/v1/webhooks/digiflazz',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_HUB_SIGNATURE' => $sig,
            ],
            $body
        );
    }

    /** TEST 1 — FAILED + refunded → late SUCCESS must not revive. */
    public function test_late_success_after_refund_is_rejected(): void
    {
        Event::fake([TransactionSuccess::class, PaymentSettled::class]);

        $tx = $this->makeInFlightTx();
        $refund = $this->refundTx($tx);
        $this->assertTrue($refund['credited']);

        $balanceAfterRefund = (float) $this->wallet->fresh()->balance;
        $refundMutationCount = WalletMutation::where('reference_id', (string) $tx->id)
            ->where('type', WalletMutation::TYPE_REFUND)
            ->count();

        $response = $this->postDigiflazzSuccess($tx->fresh());
        $response->assertOk();

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertNotNull($fresh->refunded_at);
        $this->assertSame($balanceAfterRefund, (float) $this->wallet->fresh()->balance);
        $this->assertSame(
            $refundMutationCount,
            WalletMutation::where('reference_id', (string) $tx->id)
                ->where('type', WalletMutation::TYPE_REFUND)
                ->count()
        );
        Event::assertNotDispatched(TransactionSuccess::class);
        Event::assertNotDispatched(PaymentSettled::class);
    }

    /** TEST 2 — SUCCESS → duplicate SUCCESS idempotent (one event). */
    public function test_duplicate_success_is_idempotent(): void
    {
        Event::fake([TransactionSuccess::class, PaymentSettled::class]);

        $tx = $this->makeInFlightTx();
        $writer = app(TransactionSuccessTransitionService::class);

        $first = $writer->apply($tx->id, [
            'provider_code' => ProductProvider::CODE_DIGIFLAZZ,
            'source' => 'test_first',
            'sn' => 'SN-1',
            'sync_digiflazz_mirror' => false,
        ]);
        $this->assertSame(TransactionSuccessTransitionService::OUTCOME_APPLIED, $first['outcome']);
        $this->assertTrue($first['events_dispatched']);

        $second = $writer->apply($tx->id, [
            'provider_code' => ProductProvider::CODE_DIGIFLAZZ,
            'source' => 'test_duplicate',
            'sn' => 'SN-2',
            'sync_digiflazz_mirror' => false,
        ]);
        $this->assertSame(TransactionSuccessTransitionService::OUTCOME_ALREADY_SUCCESS, $second['outcome']);
        $this->assertFalse($second['events_dispatched']);

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        Event::assertDispatchedTimes(TransactionSuccess::class, 1);
        Event::assertDispatchedTimes(PaymentSettled::class, 1);
    }

    /** TEST 3 — SUCCESS then FAILURE: stays SUCCESS, no refund credit. */
    public function test_failure_after_success_does_not_force_failed_or_second_credit(): void
    {
        $tx = $this->makeInFlightTx();
        app(TransactionSuccessTransitionService::class)->apply($tx->id, [
            'provider_code' => ProductProvider::CODE_DIGIFLAZZ,
            'source' => 'test_success_first',
            'sn' => 'SN-OK',
            'sync_digiflazz_mirror' => false,
        ]);

        $balance = (float) $this->wallet->fresh()->balance;
        $result = $this->refundTx($tx->fresh());

        $this->assertFalse($result['credited']);
        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertNull($tx->fresh()->refunded_at);
        $this->assertSame($balance, (float) $this->wallet->fresh()->balance);
    }

    /** TEST 3b — FAILURE/refund then SUCCESS writer: atomic reject. */
    public function test_success_writer_after_failure_refund_is_atomic_reject(): void
    {
        Event::fake([TransactionSuccess::class, PaymentSettled::class]);

        $tx = $this->makeInFlightTx();
        $this->refundTx($tx);

        $outcome = app(TransactionSuccessTransitionService::class)->apply($tx->id, [
            'provider_code' => ProductProvider::CODE_DIGIFLAZZ,
            'source' => 'test_after_refund',
            'sn' => 'SN-LATE',
            'sync_digiflazz_mirror' => false,
        ]);

        $this->assertSame(TransactionSuccessTransitionService::OUTCOME_REJECTED_REFUNDED, $outcome['outcome']);
        $this->assertFalse($outcome['events_dispatched']);
        $this->assertSame(TransactionStatus::FAILED->value, $tx->fresh()->status);
        $this->assertNotNull($tx->fresh()->refunded_at);
        Event::assertNotDispatched(TransactionSuccess::class);
    }

    /**
     * TEST 4 — refund then SUCCESS webhook cannot yield SUCCESS + refunded_at.
     * (Application-level race simulation; true multi-worker NEEDS LIVE TEST.)
     */
    public function test_refund_then_webhook_success_cannot_yield_success_with_refunded_at(): void
    {
        Event::fake([TransactionSuccess::class, PaymentSettled::class]);

        $tx = $this->makeInFlightTx();
        $this->refundTx($tx);
        $this->postDigiflazzSuccess($tx->fresh())->assertOk();

        $fresh = $tx->fresh();
        $this->assertFalse(
            TransactionStatus::SUCCESS->value === $fresh->status && $fresh->refunded_at !== null,
            'Invariant broken: SUCCESS with refunded_at'
        );
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertNotNull($fresh->refunded_at);
    }

    /** TEST 5 — webhook SUCCESS vs reconciliation SUCCESS → exactly one success effect. */
    public function test_webhook_and_reconciliation_success_exactly_once(): void
    {
        Event::fake([TransactionSuccess::class, PaymentSettled::class]);

        $tx = $this->makeInFlightTx();
        DigiflazzTransaction::create([
            'transaction_id' => $tx->id,
            'ref_id' => $tx->invoice_number,
            'buyer_sku_code' => $this->product->sku_code,
            'customer_no' => $tx->target_number,
            'digiflazz_status' => 'pending',
        ]);

        $this->postDigiflazzSuccess($tx)->assertOk();

        $recon = app(TransactionSuccessTransitionService::class)->apply($tx->id, [
            'provider_code' => ProductProvider::CODE_DIGIFLAZZ,
            'source' => 'transaction_timeout_engine',
            'sn' => 'SN-RECON',
            'sync_digiflazz_mirror' => false,
        ]);

        $this->assertSame(TransactionSuccessTransitionService::OUTCOME_ALREADY_SUCCESS, $recon['outcome']);
        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        Event::assertDispatchedTimes(TransactionSuccess::class, 1);
        $this->assertSame(
            1,
            PaymentHistory::where('transaction_id', $tx->id)->where('status', 'success')->count()
        );
    }

    /** TEST 6 — duplicate Digiflazz SUCCESS webhook → exactly once. */
    public function test_duplicate_digiflazz_webhook_success_exactly_once(): void
    {
        Event::fake([TransactionSuccess::class, PaymentSettled::class]);

        $tx = $this->makeInFlightTx();
        DigiflazzTransaction::create([
            'transaction_id' => $tx->id,
            'ref_id' => $tx->invoice_number,
            'buyer_sku_code' => $this->product->sku_code,
            'customer_no' => $tx->target_number,
            'digiflazz_status' => 'pending',
        ]);

        $this->postDigiflazzSuccess($tx, 'SN-A')->assertOk();
        $this->postDigiflazzSuccess($tx, 'SN-B')->assertOk();

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        Event::assertDispatchedTimes(TransactionSuccess::class, 1);
    }

    /** VIP webhook late SUCCESS after refund (VIP may be OFF — endpoint still guarded). */
    public function test_vip_webhook_late_success_after_refund_rejected(): void
    {
        Event::fake([TransactionSuccess::class, PaymentSettled::class]);

        $tx = $this->makeInFlightTx(ProductProvider::CODE_VIP, 'VP-P0-LATE');
        $this->refundTx($tx);
        $balance = (float) $this->wallet->fresh()->balance;

        $response = $this->postJson('/api/v1/webhooks/vip', [
            'result' => true,
            'data' => [[
                'trxid' => 'VP-P0-LATE',
                'data' => '081234567890',
                'service' => 'Xl',
                'status' => 'success',
                'note' => 'SN-VIP-LATE',
                'price' => 11000,
            ]],
        ], [
            'X-Client-Signature' => md5($this->vipApiId.$this->vipApiKey),
        ]);

        $response->assertOk();
        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertNotNull($fresh->refunded_at);
        $this->assertSame($balance, (float) $this->wallet->fresh()->balance);
        Event::assertNotDispatched(TransactionSuccess::class);
    }
}
