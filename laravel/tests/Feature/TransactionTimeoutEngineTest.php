<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Enums\WalletHistoryType;
use App\Jobs\WatchPendingTransactionJob;
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
use App\Services\ProductProviders\ProductProviderRegistry;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Services\Transactions\TransactionTimeoutService;
use App\Services\WalletRefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

class TransactionTimeoutEngineTest extends TestCase
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
            'ppob.timeout.max_seconds' => 60,
            'ppob.timeout.check_at_seconds' => [15, 30, 45, 60],
        ]);

        $this->user = User::create([
            'name' => 'Timeout User',
            'email' => 'timeout@gurkypay.com',
            'phone_number' => '081299990001',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W90001',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-to', 'icon' => 'phone']);
        $brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->vip);
        $this->vip->update(['is_active' => true, 'api_status' => 'online', 'priority' => 1]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'TO-TSEL10',
            'name' => 'Timeout Telkomsel 10K',
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

    protected function makeInFlightTransaction(array $overrides = []): Transaction
    {
        $tx = Transaction::create(array_merge([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-TO-' . uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 11000,
            'admin_fee' => 0,
            'total_payment' => 11000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PROCESSING->value,
            'notes' => 'Sedang diproses',
            'timeout_at' => now()->addSeconds(60),
            'fulfillment_provider_code' => ProductProvider::CODE_VIP,
            'provider_sku_used' => 'SP10',
            'provider_ref' => 'VIP-TRX-1',
            'created_at' => now()->subSeconds(60),
            'updated_at' => now()->subSeconds(60),
        ], $overrides));

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => $this->product->sku_code,
            'product_name' => $this->product->name,
            'price' => 11000,
            'quantity' => 1,
        ]);

        // Simulate wallet already debited at create time.
        $this->wallet->balance -= 11000;
        $this->wallet->save();

        return $tx->fresh(['items', 'user']);
    }

    protected function bindVipAdapter(callable $statusFactory): void
    {
        $vipAdapter = \Mockery::mock(\App\Services\ProductProviders\VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn(ProductProvider::CODE_VIP);
        $vipAdapter->shouldReceive('isConfigured')->andReturn(true);
        $vipAdapter->shouldReceive('checkStatus')->andReturnUsing($statusFactory);
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

        $registry = new ProductProviderRegistry($digiAdapter, $vipAdapter);
        $this->app->instance(ProductProviderRegistry::class, $registry);
    }

    public function test_provider_success_on_status_check_no_refund(): void
    {
        $tx = $this->makeInFlightTransaction();
        $balanceBefore = (float) $this->wallet->fresh()->balance;

        $this->bindVipAdapter(fn () => ProviderFulfillmentResult::success(20, 'SN-OK', ['ok' => true], 'OK'));

        app(TransactionTimeoutService::class)->handleCheck($tx->id, 3);

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::SUCCESS->value, $fresh->status);
        $this->assertNull($fresh->refunded_at);
        $this->assertEquals($balanceBefore, (float) $this->wallet->fresh()->balance);
        $this->assertFalse(
            WalletHistory::where('reference_id', $tx->id)->where('type', WalletHistoryType::CREDIT->value)->exists()
        );
    }

    public function test_provider_failed_on_status_check_refunds_once(): void
    {
        $tx = $this->makeInFlightTransaction();
        $balanceBefore = (float) $this->wallet->fresh()->balance;

        $this->bindVipAdapter(fn () => ProviderFulfillmentResult::failed(20, 'provider_rejected', false, 'Gagal', []));

        app(TransactionTimeoutService::class)->handleCheck($tx->id, 3);

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertNotNull($fresh->refunded_at);
        $this->assertEquals($balanceBefore + 11000, (float) $this->wallet->fresh()->balance);
    }

    public function test_pending_forever_times_out_and_refunds(): void
    {
        $tx = $this->makeInFlightTransaction([
            'created_at' => now()->subSeconds(61),
            'timeout_at' => now()->subSecond(),
        ]);
        $balanceBefore = (float) $this->wallet->fresh()->balance;

        $this->bindVipAdapter(fn () => ProviderFulfillmentResult::pending(15, [], 'still pending'));

        app(TransactionTimeoutService::class)->handleCheck($tx->id, 3);

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertNotNull($fresh->refunded_at);
        $this->assertEquals($balanceBefore + 11000, (float) $this->wallet->fresh()->balance);
        $this->assertStringContainsString('batas waktu', (string) $fresh->notes);
    }

    public function test_duplicate_timeout_execution_refunds_only_once(): void
    {
        $tx = $this->makeInFlightTransaction([
            'created_at' => now()->subSeconds(61),
            'timeout_at' => now()->subSecond(),
        ]);
        $balanceBefore = (float) $this->wallet->fresh()->balance;

        $this->bindVipAdapter(fn () => ProviderFulfillmentResult::pending(15, [], 'still pending'));

        $service = app(TransactionTimeoutService::class);
        $service->handleCheck($tx->id, 3);
        $service->handleCheck($tx->id, 3);

        $this->assertEquals($balanceBefore + 11000, (float) $this->wallet->fresh()->balance);
        $this->assertSame(
            1,
            WalletHistory::where('reference_id', $tx->id)
                ->where('type', WalletHistoryType::CREDIT->value)
                ->where('description', 'like', 'Refund%')
                ->count()
        );
    }

    public function test_success_transaction_never_refunded(): void
    {
        $tx = $this->makeInFlightTransaction();
        $tx->update(['status' => TransactionStatus::SUCCESS->value]);
        $balanceBefore = (float) $this->wallet->fresh()->balance;

        $result = app(WalletRefundService::class)->refundOnce(
            $tx,
            'Refund should be refused',
            'test',
            'nope',
            TransactionStatus::FAILED->value
        );

        $this->assertFalse($result['credited']);
        $this->assertTrue($result['already_refunded']);
        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals($balanceBefore, (float) $this->wallet->fresh()->balance);
    }

    public function test_arm_schedules_first_watch_job(): void
    {
        Queue::fake();

        $tx = $this->makeInFlightTransaction([
            'status' => TransactionStatus::PENDING->value,
            'created_at' => now(),
            'timeout_at' => null,
        ]);

        app(TransactionTimeoutService::class)->arm($tx);

        Queue::assertPushed(WatchPendingTransactionJob::class, function (WatchPendingTransactionJob $job) use ($tx) {
            return $job->transactionId === $tx->id && $job->checkIndex === 0;
        });

        $this->assertNotNull($tx->fresh()->timeout_at);
    }

    public function test_reconcile_overdue_redispatches_final_check(): void
    {
        Queue::fake();

        $tx = $this->makeInFlightTransaction([
            'created_at' => now()->subMinutes(5),
            'timeout_at' => now()->subMinute(),
        ]);

        $count = app(TransactionTimeoutService::class)->reconcileOverdue();

        $this->assertSame(1, $count);
        Queue::assertPushed(WatchPendingTransactionJob::class, function (WatchPendingTransactionJob $job) use ($tx) {
            return $job->transactionId === $tx->id && $job->checkIndex === 3;
        });
    }

    public function test_mid_ladder_reschedules_when_still_pending(): void
    {
        Queue::fake();

        $tx = $this->makeInFlightTransaction([
            'created_at' => now()->subSeconds(15),
            'timeout_at' => now()->addSeconds(45),
        ]);

        $this->bindVipAdapter(fn () => ProviderFulfillmentResult::pending(10, [], 'wait'));

        app(TransactionTimeoutService::class)->handleCheck($tx->id, 0);

        $this->assertSame(TransactionStatus::PROCESSING->value, $tx->fresh()->status);
        Queue::assertPushed(WatchPendingTransactionJob::class, function (WatchPendingTransactionJob $job) use ($tx) {
            return $job->transactionId === $tx->id && $job->checkIndex === 1;
        });
    }
}
