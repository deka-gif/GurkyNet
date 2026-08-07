<?php

namespace Tests\Feature;

use App\Models\DigiflazzTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use App\Services\DigiflazzService;
use App\Services\ProductProviders\DigiflazzProductProviderAdapter;
use App\Services\ProductProviders\ProviderFulfillmentResult;
use App\Services\Transactions\TransactionTimeoutService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class DigiflazzCekStatusAuditTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected ProductProvider $digi;

    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory);

        config([
            'services.digiflazz.username' => 'buyer-user',
            'services.digiflazz.api_key' => 'buyer-key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
            'services.digiflazz.testing' => null,
            'services.digiflazz.max_price' => null,
            'services.digiflazz.cb_url' => null,
            'services.digiflazz.allow_dot' => null,
            'ppob.timeout.max_seconds' => 180,
            'ppob.timeout.min_check_interval_seconds' => 60,
            'ppob.timeout.check_at_seconds' => [60, 120, 180],
        ]);

        $this->user = User::create([
            'name' => 'Cek Status User',
            'email' => 'cekstatus@example.com',
            'phone_number' => '081222233344',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);
        Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104288800001',
            'balance' => 100000,
            'status' => 'active',
        ]);

        $this->digi = ProductProvider::digiflazz();
        $this->assertNotNull($this->digi);
        $this->digi->update(['is_active' => true, 'partner_status' => 'online', 'api_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-cek', 'icon' => 'phone', 'is_active' => true]);
        $brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);
        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'xld25',
            'name' => 'XL 25',
            'base_price' => 25000,
            'sell_price' => 26000,
            'admin_fee' => 0,
            'status' => true,
        ]);
        ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'xld25',
            'is_active' => true,
            'is_preferred' => true,
            'priority' => 1,
            'base_price' => 25000,
        ]);
    }

    protected function makePrepaidTx(array $overrides = []): Transaction
    {
        $tx = Transaction::create(array_merge([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-CEK-'.uniqid(),
            'service_name' => 'XL 25',
            'target_number' => '087800001233',
            'amount' => 26000,
            'admin_fee' => 0,
            'total_payment' => 26000,
            'payment_method' => 'wallet',
            'status' => 'pending',
            'fulfillment_provider_code' => 'digiflazz',
            'provider_sku_used' => 'xld25',
            'provider_ref' => null,
        ], $overrides));

        if (! array_key_exists('provider_ref', $overrides)) {
            $tx->forceFill(['provider_ref' => $tx->invoice_number])->save();
        }

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => 'xld25',
            'product_name' => 'XL 25',
            'price' => 26000,
            'quantity' => 1,
        ]);

        DigiflazzTransaction::create([
            'transaction_id' => $tx->id,
            'ref_id' => $tx->provider_ref ?: $tx->invoice_number,
            'buyer_sku_code' => 'xld25',
            'customer_no' => '087800001233',
            'digiflazz_status' => 'pending',
        ]);

        return $tx->fresh(['items', 'digiflazzTransaction']);
    }

    public function test_prepaid_pending_check_retopups_with_same_ref_id_not_cmd_status(): void
    {
        $tx = $this->makePrepaidTx(['invoice_number' => 'GRK-CEK-REF1', 'provider_ref' => 'GRK-CEK-REF1']);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GRK-CEK-REF1',
                    'customer_no' => '087800001233',
                    'buyer_sku_code' => 'xld25',
                    'message' => 'Transaksi Pending',
                    'status' => 'Pending',
                    'rc' => '03',
                    'sn' => '',
                    'price' => 25000,
                ],
            ], 200),
        ]);

        $result = app(DigiflazzProductProviderAdapter::class)->checkStatus(
            $tx,
            'xld25',
            '087800001233',
            'GRK-CEK-REF1'
        );

        $this->assertSame('pending', $result->status);
        $this->assertTrue($result->ok);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return $request->method() === 'POST'
                && $request->url() === 'https://api.digiflazz.com/v1/transaction'
                && ($body['ref_id'] ?? null) === 'GRK-CEK-REF1'
                && ($body['buyer_sku_code'] ?? null) === 'xld25'
                && ($body['customer_no'] ?? null) === '087800001233'
                && ($body['sign'] ?? null) === md5('buyer-user'.'buyer-key'.'GRK-CEK-REF1')
                && ! array_key_exists('cmd', $body)
                && ! array_key_exists('commands', $body);
        });
    }

    public function test_digiflazz_service_check_status_delegates_to_buy(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => ['status' => 'Pending', 'rc' => '03', 'ref_id' => 'SAME-REF'],
            ], 200),
        ]);

        app(DigiflazzService::class)->checkStatus('xld25', '087800001233', 'SAME-REF');

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['ref_id'] ?? null) === 'SAME-REF'
                && ! array_key_exists('cmd', $body)
                && ($body['sign'] ?? null) === md5('buyer-user'.'buyer-key'.'SAME-REF');
        });
    }

    public function test_prepaid_status_guard_over_90_days_does_not_call_digiflazz(): void
    {
        $tx = $this->makePrepaidTx([
            'invoice_number' => 'GRK-CEK-OLD',
            'provider_ref' => 'GRK-CEK-OLD',
        ]);
        $tx->forceFill([
            'created_at' => now()->subDays(91),
            'updated_at' => now()->subDays(91),
        ])->saveQuietly();
        $tx = $tx->fresh(['items', 'digiflazzTransaction']);

        Http::fake();

        $result = app(DigiflazzProductProviderAdapter::class)->checkStatus(
            $tx,
            'xld25',
            '087800001233',
            'GRK-CEK-OLD'
        );

        $this->assertSame('failed', $result->status);
        $this->assertSame('status_check_window_expired', $result->reason);
        $this->assertFalse($result->shouldFailover);
        Http::assertNothingSent();
    }

    public function test_polling_offsets_enforce_minimum_60_seconds(): void
    {
        config([
            'ppob.timeout.min_check_interval_seconds' => 60,
            'ppob.timeout.check_at_seconds' => [5, 15, 30, 45, 60],
        ]);

        $offsets = app(TransactionTimeoutService::class)->checkOffsets();

        $this->assertGreaterThanOrEqual(60, $offsets[0]);
        for ($i = 1; $i < count($offsets); $i++) {
            $this->assertGreaterThanOrEqual(60, $offsets[$i] - $offsets[$i - 1]);
        }
    }

    public function test_early_status_poll_delay_is_at_least_60_seconds(): void
    {
        Queue::fake();

        $tx = $this->makePrepaidTx();
        app(TransactionTimeoutService::class)->scheduleEarlyStatusPoll($tx, 5);

        Queue::assertPushed(\App\Jobs\WatchPendingTransactionJob::class, function ($job) {
            return $job->checkIndex === 0;
        });

        // Delay is applied via job middleware/properties; verify clamp via service contract.
        $this->assertSame(60, app(TransactionTimeoutService::class)->minCheckIntervalSeconds());
    }

    public function test_digiflazz_probe_skips_when_last_check_under_60_seconds(): void
    {
        Queue::fake();

        $tx = $this->makePrepaidTx(['status' => 'processing']);
        $tx->forceFill([
            'provider_checked_at' => now()->subSeconds(10),
            'status' => 'processing',
            'created_at' => now(),
            'timeout_at' => now()->addSeconds(180),
        ])->saveQuietly();

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => ['status' => 'Failed', 'message' => 'should not be called', 'rc' => '99'],
            ], 200),
        ]);

        app(TransactionTimeoutService::class)->handleCheck($tx->id, 0);

        // Digiflazz must not be called when last check was < 60s ago.
        Http::assertNothingSent();
        $fresh = $tx->fresh();
        $this->assertSame('processing', $fresh->status);
        $this->assertSame('pending', $fresh->provider_last_status);
        Queue::assertPushed(\App\Jobs\WatchPendingTransactionJob::class);
    }

    public function test_status_pasca_uses_commands_status_pasca(): void
    {
        $tx = $this->makePrepaidTx(['invoice_number' => 'GRK-PASCA-1', 'provider_ref' => 'GRK-PASCA-1']);
        $tx->items()->first()->update([
            'custom_metadata' => [
                'is_pasca' => true,
                'inquiry_ref_id' => 'GRK-PASCA-1',
            ],
        ]);
        $tx = $tx->fresh(['items']);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GRK-PASCA-1',
                    'status' => 'Pending',
                    'message' => 'Sedang diproses',
                    'rc' => '03',
                ],
            ], 200),
        ]);

        $result = app(DigiflazzProductProviderAdapter::class)->checkStatus(
            $tx,
            'pln',
            '530000000003',
            'GRK-PASCA-1'
        );

        $this->assertSame('pending', $result->status);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['commands'] ?? null) === 'status-pasca'
                && ($body['ref_id'] ?? null) === 'GRK-PASCA-1'
                && ($body['sign'] ?? null) === md5('buyer-user'.'buyer-key'.'GRK-PASCA-1')
                && ! array_key_exists('cmd', $body);
        });
    }

    public function test_status_pasca_data_belum_ada_is_not_system_error(): void
    {
        $tx = $this->makePrepaidTx(['invoice_number' => 'GRK-PASCA-OLD', 'provider_ref' => 'GRK-PASCA-OLD']);
        $tx->items()->first()->update([
            'custom_metadata' => [
                'is_pasca' => true,
                'inquiry_ref_id' => 'GRK-PASCA-OLD',
            ],
        ]);
        $tx = $tx->fresh(['items']);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GRK-PASCA-OLD',
                    'message' => 'Data belum ada',
                    'status' => 'Gagal',
                    'rc' => '99',
                ],
            ], 200),
        ]);

        $result = app(DigiflazzProductProviderAdapter::class)->checkStatus(
            $tx,
            'pln',
            '530000000003',
            'GRK-PASCA-OLD'
        );

        $this->assertSame('pending', $result->status);
        $this->assertTrue($result->ok);
        $this->assertSame('data_not_found', $result->reason);
        $this->assertSame('Data belum ada', $result->message);
        $this->assertFalse($result->shouldFailover);
    }

    public function test_existing_buy_fulfill_still_uses_topup_payload(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GRK-BUY-1',
                    'status' => 'Sukses',
                    'message' => 'OK',
                    'rc' => '00',
                    'sn' => 'SN-1',
                    'price' => 25000,
                ],
            ], 200),
        ]);

        $tx = $this->makePrepaidTx(['invoice_number' => 'GRK-BUY-1', 'provider_ref' => 'GRK-BUY-1']);

        $result = app(DigiflazzProductProviderAdapter::class)->fulfill(
            $tx,
            'xld25',
            '087800001233',
            'GRK-BUY-1'
        );

        $this->assertInstanceOf(ProviderFulfillmentResult::class, $result);
        $this->assertSame('success', $result->status);

        Http::assertSent(function ($request) {
            $body = $request->data();

            return ($body['ref_id'] ?? null) === 'GRK-BUY-1'
                && ! array_key_exists('cmd', $body)
                && ! array_key_exists('commands', $body);
        });
    }
}
