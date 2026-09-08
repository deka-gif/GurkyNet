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

        $digi = ProductProvider::digiflazz() ?? ProductProvider::create([
            'code' => 'digiflazz',
            'name' => 'Digiflazz',
            'is_active' => true,
            'priority' => 1,
            'sort_order' => 1,
        ]);
        $digi->update(['is_active' => true, 'api_status' => 'online']);

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

        // Production-proven Digi ML diamond SKU (user_id|zone_id).
        $this->product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $provider->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'pre33639301',
            'name' => 'MOBILELEGEND - 3 Diamond',
            'base_price' => 12000,
            'sell_price' => 12500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        \App\Models\ProductProviderSku::create([
            'product_id' => $this->product->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'pre33639301',
            'provider_name' => 'MOBILELEGEND - 3 Diamond',
            'base_price' => 12000,
            'provider_price' => 12000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);
    }

    public function test_account_schema_returns_mlbb_fields(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/game/account-schema?brand=Mobile%20Legends');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.code', 'mobile-legends')
            ->assertJsonPath('data.delivery', 'account');

        $keys = collect($response->json('data.fields'))->pluck('key')->all();
        $this->assertContains('user_id', $keys);
        $this->assertContains('zone_id', $keys);
    }

    public function test_account_schema_mlweek_sku_is_unknown(): void
    {
        Sanctum::actingAs($this->user);

        $response = $this->getJson('/api/v1/game/account-schema?brand=Mobile%20Legends&sku=mlweek');

        $response->assertOk()
            ->assertJsonPath('data.delivery', 'unknown')
            ->assertJsonPath('data.fields', []);
    }

    public function test_inquiry_rejected_when_schema_unknown(): void
    {
        $this->product->update(['sku_code' => 'mlweek']);

        Sanctum::actingAs($this->user);

        $response = $this->postJson('/api/v1/game/inquiry', [
            'sku_code' => 'mlweek',
            'account' => [
                'user_id' => '12345678',
                'zone_id' => '1234',
            ],
        ]);

        $response->assertStatus(422);
        $this->assertFalse((bool) $response->json('data.found'));
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
            'sku_code' => 'pre33639301',
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
            ->assertJsonPath('data.item', 'MOBILELEGEND - 3 Diamond');

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

        // VIP lookup miss is optional — Digi purchase path still gets customer_no.
        $response = $this->postJson('/api/v1/game/inquiry', [
            'sku_code' => 'pre33639301',
            'account' => [
                'user_id' => '00000000',
                'zone_id' => '0000',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.found', false)
            ->assertJsonPath('data.customer_no', '00000000|0000')
            ->assertJsonPath('data.nickname', null);
        $this->assertSame($before, (float) $this->wallet->fresh()->balance);
    }

    public function test_game_purchase_with_optional_nickname_stores_meta(): void
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
                    'buyer_sku_code' => 'pre33639301',
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
            'sku_code' => 'pre33639301',
            'account' => [
                'user_id' => '12345678',
                'zone_id' => '1234',
            ],
        ])->assertOk();

        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'pre33639301',
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

    public function test_digi_game_purchase_without_vip_session_succeeds(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGDIGI001',
                    'customer_no' => '11112222|3333',
                    'buyer_sku_code' => 'pre33639301',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'SN-DIGI-ML',
                    'price' => 12000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'pre33639301',
            '11112222|3333',
            '123456'
        );

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(! empty($meta['is_game']));
        $this->assertSame('11112222', $meta['user_id'] ?? null);
        $this->assertSame('3333', $meta['zone_id'] ?? null);
        $this->assertTrue(empty($meta['nickname']));
        $this->assertNull($meta['game_inquiry_ref_id'] ?? null);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);
        $this->assertEquals('success', $transaction->fresh()->status);
    }

    public function test_fc_mobile_and_garena_schema_from_sku_evidence(): void
    {
        Sanctum::actingAs($this->user);

        $fc = $this->getJson('/api/v1/game/account-schema?brand=FC%20Mobile&sku=pre33639303');
        $fc->assertOk()
            ->assertJsonPath('data.delivery', 'account');
        $this->assertSame(['user_id'], collect($fc->json('data.fields'))->pluck('key')->all());

        $garena = $this->getJson('/api/v1/game/account-schema?brand=GARENA&sku=pre33817227');
        $garena->assertOk()
            ->assertJsonPath('data.delivery', 'account');
        $this->assertSame(['garena_id'], collect($garena->json('data.fields'))->pluck('key')->all());

        $ff = $this->getJson('/api/v1/game/account-schema?brand=FREE%20FIRE&sku=ff50');
        $ff->assertOk()
            ->assertJsonPath('data.delivery', 'account')
            ->assertJsonPath('data.schema_key', 'PLAYER_ID');
        $this->assertSame(['player_id'], collect($ff->json('data.fields'))->pluck('key')->all());
    }

    public function test_free_fire_player_id_purchase_without_vip_session(): void
    {
        $digi = ProductProvider::digiflazz();
        $category = ProductCategory::query()->where('slug', 'game')->firstOrFail();
        $ffBrand = Provider::create([
            'name' => 'Free Fire',
            'logo' => null,
            'is_active' => true,
        ]);
        $ffProduct = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $ffBrand->id,
            'product_provider_id' => $digi->id,
            'sku_code' => 'ff50',
            'name' => 'Free Fire 50 Diamond',
            'base_price' => 7000,
            'sell_price' => 7500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        \App\Models\ProductProviderSku::create([
            'product_id' => $ffProduct->id,
            'product_provider_id' => $digi->id,
            'provider_sku' => 'ff50',
            'provider_name' => 'Free Fire 50 Diamond',
            'base_price' => 7000,
            'provider_price' => 7000,
            'provider_status' => 'available',
            'is_active' => true,
        ]);

        Http::fake([
            'https://api.digiflazz.com/v1/transaction' => Http::response([
                'data' => [
                    'ref_id' => 'GNGDIGIFF001',
                    'customer_no' => '987654321',
                    'buyer_sku_code' => 'ff50',
                    'message' => 'Transaksi Sukses',
                    'status' => 'Sukses',
                    'rc' => '00',
                    'sn' => 'SN-DIGI-FF',
                    'price' => 7000,
                ],
            ], 200),
        ]);

        Sanctum::actingAs($this->user);
        Queue::fake();

        $create = resolve(CreateTransactionAction::class);
        $transaction = $create->execute(
            $this->user,
            'ff50',
            '987654321',
            '123456'
        );

        $meta = $transaction->items->first()?->custom_metadata ?? [];
        $this->assertTrue(! empty($meta['is_game']));
        $this->assertSame('987654321', $meta['user_id'] ?? null);
        $this->assertTrue(empty($meta['nickname']));
        $this->assertNull($meta['game_inquiry_ref_id'] ?? null);

        $job = new ProcessProductProviderTransaction($transaction->id);
        app()->call([$job, 'handle']);
        $this->assertEquals('success', $transaction->fresh()->status);
    }
}
