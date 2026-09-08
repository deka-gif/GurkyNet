<?php

namespace Tests\Unit;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Services\Game\GameAccountSchemaResolver;
use App\Services\Game\GameNicknameResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GameAccountSchemaResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_free_fire_profile_player_id(): void
    {
        $resolver = app(GameAccountSchemaResolver::class);
        $schema = $resolver->resolve('Free Fire', 'ff50');

        $this->assertSame('account', $schema['delivery']);
        $this->assertTrue($schema['purchasable']);
        $this->assertSame('PLAYER_ID', $schema['schema_key']);
        $this->assertSame(['player_id'], collect($schema['fields'])->pluck('key')->all());
        $this->assertSame('Player ID', $schema['fields'][0]['label']);
        $this->assertSame('game_profile', $schema['source']);
        $this->assertSame('DIGIFLAZZ_SELLER_CATALOG', $schema['provenance']['source']);
        $this->assertStringContainsString('player id', strtolower($schema['provenance']['evidence']));
    }

    public function test_new_free_fire_sku_inherits_profile(): void
    {
        $resolver = app(GameAccountSchemaResolver::class);
        $schema = $resolver->resolve('Free Fire', 'freefire100');

        $this->assertSame('PLAYER_ID', $schema['schema_key']);
        $this->assertSame(['player_id'], collect($schema['fields'])->pluck('key')->all());
        $this->assertTrue($schema['purchasable']);
    }

    public function test_ml_user_zone_unchanged(): void
    {
        $resolver = app(GameAccountSchemaResolver::class);
        $schema = $resolver->resolve('Mobile Legends', 'pre33639301');

        $this->assertSame('USER_ID_ZONE_ID', $schema['schema_key']);
        $this->assertSame(['user_id', 'zone_id'], collect($schema['fields'])->pluck('key')->all());
        $this->assertTrue($schema['purchasable']);
        $this->assertSame('account', $schema['delivery']);
    }

    public function test_fc_and_garena_profiles(): void
    {
        $resolver = app(GameAccountSchemaResolver::class);

        $fc = $resolver->resolve('FC Mobile', 'pre33639303');
        $this->assertSame('UID', $fc['schema_key']);
        $this->assertSame(['user_id'], collect($fc['fields'])->pluck('key')->all());

        $garena = $resolver->resolve('Garena', 'pre33817227');
        $this->assertSame('GARENA_ID', $garena['schema_key']);
        $this->assertSame(['garena_id'], collect($garena['fields'])->pluck('key')->all());
    }

    public function test_unknown_game_not_purchasable(): void
    {
        DigiflazzProduct::create([
            'buyer_sku_code' => 'xyz999',
            'product_name' => 'Mystery Pack',
            'category' => 'Games',
            'brand' => 'Totally Unknown Game XYZ',
            'seller_price' => 1000,
            'desc' => 'Jumlah diamond',
        ]);

        $resolver = app(GameAccountSchemaResolver::class);
        $schema = $resolver->resolve('Totally Unknown Game XYZ', 'xyz999');

        $this->assertFalse($schema['purchasable']);
        $this->assertSame('unknown', $schema['delivery']);
        $this->assertSame(GameAccountSchemaResolver::REASON_UNKNOWN_SCHEMA, $schema['not_purchasable_reason']);
        $this->assertSame(GameAccountSchemaResolver::LIFECYCLE_NEEDS_REVIEW, $schema['lifecycle']);
    }

    public function test_sku_override_beats_game_profile(): void
    {
        config([
            'gurky_game.sku_overrides' => array_merge(config('gurky_game.sku_overrides', []), [
                'ff50' => [
                    'delivery' => 'unknown',
                    'schema_key' => null,
                    'fields' => [],
                    'provenance' => [
                        'source' => 'OWNER_REVIEW',
                        'evidence' => 'test override unknown',
                        'confidence' => 'needs_review',
                    ],
                ],
            ]),
        ]);

        $resolver = app(GameAccountSchemaResolver::class);
        $schema = $resolver->resolve('Free Fire', 'ff50');

        $this->assertSame('unknown', $schema['delivery']);
        $this->assertFalse($schema['purchasable']);
        $this->assertSame('sku_override', $schema['source']);
    }

    public function test_non_purchase_sku(): void
    {
        $resolver = app(GameAccountSchemaResolver::class);
        $this->assertTrue($resolver->isNonPurchaseSku('pre33639299'));
        $schema = $resolver->resolve('Mobile Legends', 'pre33639299');
        $this->assertFalse($schema['purchasable']);
        $this->assertSame(GameAccountSchemaResolver::REASON_NON_PURCHASE, $schema['not_purchasable_reason']);
    }

    public function test_vip_catalog_not_purchasable(): void
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
            'is_active' => true,
        ]);

        $schema = app(GameAccountSchemaResolver::class)->resolve('Free Fire', 'VIP-FFDIAMOND50');
        $this->assertFalse($schema['purchasable']);
        $this->assertSame(GameAccountSchemaResolver::REASON_VIP_SCHEMA_OFF, $schema['not_purchasable_reason']);
    }

    public function test_free_fire_customer_no_schema_is_player_id_only(): void
    {
        $schema = app(GameNicknameResolver::class)->resolveForProduct('Free Fire', 'ff140');
        $this->assertSame('PLAYER_ID', $schema['schema_key']);
        $this->assertSame(['player_id'], collect($schema['fields'])->pluck('key')->all());
        $this->assertTrue($schema['purchasable']);
        $this->assertCount(1, $schema['fields']);
    }
}
