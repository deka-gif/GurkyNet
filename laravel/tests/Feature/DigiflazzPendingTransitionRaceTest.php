<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Models\DigiflazzTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Transactions\TransactionPendingTransitionService;
use App\Services\Transactions\TransactionSuccessTransitionService;
use App\Services\WalletRefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * P1-F — Digiflazz pending status must not overwrite SUCCESS / refunded (locked writer).
 */
class DigiflazzPendingTransitionRaceTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected Product $product;

    protected string $webhookSecret = 'testing_webhook_secret';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.digiflazz.username' => 'buyer-user',
            'services.digiflazz.api_key' => 'buyer-key',
            'services.digiflazz.webhook_secret' => $this->webhookSecret,
        ]);

        $this->user = User::create([
            'name' => 'P1F Pending Race',
            'email' => 'p1f-pending@example.com',
            'phone_number' => '081299990101',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W-P1F-PEND',
            'balance' => 50000,
            'status' => 'active',
        ]);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-p1f-pend', 'icon' => 'phone']);
        $brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);
        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'sku_code' => 'P1F-TSEL10',
            'name' => 'Telkomsel 10K',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    protected function makeInFlightTx(): Transaction
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-P1F-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '081234567890',
            'amount' => 11000,
            'admin_fee' => 0,
            'total_payment' => 11000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::SENT_TO_SUPPLIER->value,
            'fulfillment_provider_code' => ProductProvider::CODE_DIGIFLAZZ,
            'provider_ref' => 'REF-'.uniqid(),
            'timeout_at' => now()->addMinutes(5),
        ]);

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => $this->product->sku_code,
            'product_name' => $this->product->name,
            'qty' => 1,
            'price' => 11000,
        ]);

        DigiflazzTransaction::create([
            'transaction_id' => $tx->id,
            'ref_id' => $tx->invoice_number,
            'buyer_sku_code' => $this->product->sku_code,
            'customer_no' => $tx->target_number,
            'digiflazz_status' => 'pending',
        ]);

        $this->wallet->update(['balance' => 39000]);

        return $tx;
    }

    protected function postDigiflazz(array $data): \Illuminate\Testing\TestResponse
    {
        $payload = ['data' => $data];
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

    public function test_pending_webhook_after_success_cannot_overwrite_status(): void
    {
        $tx = $this->makeInFlightTx();

        app(TransactionSuccessTransitionService::class)->apply($tx->id, [
            'provider_code' => ProductProvider::CODE_DIGIFLAZZ,
            'source' => 'p1f_test_success',
            'sn' => 'SN-OK-1',
        ]);

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);

        $this->postDigiflazz([
            'ref_id' => $tx->invoice_number,
            'buyer_sku_code' => $this->product->sku_code,
            'customer_no' => $tx->target_number,
            'status' => 'Process',
            'sn' => '',
            'rc' => '03',
            'message' => 'Sedang diproses',
        ])->assertOk();

        $this->assertSame(TransactionStatus::SUCCESS->value, $tx->fresh()->status);
        $this->assertEquals(39000.0, (float) $this->wallet->fresh()->balance);
        $this->assertEquals(0, WalletMutation::query()
            ->where('wallet_id', $this->wallet->id)
            ->where('type', WalletMutation::TYPE_REFUND)
            ->count());
    }

    public function test_pending_service_rejects_after_refund(): void
    {
        $tx = $this->makeInFlightTx();
        app(WalletRefundService::class)->refundOnce(
            $tx,
            'Refund P1F',
            'p1f_test',
            'Gagal',
            TransactionStatus::FAILED->value
        );

        $out = app(TransactionPendingTransitionService::class)->apply($tx->id, [
            'source' => 'p1f_test',
        ]);

        $this->assertSame(TransactionPendingTransitionService::OUTCOME_REJECTED_TERMINAL, $out['outcome']);
        $this->assertSame(TransactionStatus::FAILED->value, $tx->fresh()->status);
    }

    public function test_pending_webhook_on_inflight_sets_pending_supplier(): void
    {
        $tx = $this->makeInFlightTx();

        $this->postDigiflazz([
            'ref_id' => $tx->invoice_number,
            'buyer_sku_code' => $this->product->sku_code,
            'customer_no' => $tx->target_number,
            'status' => 'Process',
            'sn' => '',
            'rc' => '03',
            'message' => 'Sedang diproses',
        ])->assertOk();

        $this->assertSame(TransactionStatus::PENDING_SUPPLIER->value, $tx->fresh()->status);
    }

    public function test_unknown_ref_does_not_mutate_any_transaction(): void
    {
        $tx = $this->makeInFlightTx();
        $before = $tx->fresh()->status;

        $this->postDigiflazz([
            'ref_id' => 'UNKNOWN-REF-NOT-OURS',
            'buyer_sku_code' => $this->product->sku_code,
            'customer_no' => $tx->target_number,
            'status' => 'Sukses',
            'sn' => 'SN-X',
            'rc' => '00',
            'message' => 'Sukses',
        ])->assertOk();

        $this->assertSame($before, $tx->fresh()->status);
        $this->assertEquals(39000.0, (float) $this->wallet->fresh()->balance);
    }

    public function test_invalid_signature_rejects_without_mutation(): void
    {
        $tx = $this->makeInFlightTx();
        $payload = ['data' => [
            'ref_id' => $tx->invoice_number,
            'status' => 'Sukses',
            'sn' => 'SN-BAD',
            'rc' => '00',
        ]];
        $body = json_encode($payload, JSON_UNESCAPED_SLASHES);

        $this->call(
            'POST',
            '/api/v1/webhooks/digiflazz',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_HUB_SIGNATURE' => 'sha1=deadbeef',
            ],
            $body
        )->assertUnauthorized();

        $this->assertSame(TransactionStatus::SENT_TO_SUPPLIER->value, $tx->fresh()->status);
    }
}
