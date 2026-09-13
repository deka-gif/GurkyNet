<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Jobs\ProcessDigiflazzTransaction;
use App\Jobs\ProcessProductProviderTransaction;
use App\Jobs\ProcessVoucherPhysicalBatchItem;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\VoucherPhysicalBatch;
use App\Models\VoucherPhysicalBatchItem;
use App\Models\Wallet;
use App\Services\ProductProviders\ProductProviderFulfillmentService;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Job exhausted / inconclusive hard-stop must NOT auto-refund (ShopeePay soft-timeout principle).
 */
class JobExhaustedNoAutoRefundTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Job Exhaust User',
            'email' => 'jobexhaust@gurkypay.com',
            'phone_number' => '081299990101',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W91001',
            'balance' => 100000,
            'status' => 'active',
        ]);
    }

    protected function makeInFlightTx(): Transaction
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-JE-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 11000,
            'admin_fee' => 0,
            'total_payment' => 11000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PROCESSING->value,
            'notes' => 'Sedang diproses',
            'fulfillment_provider_code' => ProductProvider::CODE_DIGIFLAZZ,
            'provider_sku_used' => 'xld10',
            'provider_ref' => 'REF-JE-1',
        ]);

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => 'xld10',
            'product_name' => 'Test',
            'price' => 11000,
            'quantity' => 1,
        ]);

        $this->wallet->balance -= 11000;
        $this->wallet->save();

        return $tx->fresh(['user']);
    }

    public function test_product_provider_job_exhausted_escalates_without_refund(): void
    {
        $tx = $this->makeInFlightTx();
        $before = (float) $this->wallet->fresh()->balance;

        $job = new ProcessProductProviderTransaction($tx->id);
        $job->failed(new \RuntimeException('Simulated worker timeout / tries exhausted'));

        $fresh = $tx->fresh();
        $this->assertNull($fresh->refunded_at);
        $this->assertNotEquals(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertNotEquals(TransactionStatus::REFUNDED->value, $fresh->status);
        $this->assertSame('manual_review', $fresh->provider_last_status);
        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);

        $this->assertDatabaseHas('finance_alerts', [
            'type' => 'ppob_manual_review',
            'related_type' => 'transaction',
            'related_id' => $tx->id,
            'status' => 'open',
        ]);
        $this->assertDatabaseHas('ops_alerts', [
            'type' => 'ppob_manual_review',
            'related_type' => 'transaction',
            'related_id' => $tx->id,
            'status' => 'open',
        ]);
    }

    public function test_legacy_digiflazz_job_exhausted_escalates_without_refund(): void
    {
        $tx = $this->makeInFlightTx();
        $before = (float) $this->wallet->fresh()->balance;

        $job = new ProcessDigiflazzTransaction($tx->id);
        $job->failed(new \RuntimeException('Legacy job exhausted'));

        $fresh = $tx->fresh();
        $this->assertNull($fresh->refunded_at);
        $this->assertSame('manual_review', $fresh->provider_last_status);
        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertDatabaseHas('finance_alerts', [
            'type' => 'ppob_manual_review',
            'related_id' => $tx->id,
            'status' => 'open',
        ]);
    }

    public function test_on_job_exhausted_via_fulfillment_service_no_refund(): void
    {
        $tx = $this->makeInFlightTx();
        $before = (float) $this->wallet->fresh()->balance;

        app(ProductProviderFulfillmentService::class)->onJobExhausted(
            $tx,
            new \RuntimeException('queue timeout')
        );

        $this->assertNull($tx->fresh()->refunded_at);
        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertSame('manual_review', $tx->fresh()->provider_last_status);
    }

    public function test_explicit_digi_gagal_hard_stop_still_refunds(): void
    {
        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-je', 'icon' => 'phone']);
        $brand = Provider::create(['name' => 'XL', 'logo' => null, 'is_active' => true]);
        $digi = ProductProvider::digiflazz();
        $this->assertNotNull($digi);
        $digi->update(['is_active' => true, 'api_status' => 'online']);

        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'JE-XL10',
            'name' => 'XL 10K',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        \App\Models\ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'JE-XL10',
            'base_price' => 10000,
            'is_preferred' => true,
            'is_active' => true,
        ]);

        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-JE-GAGAL-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 11000,
            'admin_fee' => 0,
            'total_payment' => 11000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::LOCKED->value,
            'notes' => 'Locked',
        ]);
        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => $product->sku_code,
            'product_name' => $product->name,
            'price' => 11000,
            'quantity' => 1,
            'custom_metadata' => ['sku' => $product->sku_code],
        ]);
        $this->wallet->balance -= 11000;
        $this->wallet->save();
        $before = (float) $this->wallet->fresh()->balance;

        $gagal = ProviderFulfillmentResult::failed(
            20,
            'provider_rejected',
            false,
            'Nomor salah',
            [
                'data' => [
                    'ref_id' => $tx->invoice_number,
                    'status' => 'Gagal',
                    'rc' => '20',
                    'message' => 'Nomor salah',
                    'sn' => null,
                ],
            ]
        );

        $digiAdapter = \Mockery::mock(\App\Services\ProductProviders\DigiflazzProductProviderAdapter::class);
        $digiAdapter->shouldReceive('code')->andReturn(ProductProvider::CODE_DIGIFLAZZ);
        $digiAdapter->shouldReceive('isConfigured')->andReturn(true);
        $digiAdapter->shouldReceive('fulfill')->andReturn($gagal);
        $digiAdapter->shouldReceive('checkStatus')->andReturn($gagal);
        $digiAdapter->shouldReceive('healthCheck')->andReturn([
            'reachable' => true,
            'authenticated' => true,
            'balance' => 1,
            'latency_ms' => 1,
            'message' => 'ok',
        ]);

        $vipAdapter = \Mockery::mock(\App\Services\ProductProviders\VipPulsaProductProviderAdapter::class);
        $vipAdapter->shouldReceive('code')->andReturn(ProductProvider::CODE_VIP);
        $vipAdapter->shouldReceive('isConfigured')->andReturn(false);
        $vipAdapter->shouldReceive('fulfill')->andReturn(ProviderFulfillmentResult::error(1, 'skip', false));
        $vipAdapter->shouldReceive('checkStatus')->andReturn(ProviderFulfillmentResult::pending(1));
        $vipAdapter->shouldReceive('healthCheck')->andReturn([
            'reachable' => false,
            'authenticated' => false,
            'balance' => null,
            'latency_ms' => 1,
            'message' => 'off',
        ]);

        $this->app->instance(
            \App\Services\ProductProviders\ProductProviderRegistry::class,
            new \App\Services\ProductProviders\ProductProviderRegistry($digiAdapter, $vipAdapter)
        );

        app(ProductProviderFulfillmentService::class)->fulfill($tx->fresh(['items', 'user']));

        $fresh = $tx->fresh();
        $this->assertTrue(in_array($fresh->status, [
            TransactionStatus::FAILED->value,
            TransactionStatus::REFUNDED->value,
        ], true));
        $this->assertNotNull($fresh->refunded_at);
        $this->assertEquals($before + 11000, (float) $this->wallet->fresh()->balance);
    }

    public function test_batch_item_empty_failure_reason_does_not_refund(): void
    {
        $category = ProductCategory::create(['name' => 'VI', 'slug' => 'voucher-internet', 'icon' => 'wifi']);
        $brand = Provider::create(['name' => 'XL', 'logo' => null, 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'sku_code' => 'XLVIFISIKJE',
            'name' => 'VI Fisik',
            'base_price' => 10000,
            'sell_price' => 10000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-BATCH-JE-'.uniqid(),
            'service_name' => 'Voucher Internet',
            'target_number' => 'BATCH',
            'amount' => 10000,
            'admin_fee' => 0,
            'total_payment' => 10000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::LOCKED->value,
        ]);
        $this->wallet->balance -= 10000;
        $this->wallet->save();
        $before = (float) $this->wallet->fresh()->balance;

        $batch = VoucherPhysicalBatch::create([
            'user_id' => $this->user->id,
            'transaction_id' => $tx->id,
            'product_id' => $product->id,
            'sku_code' => 'XLVIFISIKJE',
            'status' => VoucherPhysicalBatch::STATUS_PROCESSING,
            'total_serials' => 1,
            'success_count' => 0,
            'failed_count' => 0,
            'refunded_count' => 0,
            'unit_price' => 10000,
            'total_payment' => 10000,
        ]);

        $item = VoucherPhysicalBatchItem::create([
            'batch_id' => $batch->id,
            'serial_number' => 'SNJE0001',
            'status' => VoucherPhysicalBatchItem::STATUS_PROCESSING,
            'failure_reason' => null,
            'provider_code' => 'digiflazz',
            'provider_sku' => 'XLVIFISIKJE',
        ]);

        $job = new ProcessVoucherPhysicalBatchItem($item->id, 'digiflazz', 'XLVIFISIKJE', 60);
        $job->failed(new \RuntimeException('worker killed'));

        $item->refresh();
        $this->assertSame(VoucherPhysicalBatchItem::STATUS_PROCESSING, $item->status);
        $this->assertNull($item->refunded_at);
        $this->assertEquals($before, (float) $this->wallet->fresh()->balance);
        $this->assertDatabaseHas('finance_alerts', [
            'type' => 'ppob_manual_review',
            'related_type' => 'voucher_physical_batch_item',
            'related_id' => $item->id,
            'status' => 'open',
        ]);
    }
}
