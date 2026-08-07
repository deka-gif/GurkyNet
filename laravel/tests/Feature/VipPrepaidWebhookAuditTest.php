<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class VipPrepaidWebhookAuditTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected Product $product;

    protected string $apiId = 'api-id-test';

    protected string $apiKey = 'api-key-test';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'services.vip.username' => $this->apiId,
            'services.vip.merchant_id' => $this->apiId,
            'services.vip.api_key' => $this->apiKey,
            'services.vip.signature' => '',
        ]);

        $this->user = User::create([
            'name' => 'VIP Webhook User',
            'email' => 'vip-webhook@gurkypay.com',
            'phone_number' => '081288880099',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => 'W88099',
            'balance' => 50000,
            'status' => 'active',
        ]);

        $vip = ProductProvider::vip();
        $this->assertNotNull($vip);
        $vip->update(['is_active' => true, 'api_status' => 'online']);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-vip-wh', 'icon' => 'phone']);
        $brand = Provider::create(['name' => 'XL', 'logo' => 'xl.png', 'is_active' => true]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $vip->id,
            'sku_code' => 'VIP-SHNX25',
            'name' => 'XL 25',
            'base_price' => 25000,
            'sell_price' => 26000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $vip->id,
            'provider_sku' => 'SHNX25',
            'provider_name' => 'Xl 25.000',
            'base_price' => 25000,
            'is_active' => true,
        ]);
    }

    protected function signature(): string
    {
        return md5($this->apiId.$this->apiKey);
    }

    protected function makePendingTx(string $trxid): Transaction
    {
        $tx = Transaction::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'GRK-VIP-WH-'.uniqid(),
            'service_name' => 'Pulsa',
            'target_number' => '087800001233',
            'amount' => 26000,
            'admin_fee' => 0,
            'total_payment' => 26000,
            'payment_method' => 'wallet',
            'status' => TransactionStatus::PENDING->value,
            'fulfillment_provider_code' => ProductProvider::CODE_VIP,
            'provider_ref' => $trxid,
            'provider_sku_used' => 'SHNX25',
            'timeout_at' => now()->addMinutes(5),
        ]);

        TransactionItem::create([
            'transaction_id' => $tx->id,
            'product_code' => $this->product->sku_code,
            'product_name' => $this->product->name,
            'qty' => 1,
            'price' => 26000,
        ]);

        return $tx;
    }

    public function test_webhook_signature_invalid_is_rejected(): void
    {
        $tx = $this->makePendingTx('VP-SIG-1');

        $response = $this->postJson('/api/v1/webhooks/vip', [
            'result' => true,
            'data' => [[
                'trxid' => 'VP-SIG-1',
                'data' => '087800001233',
                'service' => 'Xl 25.000',
                'status' => 'success',
                'note' => 'SN1',
                'price' => 25000,
            ]],
            'message' => 'Detail transaksi berhasil didapatkan.',
        ], [
            'X-Client-Signature' => 'deadbeef',
        ]);

        $response->assertStatus(401);
        $this->assertSame(TransactionStatus::PENDING->value, $tx->fresh()->status);
    }

    public function test_webhook_success_settles_transaction(): void
    {
        $tx = $this->makePendingTx('VP-OK-1');
        $before = (float) $this->wallet->fresh()->balance;

        $response = $this->postJson('/api/v1/webhooks/vip', [
            'result' => true,
            'data' => [[
                'trxid' => 'VP-OK-1',
                'data' => '087800001233',
                'service' => 'Xl 25.000',
                'status' => 'success',
                'note' => '436846846',
                'price' => 25000,
            ]],
            'message' => 'Detail transaksi berhasil didapatkan.',
        ], [
            'X-Client-Signature' => $this->signature(),
            'Content-Type' => 'application/json',
        ]);

        $response->assertOk()->assertJsonPath('success', true);
        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::SUCCESS->value, $fresh->status);
        $this->assertStringContainsString('436846846', (string) $fresh->notes);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_webhook_error_refunds_pending_transaction(): void
    {
        $tx = $this->makePendingTx('VP-ERR-1');
        $this->wallet->update(['balance' => 10000]);

        $response = $this->postJson('/api/v1/webhooks/vip', [
            'result' => true,
            'data' => [[
                'trxid' => 'VP-ERR-1',
                'data' => '087800001234',
                'service' => 'Xl 50.00',
                'status' => 'error',
                'note' => 'Nomor tujuan salah.',
                'price' => 50000,
            ]],
            'message' => 'Detail transaksi berhasil didapatkan.',
        ], [
            'X-Client-Signature' => $this->signature(),
        ]);

        $response->assertOk();
        $fresh = $tx->fresh();
        $this->assertSame(TransactionStatus::FAILED->value, $fresh->status);
        $this->assertGreaterThanOrEqual(10000 + 26000, (float) $this->wallet->fresh()->balance);
    }

    public function test_webhook_processing_keeps_pending_for_polling(): void
    {
        $tx = $this->makePendingTx('VP-PROC-1');

        $response = $this->postJson('/api/v1/webhooks/vip', [
            'result' => true,
            'data' => [[
                'trxid' => 'VP-PROC-1',
                'data' => '087800001233',
                'service' => 'Xl 25.000',
                'status' => 'processing',
                'note' => '',
                'price' => 25000,
            ]],
            'message' => 'Detail transaksi berhasil didapatkan.',
        ], [
            'X-Client-Signature' => $this->signature(),
        ]);

        $response->assertOk();
        $this->assertSame(TransactionStatus::PENDING->value, $tx->fresh()->status);
        $this->assertSame('pending', $tx->fresh()->provider_last_status);
    }

    public function test_webhook_waiting_keeps_pending(): void
    {
        $tx = $this->makePendingTx('VP-WAIT-1');

        $response = $this->postJson('/api/v1/webhooks/vip', [
            'trxid' => 'VP-WAIT-1',
            'data' => '087800001233',
            'service' => 'Xl 25.000',
            'status' => 'waiting',
            'note' => '',
            'price' => 25000,
        ], [
            'X-Client-Signature' => $this->signature(),
        ]);

        $response->assertOk();
        $this->assertSame(TransactionStatus::PENDING->value, $tx->fresh()->status);
    }
}
