<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductProviderArchitectureTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_providers_endpoint_excludes_payment_gateways(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => \App\Enums\UserRole::OPERATIONS,
        ]));

        // Ensure seeded providers from migration exist (RefreshDatabase re-runs migrations)
        $this->assertDatabaseHas('product_providers', ['code' => 'digiflazz']);
        $this->assertDatabaseHas('product_providers', ['code' => 'vip']);

        $response = $this->getJson('/api/v1/admin/operations/product-providers');
        $response->assertOk();

        $codes = collect($response->json('data'))->pluck('code')->all();
        $this->assertContains('digiflazz', $codes);
        $this->assertContains('vip', $codes);
        $this->assertNotContains('midtrans', $codes);
        $this->assertNotContains('xendit', $codes);
    }

    public function test_products_filter_by_product_provider_code(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => \App\Enums\UserRole::OPERATIONS,
        ]));

        $digiflazz = ProductProvider::digiflazz();
        $vip = ProductProvider::vip();
        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'phone']);
        $brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);

        Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $digiflazz->id,
            'sku_code' => 'DF-PULSA-1',
            'name' => 'Digiflazz Pulsa',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $vip->id,
            'sku_code' => 'VIP-PULSA-1',
            'name' => 'VIP Brand Pulsa',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        $digi = $this->getJson('/api/v1/admin/operations/products?product_provider_code=digiflazz');
        $digi->assertOk();
        $digiCodes = collect($digi->json('data'))->pluck('code')->all();
        $this->assertContains('DF-PULSA-1', $digiCodes);
        $this->assertNotContains('VIP-PULSA-1', $digiCodes);

        $vipRes = $this->getJson('/api/v1/admin/operations/products?product_provider_code=vip');
        $vipRes->assertOk();
        $vipCodes = collect($vipRes->json('data'))->pluck('code')->all();
        $this->assertContains('VIP-PULSA-1', $vipCodes);
        $this->assertNotContains('DF-PULSA-1', $vipCodes);

        // Filter by product_provider_id
        $byId = $this->getJson('/api/v1/admin/operations/products?product_provider_id=' . $vip->id);
        $byId->assertOk();
        $this->assertSame(['VIP-PULSA-1'], collect($byId->json('data'))->pluck('code')->all());

        // Legacy payment-gateway label must NOT return Digiflazz products
        $mid = $this->getJson('/api/v1/admin/operations/products?provider=Midtrans');
        $mid->assertOk();
        $this->assertSame([], collect($mid->json('data'))->pluck('code')->all());

        $xendit = $this->getJson('/api/v1/admin/operations/products?provider=Xendit');
        $xendit->assertOk();
        $this->assertSame([], collect($xendit->json('data'))->pluck('code')->all());
    }

    public function test_product_providers_dropdown_returns_only_id_name_code_ordered(): void
    {
        Sanctum::actingAs(User::factory()->create([
            'role' => \App\Enums\UserRole::OPERATIONS,
        ]));

        $response = $this->getJson('/api/v1/admin/operations/product-providers');
        $response->assertOk();

        $data = collect($response->json('data'));
        $this->assertTrue($data->isNotEmpty());
        $this->assertTrue($data->contains(fn ($row) => ($row['code'] ?? null) === 'vip'));
        $this->assertTrue($data->contains(fn ($row) => ($row['code'] ?? null) === 'digiflazz'));

        foreach ($data as $row) {
            $this->assertArrayHasKey('id', $row);
            $this->assertArrayHasKey('name', $row);
            $this->assertArrayHasKey('code', $row);
            $this->assertNotContains(strtolower((string) $row['code']), ['midtrans', 'xendit', 'alterra', 'artajasa']);
        }

        // Ordered by priority: Digiflazz (1) before VIP (2)
        $codes = $data->pluck('code')->values()->all();
        $this->assertLessThan(
            array_search('vip', $codes, true),
            array_search('digiflazz', $codes, true)
        );
    }
}
