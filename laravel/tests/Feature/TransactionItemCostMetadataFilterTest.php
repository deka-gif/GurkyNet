<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Http\Resources\TransactionItemResource;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use App\Models\UserSubscription;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionItemCostMetadataFilterTest extends TestCase
{
    use RefreshDatabase;

    protected User $customer;

    protected User $finance;

    protected Transaction $transaction;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = User::create([
            'name' => 'Cust Meta',
            'email' => 'custmeta@gurkypay.com',
            'phone_number' => '081299990201',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->finance = User::create([
            'name' => 'Finance Meta',
            'email' => 'finmeta@gurkypay.com',
            'phone_number' => '081299990202',
            'password' => Hash::make('password123'),
            'role' => UserRole::FINANCE,
            'transaction_pin' => Hash::make('123456'),
        ]);

        Wallet::create([
            'user_id' => $this->customer->id,
            'wallet_number' => 'W92001',
            'balance' => 50000,
            'status' => 'active',
        ]);

        $this->transaction = Transaction::create([
            'user_id' => $this->customer->id,
            'invoice_number' => 'GRK-20260912-000016',
            'service_name' => 'E-Wallet',
            'target_number' => '0812',
            'amount' => 171325,
            'admin_fee' => 0,
            'total_payment' => 171325,
            'payment_method' => 'wallet',
            'status' => 'success',
        ]);

        TransactionItem::create([
            'transaction_id' => $this->transaction->id,
            'product_code' => 'shopeepay',
            'product_name' => 'Shopee Pay Bebas Nominal',
            'price' => 171325,
            'quantity' => 1,
            'custom_metadata' => [
                'base_price' => 171325,
                'margin' => 0,
                'admin_fee' => 0,
                'provider' => 'digiflazz',
                'sku' => 'shopeepay',
                'is_ewallet' => true,
            ],
        ]);
    }

    public function test_customer_transaction_api_strips_base_price_and_margin(): void
    {
        Sanctum::actingAs($this->customer);

        $response = $this->getJson('/api/v1/transactions/'.$this->transaction->id);
        $response->assertOk();

        $meta = $response->json('data.items.0.customMetadata')
            ?? $response->json('data.items.0.custom_metadata');

        $this->assertIsArray($meta);
        $this->assertArrayNotHasKey('base_price', $meta);
        $this->assertArrayNotHasKey('margin', $meta);
        $this->assertArrayHasKey('sku', $meta);
        $this->assertArrayHasKey('is_ewallet', $meta);

        // DB still stores cost fields for internal bookkeeping.
        $raw = $this->transaction->items()->first()->custom_metadata;
        $this->assertSame(171325, $raw['base_price']);
        $this->assertSame(0, $raw['margin']);
    }

    public function test_finance_role_still_sees_base_price_and_margin_via_resource(): void
    {
        $item = $this->transaction->items()->first();
        $request = Request::create('/api/v1/admin/finance/transactions', 'GET');
        $request->setUserResolver(fn () => $this->finance);

        $payload = (new TransactionItemResource($item))->toArray($request);

        $this->assertSame(171325, $payload['customMetadata']['base_price']);
        $this->assertSame(0, $payload['customMetadata']['margin']);
    }

    public function test_subscription_index_does_not_select_or_expose_base_price(): void
    {
        $category = ProductCategory::create(['name' => 'Langganan', 'slug' => 'langganan-digital', 'icon' => 'tv']);
        $brand = Provider::create(['name' => 'Netflix', 'logo' => null, 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'sku_code' => 'NF1M',
            'name' => 'Netflix 1 Bulan',
            'base_price' => 50000,
            'sell_price' => 55000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        UserSubscription::create([
            'user_id' => $this->customer->id,
            'product_id' => $product->id,
            'target_number' => 'user@example.com',
            'schedule_day' => 1,
            'status' => 'active',
            'next_run_at' => now()->addDay(),
        ]);

        Sanctum::actingAs($this->customer);
        $response = $this->getJson('/api/v1/subscriptions');
        $response->assertOk();

        $productPayload = $response->json('data.data.0.product')
            ?? $response->json('data.0.product');

        $this->assertIsArray($productPayload);
        $this->assertArrayNotHasKey('base_price', $productPayload);
        $this->assertArrayHasKey('sell_price', $productPayload);
    }
}
