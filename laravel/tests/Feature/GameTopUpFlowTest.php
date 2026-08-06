<?php

namespace Tests\Feature;

use App\Actions\Transaction\CreateTransactionAction;
use App\Jobs\ProcessProductProviderTransaction;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GameTopUpFlowTest extends TestCase
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
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'services.vip.username' => 'vip_test_id',
            'services.vip.merchant_id' => 'vip_test_id',
            'services.vip.api_key' => 'vip_test_key_real',
            'services.vip.signature' => '',
        ]);

        ProductProvider::digiflazz()?->update([
            'is_active' => true,
            'api_status' => 'online',
        ]);
        ProductProvider::vip()?->update([
            'is_active' => true,
            'api_status' => 'online',
        ]);

        $this->user = User::create([
            'name' => 'Game User',
            'email' => 'game@gurkypay.com',
            'phone_number' => '081233344455',
            'password' => Hash::make('password123'),
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->wallet = Wallet::create([
            'user_id' => $this->user->id,
            'wallet_number' => '104200000077',
            'balance' => 500000.00,
            'status' => 'active',
        ]);

        $category = ProductCategory::create([
            'name' => 'Game',
            'slug' => 'game',
            'icon' => 'gamepad',
        ]);

        $provider = Provider::create([
            'name' => 'Mobile Legends',
            'logo' => null,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'sku_code' => 'MLBB50',
            'name' => '50 Diamonds',
            'base_price' => 12000,
            'sell_price' => 12500,
            'admin_fee' => 0,
            'status' => true,
        ]);
    }

    public function test_account_schema_returns_mlbb_fields(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/game/account-schema?brand=Mobile%20Legends');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.code', 'mobile-legends');

        $keys = collect($response->json('data.fields'))->pluck('key')->all();
        $this->assertContains('user_id', $keys);
        $this->assertContains('zone_id', $keys);
    }

    public function test_game_inquiry_uses_vip_get_nickname_and_returns_provider_nick(): void
    {
        Http::fake([
            'vip-reseller.co.id/api/game-feature' => Http::response([
                'result' => true,
                'data' => 'GURKY_GAMING',
                'message' => 'Success.',
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/game/inquiry', [
            'sku_code' => 'MLBB50',
            'account' => [
                'user_id' => '12345678',
                'zone_id' => '1234',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.nickname', 'GURKY_GAMING')
            ->assertJsonPath('data.user_id', '12345678')
            ->assertJsonPath('data.zone_id', '1234')
            ->assertJsonPath('data.customer_no', '12345678|1234')
            ->assertJsonPath('data.found', true)
            ->assertJsonPath('data.item', '50 Diamonds');

        Http::assertSent(function ($request) {
            $url = $request->url();
            $body = $request->data();

            return str_contains($url, 'game-feature')
                && ($body['type'] ?? null) === 'get-nickname'
                && ($body['code'] ?? null) === 'mobile-legends'
                && ($body['target'] ?? null) === '12345678'
                && ($body['additional_target'] ?? null) === '1234';
        });
    }

    public function test_game_inquiry_not_found_does_not_debit_wallet(): void
    {
        Http::fake([
            'vip-reseller.co.id/api/game-feature' => Http::response([
                'result' => false,
                'data' => null,
                'message' => 'Player ID Tidak Ditemukan.',
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $response = $this->postJson('/api/v1/game/inquiry', [
            'sku_code' => 'MLBB50',
            'account' => [
                'user_id' => '00000000',
                'zone_id' => '0000',
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('data.found', false);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_game_purchase_requires_prior_inquiry_and_stores_nickname(): void
    {
        Http::fake([
            'vip-reseller.co.id/api/game-feature' => Http::response([
                'result' => true,
                'data' => 'GURKY_GAMING',
                'message' => 'Success.',
            ], 200),
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGGAME001',
                    'customer_no' => '12345678|1234',
                    'buyer_sku_code' => 'MLBB50',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => '81723918239123',
                    'price' => 12000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);

        $this->postJson('/api/v1/game/inquiry', [
            'sku_code' => 'MLBB50',
            'account' => [
                'user_id' => '12345678',
                'zone_id' => '1234',
            ],
        ])->assertOk();

        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'MLBB50',
            '12345678|1234',
            '123456'
        );

        $this->assertEquals(12500.0, (float) $transaction->total_payment);
        $this->assertEquals(500000.0 - 12500.0, (float) $this->wallet->fresh()->balance);

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(!empty($meta['is_game']));
        $this->assertSame('GURKY_GAMING', $meta['nickname'] ?? null);
        $this->assertSame('12345678', $meta['user_id'] ?? null);
        $this->assertSame('1234', $meta['zone_id'] ?? null);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);

        $transaction->refresh();
        $this->assertEquals('success', $transaction->status);

        $this->getJson('/api/v1/transactions/' . $transaction->invoice_number . '/receipt')
            ->assertOk()
            ->assertJsonPath('data.transaction_details.is_game', true)
            ->assertJsonPath('data.transaction_details.nickname', 'GURKY_GAMING')
            ->assertJsonPath('data.transaction_details.game_user_id', '12345678')
            ->assertJsonPath('data.transaction_details.game_zone_id', '1234')
            ->assertJsonPath('data.transaction_details.serial_number', '81723918239123');
    }

    public function test_game_purchase_without_inquiry_is_rejected(): void
    {
        Sanctum::actingAs($this->user);
        $before = (float) $this->wallet->fresh()->balance;

        $this->expectException(\Illuminate\Validation\ValidationException::class);

        $create = resolve(CreateTransactionAction::class);
        try {
            $create->execute($this->user, 'MLBB50', '12345678|1234', '123456');
        } finally {
            $this->assertSame($before, (float) $this->wallet->fresh()->balance);
        }
    }
}
