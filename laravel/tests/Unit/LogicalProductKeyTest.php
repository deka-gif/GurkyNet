<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Services\ProductProviders\LogicalProductKey;
use Tests\TestCase;

class LogicalProductKeyTest extends TestCase
{
    public function test_normalize_name_strips_provider_noise(): void
    {
        $this->assertSame(
            'telkomsel 50.000',
            LogicalProductKey::normalizeName('Telkomsel Pulsa 50.000')
        );
        $this->assertSame(
            'indosat 25.000',
            LogicalProductKey::normalizeName('Indosat Pulsa Reguler 25.000')
        );
        $this->assertSame(
            'xl 10.000',
            LogicalProductKey::normalizeName('XL Prepaid 10.000')
        );
    }

    public function test_extract_denomination_is_numeric_not_text(): void
    {
        $this->assertSame(5000, LogicalProductKey::extractDenomination('Telkomsel 5.000'));
        $this->assertSame(100000, LogicalProductKey::extractDenomination('Telkomsel Pulsa 100.000'));
        $this->assertSame(15000, LogicalProductKey::extractDenomination('Axis 15.000'));
        $this->assertNull(LogicalProductKey::extractDenomination('Mobile Legends 86 Diamonds'));
    }

    public function test_group_key_merges_digi_and_vip_name_variants(): void
    {
        $category = new ProductCategory(['slug' => 'pulsa', 'name' => 'Pulsa']);
        $category->id = 1;
        $brand = new Provider(['name' => 'Telkomsel']);
        $brand->id = 10;

        $digi = new Product([
            'name' => 'Telkomsel Pulsa 50.000',
            'provider_id' => 10,
            'product_category_id' => 1,
        ]);
        $digi->id = 1;
        $digi->setRelation('category', $category);
        $digi->setRelation('provider', $brand);

        $vip = new Product([
            'name' => 'Telkomsel 50.000',
            'provider_id' => 10,
            'product_category_id' => 1,
        ]);
        $vip->id = 2;
        $vip->setRelation('category', $category);
        $vip->setRelation('provider', $brand);

        $this->assertSame(LogicalProductKey::groupKey($digi), LogicalProductKey::groupKey($vip));
    }

    public function test_sort_tuple_orders_nominal_numerically(): void
    {
        $category = new ProductCategory(['slug' => 'pulsa', 'name' => 'Pulsa']);
        $category->id = 1;
        $brand = new Provider(['name' => 'Telkomsel']);
        $brand->id = 10;

        $p100 = new Product(['name' => 'Telkomsel 100.000', 'provider_id' => 10, 'product_category_id' => 1]);
        $p100->id = 2;
        $p100->setRelation('category', $category);
        $p100->setRelation('provider', $brand);

        $p15 = new Product(['name' => 'Telkomsel 15.000', 'provider_id' => 10, 'product_category_id' => 1]);
        $p15->id = 1;
        $p15->setRelation('category', $category);
        $p15->setRelation('provider', $brand);

        $this->assertTrue(LogicalProductKey::sortTuple($p15) < LogicalProductKey::sortTuple($p100));
    }
}
