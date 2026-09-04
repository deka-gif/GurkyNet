<?php

namespace Tests\Feature;

use App\Actions\Transaction\CreateTransactionAction;
use App\Jobs\ProcessProductProviderTransaction;
use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\User;
use App\Models\Wallet;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Services\ProductProviders\DigiflazzDevTestSkuSupport;
use App\Services\ProductProviders\ProductProviderSelectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Digiflazz Development Test SKU (xld10) — virtual product gate when DIGIFLAZZ_TESTING is on.
 */
class DigiflazzDevTestSkuSupportTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Wallet $wallet;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory);

        config([
            'services.digiflazz.username' => 'buyer-user',
            'services.digiflazz.api_key' => 'buyer-key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
            'services.digiflazz.testing' => null,
            'services.digiflazz.dev_test_price' => null,
        ]);

        ProductProvider::digiflazz()?->update([
            'is_active' => true,
            'api_status' => 'online',
            'partner_status' => 'online',
        ]);

        ProductProvider::vip()?->update([
            'is_active' => true,
            'api_status' => 'online',
            'partner_status' => 'online',
        ]);

        $this->user = User::create([
            'name' => 'Dev Test User',
            'email' => 'devtest-xld10@gurkypay.com',
            'phone_number' => '081299988877',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000099',
            'balance' => 500000.00,
            'status' => 'active',
        ]);
    }

    public function test_testing_off_rejects_xld10(): void
    {
        config([
            'services.digiflazz.testing' => null,
            'services.digiflazz.dev_test_price' => 10000,
        ]);

        try {
            app(CreateTransactionAction::class)->execute(
                $this->user,
                DigiflazzDevTestSkuSupport::SKU,
                '087800001230',
                '123456'
            );
            $this->fail('Expected ValidationException');
        } catch (ValidationException $e) {
            $this->assertSame(['Produk tidak ditemukan.'], $e->errors()['product_code'] ?? null);
        }

        $this->assertSame(0, Product::query()->where('sku_code', DigiflazzDevTestSkuSupport::SKU)->count());
    }

    public function test_testing_on_price_missing_rejects_xld10(): void
    {
        config([
            'services.digiflazz.testing' => true,
            'services.digiflazz.dev_test_price' => null,
        ]);

        try {
            app(CreateTransactionAction::class)->execute(
                $this->user,
                DigiflazzDevTestSkuSupport::SKU,
                '087800001230',
                '123456'
            );
            $this->fail('Expected ValidationException');
        } catch (ValidationException $e) {
            $this->assertNotEmpty($e->errors()['product_code'] ?? null);
            $this->assertStringContainsString('DIGIFLAZZ_DEV_TEST_PRICE', $e->errors()['product_code'][0]);
        }

        $this->assertSame(0, Product::query()->where('sku_code', DigiflazzDevTestSkuSupport::SKU)->count());
    }

    public function test_testing_on_sends_xld10_with_testing_true_and_invoice_ref_id(): void
    {
        config([
            'services.digiflazz.testing' => true,
            'services.digiflazz.dev_test_price' => 10000,
        ]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'PLACEHOLDER',
                    'customer_no' => '087800001230',
                    'buyer_sku_code' => 'xld10',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'SN-XLD10',
                    'price' => 10000,
                ],
            ], 200),
            'https://vip-reseller.co.id/*' => Http::response(['result' => false], 500),
        ]);

        Queue::fake();

        $transaction = app(CreateTransactionAction::class)->execute(
            $this->user,
            DigiflazzDevTestSkuSupport::SKU,
            '087800001230',
            '123456'
        );

        $this->assertSame(10000.0, (float) $transaction->total_payment);
        $this->assertSame(DigiflazzDevTestSkuSupport::SKU, $transaction->items->first()?->product_code);
        $this->assertSame(0, Product::query()->where('sku_code', DigiflazzDevTestSkuSupport::SKU)->count());

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $transaction->refresh();
        $this->assertSame('success', $transaction->status);

        Http::assertSent(function ($request) use ($transaction) {
            if ($request->url() !== 'https://api.digiflazz.com/v1/transaction') {
                return false;
            }
            $body = $request->data();

            return ($body['buyer_sku_code'] ?? null) === 'xld10'
                && ($body['customer_no'] ?? null) === '087800001230'
                && ($body['ref_id'] ?? null) === $transaction->invoice_number
                && ($body['testing'] ?? null) === true
                && ($body['sign'] ?? null) === md5('buyer-user'.'buyer-key'.$transaction->invoice_number);
        });

        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'vip-reseller.co.id'));
    }

    public function test_xld10_candidates_are_digiflazz_only(): void
    {
        config([
            'services.digiflazz.testing' => true,
            'services.digiflazz.dev_test_price' => 10000,
        ]);

        $support = app(DigiflazzDevTestSkuSupport::class);
        $product = $support->makeVirtualProduct(DigiflazzDevTestSkuSupport::SKU, 10000);
        $selection = app(ProductProviderSelectionService::class);
        $candidates = $selection->candidatesForProduct($product);

        // Even before fulfill filter, synthetic offer is Digiflazz-only for empty PPS.
        $this->assertNotEmpty($candidates);
        foreach ($candidates as $offer) {
            $this->assertSame(ProductProvider::CODE_DIGIFLAZZ, $offer->productProvider?->code);
        }
    }

    public function test_xld10_not_in_customer_catalog(): void
    {
        config([
            'services.digiflazz.testing' => true,
            'services.digiflazz.dev_test_price' => 10000,
        ]);

        Queue::fake();
        app(CreateTransactionAction::class)->execute(
            $this->user,
            DigiflazzDevTestSkuSupport::SKU,
            '087800001230',
            '123456'
        );

        $listed = app(ProductRepositoryInterface::class)->getActiveProducts();
        $skus = $listed->pluck('sku_code')->all();
        $this->assertNotContains(DigiflazzDevTestSkuSupport::SKU, $skus);
        $this->assertSame(0, Product::query()->where('sku_code', DigiflazzDevTestSkuSupport::SKU)->count());
    }

    public function test_selection_resolves_virtual_only_when_testing_on(): void
    {
        $selection = app(ProductProviderSelectionService::class);

        config([
            'services.digiflazz.testing' => null,
            'services.digiflazz.dev_test_price' => 10000,
        ]);
        $this->assertNull($selection->findProductByInternalSku(DigiflazzDevTestSkuSupport::SKU));

        config([
            'services.digiflazz.testing' => true,
            'services.digiflazz.dev_test_price' => 10000,
        ]);
        $virtual = $selection->findProductByInternalSku(DigiflazzDevTestSkuSupport::SKU);
        $this->assertNotNull($virtual);
        $this->assertFalse($virtual->exists);
        $this->assertSame(DigiflazzDevTestSkuSupport::SKU, $virtual->sku_code);
        $this->assertSame(0, Product::query()->where('sku_code', DigiflazzDevTestSkuSupport::SKU)->count());
    }

    public function test_virtual_product_is_never_persisted(): void
    {
        config([
            'services.digiflazz.testing' => true,
            'services.digiflazz.dev_test_price' => 12500,
        ]);

        $product = app(DigiflazzDevTestSkuSupport::class)
            ->makeVirtualProduct(DigiflazzDevTestSkuSupport::SKU, 12500);

        $this->assertFalse($product->exists);
        $this->assertFalse($product->wasRecentlyCreated);
        $this->assertSame(0, Product::query()->where('sku_code', DigiflazzDevTestSkuSupport::SKU)->count());
    }
}
