<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Services\Langganan\LanggananCatalogIdentity;
use Tests\TestCase;

class LanggananCatalogIdentityTest extends TestCase
{
    protected function langgananProduct(string $name, string $brand = 'Steam', int $id = 1, ?int $operatorId = null): Product
    {
        $category = new ProductCategory(['slug' => 'langganan-digital', 'name' => 'Langganan Digital']);
        $category->id = 10;
        $operator = new Provider(['name' => $brand]);
        $operator->id = $operatorId ?? 20;

        $product = new Product([
            'name' => $name,
            'provider_id' => $operator->id,
            'product_category_id' => 10,
        ]);
        $product->id = $id;
        $product->setRelation('category', $category);
        $product->setRelation('provider', $operator);

        return $product;
    }

    public function test_steam_myr5_variants_share_identity(): void
    {
        $digi = $this->langgananProduct('Steam Wallet MYR 5', 'Steam', 1);
        $vip = $this->langgananProduct('Steam Wallet Code MYR 5', 'Steam', 2);

        $this->assertTrue(LanggananCatalogIdentity::sameIdentity($digi, $vip));
        $this->assertSame('cur:myr:5', LanggananCatalogIdentity::extractVariantKey($digi->name, 'Steam'));
    }

    public function test_steam_myr8_and_myr10_are_distinct(): void
    {
        $myr5 = $this->langgananProduct('Steam Wallet MYR 5');
        $myr8 = $this->langgananProduct('Steam Wallet MYR 8');
        $myr10 = $this->langgananProduct('Steam Wallet MYR 10');

        $this->assertFalse(LanggananCatalogIdentity::sameIdentity($myr5, $myr8));
        $this->assertFalse(LanggananCatalogIdentity::sameIdentity($myr8, $myr10));
    }

    public function test_duration_variants_normalize_to_same_days(): void
    {
        $thirtyDays = $this->langgananProduct('Netflix Premium 30 Hari', 'Netflix', 1);
        $oneMonth = $this->langgananProduct('Netflix Premium 1 Bulan', 'Netflix', 2);

        $this->assertTrue(LanggananCatalogIdentity::sameIdentity($thirtyDays, $oneMonth));
    }

    public function test_tiktok_only_product_has_unique_key(): void
    {
        $tiktok = $this->langgananProduct('TikTok Premium 30 Hari', 'TikTok', 3, 103);
        $netflix = $this->langgananProduct('Netflix Premium 30 Hari', 'Netflix', 4, 104);

        $this->assertFalse(LanggananCatalogIdentity::sameIdentity($tiktok, $netflix));
    }

    public function test_non_langganan_category_not_flagged(): void
    {
        $category = new ProductCategory(['slug' => 'pulsa', 'name' => 'Pulsa']);
        $category->id = 1;
        $product = new Product(['name' => 'Telkomsel 10.000', 'product_category_id' => 1]);
        $product->setRelation('category', $category);

        $this->assertFalse(LanggananCatalogIdentity::isLanggananProduct($product));
    }
}
