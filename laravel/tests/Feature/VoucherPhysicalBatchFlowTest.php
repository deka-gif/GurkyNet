<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\User;
use App\Models\VoucherPhysicalBatch;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VoucherPhysicalBatchFlowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Wallet $wallet;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory());

        config([
            'services.digiflazz.username' => 'gurky_test_user',
            'services.digiflazz.api_key' => 'gurky_test_key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
        ]);

        ProductProvider::digiflazz()?->update([
            'is_active' => true,
            'api_status' => 'online',
        ]);

        $this->user = User::create([
            'name' => 'Voucher Fisik User',
            'email' => 'voucherfisik@gurkypay.com',
            'phone_number' => '081255566699',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000088',
            'balance' => 1000000.00,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'Voucher Internet',
            'slug' => 'voucher-internet',
            'icon' => 'wifi',
        ]);

        $provider = Provider::create([
            'name' => 'XL Axiata',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'XLVIFISIK5GB',
            'name' => 'Voucher Fisik XL 5GB',
            'base_price' => 20000,
            'sell_price' => 20500,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    /**
     * Http::fake() merges stub callbacks across calls rather than replacing them, so a
     * second fakeDigiflazzPerSerial() call would NOT override the first — both closures
     * stay registered and the earlier one keeps matching. Register the closure ONCE over
     * a reference so later calls just mutate the outcome map in place.
     */
    protected function fakeDigiflazzPerSerial(array &$outcomeBySerial): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => function (HttpRequest $request) use (&$outcomeBySerial) {
                $body = $request->data();
                $serial = $body['customer_no'] ?? '';
                $outcome = $outcomeBySerial[$serial] ?? 'failed';

                if ($outcome === 'success') {
                    return Http::response([
                        'data' => [
                            'ref_id' => $body['ref_id'],
                            'customer_no' => $serial,
                            'buyer_sku_code' => $body['buyer_sku_code'],
                            'message' => 'Transaksi Sukses',
                            'status' => 'Sukses',
                            'rc' => '00',
                            'sn' => 'ACT-' . $serial,
                            'price' => 20000,
                        ],
                    ], 200);
                }

                return Http::response([
                    'data' => [
                        'ref_id' => $body['ref_id'],
                        'customer_no' => $serial,
                        'buyer_sku_code' => $body['buyer_sku_code'],
                        'message' => 'Nomor seri tidak valid / sudah terpakai.',
                        'status' => 'Gagal',
                        'rc' => '10',
                        'sn' => null,
                        'price' => 0,
                    ],
                ], 200);
            },
        ]);
    }

    public function test_batch_debits_wallet_and_activates_items_with_mixed_outcomes_then_retry_recovers(): void
    {
        $outcomes = [
            'SNOK0001' => 'success',
            'SNBAD0002' => 'failed',
        ];
        $this->fakeDigiflazzPerSerial($outcomes);

        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $response = $this->postJson('/api/v1/voucher-internet/physical-batches', [
            'sku_code' => 'XLVIFISIK5GB',
            'serials' => [
                ['serial_number' => 'SNOK0001'],
                ['serial_number' => 'SNBAD0002'],
            ],
            'pin' => '123456',
            'idempotency_key' => 'batch-test-key-1',
        ]);

        $response->assertStatus(201);
        $batchId = $response->json('data.id');
        $this->assertNotNull($batchId);

        $batch = VoucherPhysicalBatch::with('items')->findOrFail($batchId);
        $this->assertSame(2, $batch->total_serials);
        $this->assertSame(1, $batch->success_count);
        $this->assertSame(1, $batch->failed_count);
        $this->assertSame(VoucherPhysicalBatch::STATUS_COMPLETED_WITH_FAILURES, $batch->status);
        $this->assertSame('success', $batch->transaction->status);

        $unitPrice = (float) $batch->unit_price;
        // Both items held up front, then the failed one refunded — net debit = 1 unit price.
        $this->assertEquals($before - $unitPrice, (float) $this->wallet->fresh()->balance);

        $okItem = $batch->items->firstWhere('serial_number', 'SNOK0001');
        $badItem = $batch->items->firstWhere('serial_number', 'SNBAD0002');

        $this->assertSame('success', $okItem->status);
        $this->assertSame('ACT-SNOK0001', $okItem->provider_ref);
        $this->assertNotNull($okItem->activated_at);

        $this->assertSame('failed', $badItem->status);
        $this->assertEquals($unitPrice, (float) $badItem->refund_amount);
        $this->assertNotNull($badItem->refunded_at);

        // --- Retry the failed item: now the provider accepts it ---
        $outcomes['SNBAD0002'] = 'success';

        $retryResponse = $this->postJson(
            "/api/v1/voucher-internet/physical-batches/{$batch->id}/items/{$badItem->id}/retry"
        );
        $retryResponse->assertOk();

        $badItem->refresh();
        $this->assertSame('success', $badItem->status);
        $this->assertSame('ACT-SNBAD0002', $badItem->provider_ref);
        $this->assertSame(1, $badItem->retry_count);

        $batch->refresh();
        $this->assertSame(2, $batch->success_count);
        $this->assertSame(0, $batch->failed_count);
        $this->assertSame(VoucherPhysicalBatch::STATUS_COMPLETED, $batch->status);
        $this->assertSame('success', $batch->transaction->fresh()->status);

        // Retry re-held then successfully spent the unit price — net debit is now both items.
        $this->assertEquals($before - ($unitPrice * 2), (float) $this->wallet->fresh()->balance);

        // Cannot retry an already-succeeded item.
        $retryAgain = $this->postJson(
            "/api/v1/voucher-internet/physical-batches/{$batch->id}/items/{$badItem->id}/retry"
        );
        $retryAgain->assertStatus(422);
    }

    public function test_wrong_pin_does_not_debit_batch(): void
    {
        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $response = $this->postJson('/api/v1/voucher-internet/physical-batches', [
            'sku_code' => 'XLVIFISIK5GB',
            'serials' => [
                ['serial_number' => 'SNANY0001'],
            ],
            'pin' => '000000',
            'idempotency_key' => 'batch-test-key-wrongpin',
        ]);

        $response->assertStatus(422);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_rejects_product_outside_voucher_internet_category(): void
    {
        $otherCategory = ProductCategory::create([
            'name' => 'Pulsa',
            'slug' => 'pulsa',
            'icon' => 'phone',
        ]);
        $otherProduct = Product::create([
            'product_category_id' => $otherCategory->id,
            'provider_id' => $this->product->provider_id,
            'sku_code' => 'XLPULSA10K',
            'name' => 'Pulsa XL 10K',
            'base_price' => 10000,
            'sell_price' => 10500,
            'admin_fee' => 0,
            'status' => true,
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/voucher-internet/physical-batches', [
            'sku_code' => $otherProduct->sku_code,
            'serials' => [
                ['serial_number' => 'SNANY0001'],
            ],
            'pin' => '123456',
            'idempotency_key' => 'batch-test-key-wrongcat',
        ]);

        $response->assertStatus(422);
    }
}
