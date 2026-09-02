<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Enums\WalletHistoryType;
use App\Jobs\ProcessMidtransCallback;
use App\Jobs\WatchPendingTransactionJob;
use App\Models\MidtransTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHistory;
use App\Models\WalletMutation;
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Services\Transactions\TransactionTimeoutService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * FR-TOPUP-FIX-01 — Midtrans Top Up must never enter the PPOB timeout/refund ladder.
 */
class TopUpTimeoutIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected Product $product;

    protected ProductProvider $vip;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'ppob.timeout.max_seconds' => 180,
            'ppob.timeout.min_check_interval_seconds' => 60,
            'ppob.timeout.check_at_seconds' => [60, 120, 180],
            'services.midtrans.server_key' => 'testing_server_key',
            'services.midtrans.client_key' => 'testing_client_key',
            'services.midtrans.is_production' => false,
        ]);

        $this->user = User::create([
            'name' => 'TopUp Isolation User',
            'email' => 'topup-isolation@gurkynet.test',
            'phone_number' => '081299990101',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W90101',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-tu', 'icon' => 'phone']);
        $brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->vip);
        $this->vip->update(['is_active' => true, 'api_status' => 'online', 'priority' => 1]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'TU-TSEL10',
            'name' => 'Isolation Telkomsel 10K',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'SP10',
            'provider_name' => 'SP10',
            'base_price' => 10000,
            'is_active' => true,
        ]);
    }

    protected function makeTopUpTransaction(array $overrides = []): Transaction
    {
        return Transaction::create(array_merge([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-TU-' . uniqid(),
            'service_name' => 'Top Up Saldo',
            'target_number' => $this->wallet->wallet_number,
            'amount' => 25000,
            'admin_fee' => 0,
            'total_payment' => 25000,
            'payment_method' => 'midtrans',
            'status' => TransactionStatus::PENDING->value,
            'timeout_at' => null,
            'fulfillment_provider_code' => null,
            'created_at' => now()->subSeconds(200),
            'updated_at' => now()->subSeconds(200),
        ], $overrides));
    }

    protected function makeInFlightPpobTransaction(array $overrides = []): Transaction
    {
        $tx = Transaction::create(array_merge([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-PP-' . uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 11000,
            'admin_fee' => 0,
            'total_payment' => 11000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PROCESSING->value,
            'notes' => 'Sedang diproses',
            'timeout_at' => now()->subSecond(),
            'fulfillment_provider_code' => ProductProvider::CODE_VIP,
            'provider_sku_used' => 'SP10',
            'provider_ref' => 'VIP-TRX-ISO',
            'created_at' => now()->subSeconds(200),
            'updated_at' => now()->subSeconds(200),
        ], $overrides));

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => $this->product->sku_code,
            'product_name' => $this->product->name,
            'price' => 11000,
            'quantity' => 1,
        ]);

        $this->wallet->balance -= 11000;
        $this->wallet->save();

        return $tx->fresh(['items', 'user']);
    }

    protected function bindVipAdapterPending(): void
    {
        $vipAdapter = \Mockery::mock(\App\Services\ProductProviders\VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn(ProductProvider::CODE_VIP);
        $vipAdapter->shouldReceive('isConfigured')->andReturn(true);
        $vipAdapter->shouldReceive('checkStatus')->andReturn(ProviderFulfillmentResult::pending(15, [], 'still pending'));
        $vipAdapter->shouldReceive('fulfill')->andReturn(ProviderFulfillmentResult::pending(10, [], 'pending'));
        $vipAdapter->shouldReceive('healthCheck')->andReturn([
            'reachable' => true,
            'authenticated' => true,
            'balance' => 1,
            'latency_ms' => 1,
            'message' => 'ok',
        ]);

        $digiAdapter = \Mockery::mock(\App\Services\ProductProviders\DigiflazzProductProviderAdapter::class);
        $digiAdapter->shouldReceive('code')->andReturn(ProductProvider::CODE_DIGIFLAZZ);
        $digiAdapter->shouldReceive('isConfigured')->andReturn(false);
        $digiAdapter->shouldReceive('checkStatus')->andReturn(ProviderFulfillmentResult::pending(1, [], 'n/a'));
        $digiAdapter->shouldReceive('fulfill')->andReturn(ProviderFulfillmentResult::error(1, 'skip', false));
        $digiAdapter->shouldReceive('healthCheck')->andReturn([
            'reachable' => false,
            'authenticated' => false,
            'balance' => null,
            'latency_ms' => 1,
            'message' => 'off',
        ]);

        $this->app->instance(ProductProviderRegistry::class, new ProductProviderRegistry($digiAdapter, $vipAdapter));
    }

    protected function sign(array $payload): string
    {
        return hash(
            'sha512',
            $payload['order_id'].$payload['status_code'].$payload['gross_amount'].'testing_server_key'
        );
    }

    public function test_01_reconcile_overdue_skips_pending_top_up_without_timeout_at(): void
    {
        Queue::fake();

        $topUp = $this->makeTopUpTransaction();
        $ppob = $this->makeInFlightPpobTransaction();
        $balanceAfterPpob = (float) $this->wallet->fresh()->balance;

        $count = app(TransactionTimeoutService::class)->reconcileOverdue();

        $this->assertSame(1, $count);
        Queue::assertPushed(WatchPendingTransactionJob::class, function (WatchPendingTransactionJob $job) use ($ppob) {
            return $job->transactionId === $ppob->id;
        });
        Queue::assertNotPushed(WatchPendingTransactionJob::class, function (WatchPendingTransactionJob $job) use ($topUp) {
            return $job->transactionId === $topUp->id;
        });

        $this->assertSame(TransactionStatus::PENDING->value, $topUp->fresh()->status);
        $this->assertEquals($balanceAfterPpob, (float) $this->wallet->fresh()->balance);
    }

    public function test_02_handle_check_on_top_up_does_not_change_status_or_balance(): void
    {
        $topUp = $this->makeTopUpTransaction();
        $balanceBefore = (float) $this->wallet->fresh()->balance;
        $finalIndex = max(0, count(app(TransactionTimeoutService::class)->checkOffsets()) - 1);

        app(TransactionTimeoutService::class)->handleCheck($topUp->id, $finalIndex);

        $this->assertSame(TransactionStatus::PENDING->value, $topUp->fresh()->status);
        $this->assertNull($topUp->fresh()->refunded_at);
        $this->assertEquals($balanceBefore, (float) $this->wallet->fresh()->balance);
        $this->assertSame(
            0,
            WalletMutation::query()
                ->where('wallet_id', $this->wallet->id)
                ->whereIn('type', [WalletMutation::TYPE_REFUND, WalletMutation::TYPE_TOPUP])
                ->count()
        );
        $this->assertFalse(
            WalletHistory::where('reference_id', $topUp->id)
                ->where('type', WalletHistoryType::CREDIT->value)
                ->exists()
        );
    }

    public function test_03_ppob_overdue_still_refunds_after_top_up_isolation(): void
    {
        $this->makeTopUpTransaction();
        $ppob = $this->makeInFlightPpobTransaction();
        $balanceBefore = (float) $this->wallet->fresh()->balance;

        $this->bindVipAdapterPending();
        app(TransactionTimeoutService::class)->handleCheck($ppob->id, 2);

        $this->assertSame(TransactionStatus::FAILED->value, $ppob->fresh()->status);
        $this->assertNotNull($ppob->fresh()->refunded_at);
        $this->assertEquals($balanceBefore + 11000, (float) $this->wallet->fresh()->balance);
    }

    public function test_04_top_up_after_false_timeout_check_credits_wallet_exactly_once(): void
    {
        $topUp = $this->makeTopUpTransaction();
        $balanceBefore = (float) $this->wallet->fresh()->balance;

        MidtransTransaction::create([
            'transaction_id' => $topUp->id,
            'order_id' => $topUp->invoice_number,
            'snap_token' => 'snap-tu-iso',
            'gross_amount' => $topUp->total_payment,
            'transaction_status' => 'pending',
        ]);

        app(TransactionTimeoutService::class)->handleCheck($topUp->id, 2);
        $this->assertSame(TransactionStatus::PENDING->value, $topUp->fresh()->status);
        $this->assertEquals($balanceBefore, (float) $this->wallet->fresh()->balance);

        $payload = [
            'order_id' => $topUp->invoice_number,
            'status_code' => '200',
            'gross_amount' => '25000.00',
            'transaction_status' => 'settlement',
            'payment_type' => 'qris',
        ];
        $payload['signature_key'] = $this->sign($payload);

        (new ProcessMidtransCallback($payload))->handle();

        $this->assertSame(TransactionStatus::SUCCESS->value, $topUp->fresh()->status);
        $this->assertEquals($balanceBefore + 25000, (float) $this->wallet->fresh()->balance);
        $this->assertSame(
            1,
            WalletMutation::query()
                ->where('wallet_id', $this->wallet->id)
                ->where('type', WalletMutation::TYPE_TOPUP)
                ->where('reference_id', $topUp->id)
                ->count()
        );
    }
}
