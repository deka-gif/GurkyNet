<?php

namespace Tests\Unit;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Services\Game\GameNicknameResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GameNicknameResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_sku_schema_unknown_overrides_ml_brand(): void
    {
        $resolver = app(GameNicknameResolver::class);
        $schema = $resolver->resolveForProduct('Mobile Legends', 'mlweek');

        $this->assertSame('unknown', $schema['delivery']);
        $this->assertSame([], $schema['fields']);
        $this->assertSame('sku_override', $schema['source']);
        $this->assertFalse($schema['purchasable']);
    }

    public function test_digiflazz_uid_hint_for_fc_mobile_sku(): void
    {
        $resolver = app(GameNicknameResolver::class);
        $schema = $resolver->resolveForProduct('FC Mobile', 'pre33639303');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame('sku_override', $schema['source']);
        $this->assertSame(['user_id'], collect($schema['fields'])->pluck('key')->all());
        $this->assertSame('UID', $schema['fields'][0]['label']);
    }

    public function test_ml_combo_from_desc(): void
    {
        DigiflazzProduct::create([
            'buyer_sku_code' => 'ml10',
            'product_name' => 'ML 10',
            'category' => 'Games',
            'brand' => 'Mobile Legends',
            'seller_price' => 3000,
            'desc' => 'no pelanggan = gabungan antara user_id dan zone_id',
        ]);

        // Game Profile wins for Mobile Legends before desc — same fields.
        $resolver = app(GameNicknameResolver::class);
        $schema = $resolver->resolveForProduct('Mobile Legends', 'ml10');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame(['user_id', 'zone_id'], collect($schema['fields'])->pluck('key')->all());
        $this->assertSame('game_profile', $schema['source']);
    }

    public function test_ml_proven_sku_schema_product_level(): void
    {
        $resolver = app(GameNicknameResolver::class);
        $proven = $resolver->resolveForProduct('MOBILE LEGENDS', 'pre33639301');
        $this->assertSame('account', $proven['delivery']);
        $this->assertSame(['user_id', 'zone_id'], collect($proven['fields'])->pluck('key')->all());

        $week = $resolver->resolveForProduct('MOBILE LEGENDS', 'mlweek');
        $this->assertSame('unknown', $week['delivery']);
    }

    public function test_free_fire_uses_game_profile_player_id(): void
    {
        DigiflazzProduct::create([
            'buyer_sku_code' => 'ff50',
            'product_name' => 'FF 50',
            'category' => 'Games',
            'brand' => 'Free Fire',
            'seller_price' => 7000,
            'desc' => '50 Diamonds',
        ]);

        $resolver = app(GameNicknameResolver::class);
        $schema = $resolver->resolveForProduct('Free Fire', 'ff50');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame(['player_id'], collect($schema['fields'])->pluck('key')->all());
        $this->assertSame('game_profile', $schema['source']);
        $this->assertTrue($schema['purchasable']);
    }

    public function test_free_fire_vip_catalog_schema_is_unknown_while_vip_off(): void
    {
        $vip = ProductProvider::vip() ?? ProductProvider::create([
            'code' => 'vip',
            'name' => 'VIP',
            'is_active' => true,
            'priority' => 2,
            'sort_order' => 2,
        ]);

        $category = ProductCategory::create(['name' => 'Game', 'slug' => 'game', 'icon' => 'g']);
        $brand = Provider::create(['name' => 'Free Fire', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $vip->id,
            'sku_code' => 'VIP-FFDIAMOND50',
            'name' => 'FF 50',
            'base_price' => 7000,
            'sell_price' => 7500,
            'admin_fee' => 0,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $vip->id,
            'provider_sku' => 'FFDIAMOND50',
            'provider_name' => 'FF 50',
            'base_price' => 7000,
            'provider_price' => 7000,
            'provider_status' => 'available',
            'provider_meta' => ['note' => '-'],
            'is_active' => true,
        ]);

        $resolver = app(GameNicknameResolver::class);
        $schema = $resolver->resolveForProduct('Free Fire', 'VIP-FFDIAMOND50');

        $this->assertSame('unknown', $schema['delivery']);
        $this->assertSame([], $schema['fields']);
        $this->assertFalse($schema['purchasable']);
    }

    public function test_digi_desc_does_not_apply_to_vip_sku(): void
    {
        DigiflazzProduct::create([
            'buyer_sku_code' => 'pre33639303',
            'product_name' => 'FC Mobile 40',
            'category' => 'Games',
            'brand' => 'FC Mobile',
            'seller_price' => 10000,
            'desc' => 'Masukkan UID',
        ]);

        $vip = ProductProvider::vip() ?? ProductProvider::create([
            'code' => 'vip',
            'name' => 'VIP',
            'is_active' => true,
            'priority' => 2,
            'sort_order' => 2,
        ]);
        $category = ProductCategory::create(['name' => 'Game', 'slug' => 'game', 'icon' => 'g']);
        $brand = Provider::create(['name' => 'FC Mobile', 'is_active' => true]);
        Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $vip->id,
            'sku_code' => 'VIP-pre33639303',
            'name' => 'FC Mobile VIP clone sku',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        $resolver = app(GameNicknameResolver::class);
        $schema = $resolver->resolveForProduct('FC Mobile', 'VIP-pre33639303');

        $this->assertNotSame('digiflazz_desc', $schema['source']);
        $this->assertSame('unknown', $schema['delivery']);
        $this->assertSame([], $schema['fields']);
    }

    public function test_unknown_brand_fail_closed(): void
    {
        $resolver = app(GameNicknameResolver::class);
        $schema = $resolver->resolveForProduct('Totally Unknown Game XYZ', null);

        $this->assertSame('unknown', $schema['delivery']);
        $this->assertSame([], $schema['fields']);
        $this->assertFalse($schema['purchasable']);
    }

    public function test_sku_override_beats_game_profile(): void
    {
        config([
            'gurky_game.sku_schemas' => [
                'ff50' => [
                    'delivery' => 'unknown',
                    'fields' => [],
                    'provenance' => [
                        'source' => 'OWNER_REVIEW',
                        'evidence' => 'forced unknown for test',
                        'confidence' => 'needs_review',
                    ],
                ],
            ],
        ]);

        $resolver = app(GameNicknameResolver::class);
        $schema = $resolver->resolveForProduct('Free Fire', 'ff50');

        $this->assertSame('unknown', $schema['delivery']);
        $this->assertSame('sku_override', $schema['source']);
    }

    public function test_vip_note_phone_style_is_used_when_present(): void
    {
        $vip = ProductProvider::vip() ?? ProductProvider::create([
            'code' => 'vip',
            'name' => 'VIP',
            'is_active' => true,
            'priority' => 2,
            'sort_order' => 2,
        ]);
        $category = ProductCategory::create(['name' => 'Game', 'slug' => 'game', 'icon' => 'g']);
        $brand = Provider::create(['name' => 'Mystery Game', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $vip->id,
            'sku_code' => 'VIP-MYST01',
            'name' => 'Mystery',
            'base_price' => 1000,
            'sell_price' => 1100,
            'admin_fee' => 0,
            'status' => true,
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $vip->id,
            'provider_sku' => 'MYST01',
            'provider_name' => 'Mystery',
            'base_price' => 1000,
            'provider_price' => 1000,
            'provider_status' => 'available',
            'provider_meta' => ['note' => 'Masukkan UID'],
            'is_active' => true,
        ]);

        $resolver = app(GameNicknameResolver::class);
        $schema = $resolver->resolveForProduct('Mystery Game', 'VIP-MYST01');

        $this->assertSame('unknown', $schema['delivery']);
        $this->assertSame([], $schema['fields']);
    }
}
