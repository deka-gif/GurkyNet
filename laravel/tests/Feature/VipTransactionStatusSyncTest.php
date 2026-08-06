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
use App\Services\ProductProviders\ProductProviderFulfillmentService;
use App\Services\ProductProviders\VipPulsaProductProviderAdapter;
use App\Services\Transactions\TransactionTimeoutService;
use App\Services\VipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * VIP create-order → provider_ref → status poll → SUCCESS settle (root-cause coverage).
 */
class VipTransactionStatusSyncTest extends TestCase
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
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'services.vip.username' => 'api-id-test',
            'services.vip.merchant_id' => 'api-id-test',
            'services.vip.api_key' => 'api-key-test',
            'services.vip.signature' => '',
            'ppob.timeout.max_seconds' => 60,
            'ppob.timeout.check_at_seconds' => [5, 15, 30, 45, 60],
        ]);

        $this->user = User::create([
            'name' => 'VIP Sync User',
            'email' => 'vip-sync@gurkypay.com',
            'phone_number' => '081288880001',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W88001',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->vip);
        $this->vip->update(['is_active' => true, 'api_status' => 'online', 'priority' => 1]);

        ProductProvider::digiflazz()?->update(['is_active' => false]);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-vip-sync', 'icon' => 'phone']);
        $brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-TSEL10',
            'name' => 'VIP Telkomsel 10K',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'TSEL10',
            'provider_name' => 'TSEL10',
            'base_price' => 10000,
            'is_active' => true,
        ]);
    }

    protected function makePendingTx(): Transaction
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-VIP-' . uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 11000,
            'admin_fee' => 0,
            'total_payment' => 11000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PENDING->value,
            'timeout_at' => now()->addSeconds(60),
        ]);

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => $this->product->sku_code,
            'product_name' => $this->product->name,
            'price' => 11000,
            'quantity' => 1,
        ]);

        $this->wallet->balance -= 11000;
        $this->wallet->save();

        WalletHistory::create([
            'wallet_id' => $this->wallet->id,
            'amount' => 11000,
            'type' => WalletHistoryType::DEBIT->value,
            'description' => 'Pembelian Pulsa',
            'reference_id' => $tx->id,
        ]);

        return $tx->fresh(['items', 'user']);
    }

    public function test_create_order_list_payload_persists_provider_ref_and_stays_pending(): void
    {
        Queue::fake();

        // VIP sometimes returns data as a list even on create.
        Http::fake([
            'vip-reseller.co.id/api/prepaid' => Http::response([
                'result' => true,
                'message' => 'Pesanan berhasil',
                'data' => [
                    [
                        'trxid' => 'VIP-TRX-LIST-1',
                        'status' => 'waiting',
                        'note' => 'Menunggu proses',
                    ],
                ],
            ], 200),
        ]);

        $tx = $this->makePendingTx();
        app(ProductProviderFulfillmentService::class)->fulfill($tx);

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::PENDING->value, $fresh->status);
        $this->assertSame('VIP-TRX-LIST-1', $fresh->provider_ref);
        $this->assertSame(ProductProvider::CODE_VIP, $fresh->fulfillment_provider_code);
        $this->assertNotNull($fresh->provider_response);
        $this->assertNotNull($fresh->provider_transaction_time);

        Queue::assertPushed(WatchPendingTransactionJob::class, function (WatchPendingTransactionJob $job) use ($tx) {
            return $job->transactionId === $tx->id;
        });
    }

    public function test_status_poll_with_trxid_settles_success_completed_at_and_notification(): void
    {
        $tx = $this->makePendingTx();
        $tx->update([
            'status' => TransactionStatus::PROCESSING->value,
            'fulfillment_provider_code' => ProductProvider::CODE_VIP,
            'provider_sku_used' => 'TSEL10',
            'provider_ref' => 'VIP-TRX-OK-9',
            'created_at' => now()->subSeconds(20),
        ]);

        Http::fake([
            'vip-reseller.co.id/api/prepaid' => Http::response([
                'result' => true,
                'message' => 'OK',
                'data' => [
                    [
                        'trxid' => 'OTHER',
                        'status' => 'pending',
                        'note' => 'x',
                    ],
                    [
                        'trxid' => 'VIP-TRX-OK-9',
                        'status' => 'success',
                        'note' => 'SN:998877',
                        'sn' => '998877',
                    ],
                ],
            ], 200),
        ]);

        // Use real VIP adapter through timeout engine.
        app(TransactionTimeoutService::class)->handleCheck($tx->id, 1);

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::SUCCESS->value, $fresh->status);
        $this->assertNotNull($fresh->completed_at);
        $this->assertSame('success', $fresh->provider_last_status);
        $this->assertStringContainsString('998877', (string) $fresh->notes);
        $this->assertNull($fresh->refunded_at);

        $this->assertDatabaseHas('notifications', [
            'title' => 'Pembayaran Berhasil',
            'type' => 'transaction_success',
        ]);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['type'] ?? null) === 'status'
                && ($body['trxid'] ?? null) === 'VIP-TRX-OK-9'
                && !array_key_exists('reff_id', $body);
        });
    }

    public function test_status_failed_refunds_wallet_once(): void
    {
        $tx = $this->makePendingTx();
        $tx->update([
            'status' => TransactionStatus::PROCESSING->value,
            'fulfillment_provider_code' => ProductProvider::CODE_VIP,
            'provider_sku_used' => 'TSEL10',
            'provider_ref' => 'VIP-TRX-FAIL-1',
            'created_at' => now()->subSeconds(20),
        ]);
        $balanceBefore = (float) $this->wallet->fresh()->balance;

        Http::fake([
            'vip-reseller.co.id/api/prepaid' => Http::response([
                'result' => true,
                'data' => [
                    [
                        'trxid' => 'VIP-TRX-FAIL-1',
                        'status' => 'error',
                        'note' => 'Nomor salah',
                    ],
                ],
            ], 200),
        ]);

        app(TransactionTimeoutService::class)->handleCheck($tx->id, 1);

        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertNotNull($fresh->refunded_at);
        $this->assertEquals($balanceBefore + 11000, (float) $this->wallet->fresh()->balance);
    }

    public function test_check_prepaid_status_sends_trxid_not_reff_id(): void
    {
        Http::fake([
            'vip-reseller.co.id/api/prepaid' => Http::response([
                'result' => true,
                'data' => [
                    ['trxid' => 'T1', 'status' => 'success', 'note' => 'ok'],
                ],
            ], 200),
        ]);

        $result = app(VipService::class)->checkPrepaidStatus('T1', 'GRK-SHOULD-NOT-BE-SENT');

        $this->assertSame('success', $result['normalized_status']);
        $this->assertSame('T1', $result['trxid']);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['type'] ?? null) === 'status'
                && ($body['trxid'] ?? null) === 'T1'
                && !array_key_exists('reff_id', $body);
        });
    }

    public function test_adapter_check_status_requires_provider_ref_path(): void
    {
        $tx = $this->makePendingTx();
        $tx->update([
            'provider_ref' => 'VIP-REF-42',
            'fulfillment_provider_code' => ProductProvider::CODE_VIP,
        ]);

        Http::fake([
            'vip-reseller.co.id/api/prepaid' => Http::response([
                'result' => true,
                'data' => [
                    ['trxid' => 'VIP-REF-42', 'status' => 'success', 'sn' => 'SN1', 'note' => 'SN1'],
                ],
            ], 200),
        ]);

        $result = app(VipPulsaProductProviderAdapter::class)->checkStatus(
            $tx,
            'TSEL10',
            '081234567890',
            $tx->invoice_number
        );

        $this->assertTrue($result->ok);
        $this->assertSame('success', $result->status);
        $this->assertSame('SN1', $result->sn);
    }
}
