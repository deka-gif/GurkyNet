<?php

namespace Tests\Feature;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Services\Catalog\DynamicOperatorDataTaxonomyService;
use App\Services\Catalog\TelkomselDataTaxonomyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Digi `type`-driven Paket Data chips (all operators via one service).
 */
class DynamicOperatorDataTaxonomyTest extends TestCase
{
    use RefreshDatabase;

    protected ProductCategory $dataCategory;
    protected ProductProvider $digi;
    protected Provider $telkomsel;

    protected function setUp(): void
    {
        parent::setUp();

        $this->digi = ProductProvider::digiflazz();
        $this->digi?->update(['is_active' => true, 'api_status' => 'online']);

        $this->dataCategory = ProductCategory::create([
            'name' => 'Paket Data',
            'slug' => 'data',
            'icon' => 'wifi',
        ]);

        $this->telkomsel = Provider::create([
            'name' => 'Telkomsel',
            'logo' => null,
            'is_active' => true,
        ]);
    }

    protected function makeDataProduct(string $sku, string $name, string $digiType, ?Provider $provider = null): Product
    {
        $provider ??= $this->telkomsel;
        $product = Product::create([
            'product_category_id' => $this->dataCategory->id,
            'provider_id' => $provider->id,
            'product_provider_id' => $this->digi?->id,
            'sku_code' => $sku,
            'name' => $name,
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);

        DigiflazzProduct::create([
            'buyer_sku_code' => $sku,
            'list_type' => 'prepaid',
            'product_name' => $name,
            'category' => 'Data',
            'brand' => strtoupper($provider->name),
            'type' => $digiType,
            'seller_name' => 'Test Seller',
            'seller_price' => 10000,
            'admin' => 0,
            'commission' => 0,
            'buyer_product_status' => true,
            'seller_product_status' => true,
            'unlimited_stock' => true,
            'stock' => 0,
            'multi' => true,
            'desc' => $name,
        ]);

        if ($this->digi) {
            ProductProviderSku::create([
                'product_id' => $product->id,
                'product_provider_id' => $this->digi->id,
                'provider_sku' => $sku,
                'provider_name' => $name,
                'base_price' => 10000,
                'provider_price' => 10000,
                'provider_status' => 'available',
                'is_preferred' => true,
                'is_active' => true,
            ]);
        }

        return $product;
    }

    public function test_chips_from_digi_types_umum_first_then_alpha_no_favorit_no_roaming(): void
    {
        $this->makeDataProduct('tsel-is', 'Internet Sakti 10GB', 'Internet Sakti');
        $this->makeDataProduct('tsel-cs', 'Combo Sakti 12GB', 'Combo Sakti');
        $this->makeDataProduct('tsel-um', 'Paket Umum', 'Umum');
        $this->makeDataProduct('tsel-wa', 'Whatsapp 2GB', 'Whatsapp');
        // Empty Digi type → Umum (already have Umum chip)
        $this->makeDataProduct('tsel-empty', 'Paket Tanpa Type', '');

        $svc = app(DynamicOperatorDataTaxonomyService::class);
        $payload = $svc->taxonomyFor('telkomsel');
        $labels = array_column($payload['chips'], 'label');
        $groups = array_column($payload['chips'], 'group');

        $this->assertSame('Semua', $labels[0]);
        $this->assertNull($groups[0]);
        // Umum immediately after Semua
        $this->assertSame('Umum', $labels[1]);
        $this->assertSame(['Semua', 'Umum', 'Combo Sakti', 'Internet Sakti', 'Whatsapp'], $labels);
        $this->assertNotContains('Favorit', $labels);
        $this->assertNotContains('Roaming', $labels);
        $this->assertNotContains('roaming', array_map('strtolower', $labels));
    }

    public function test_new_digi_type_appears_automatically_without_code_change(): void
    {
        $this->makeDataProduct('tsel-is', 'Internet Sakti 10GB', 'Internet Sakti');
        $svc = app(DynamicOperatorDataTaxonomyService::class);

        $before = array_column($svc->taxonomyFor('telkomsel')['chips'], 'label');
        $this->assertNotContains('Musik', $before);

        // Simulate Digi sync adding a brand-new type SKU — no config/code edits.
        $this->makeDataProduct('tsel-musik', 'Paket Musik 5GB', 'Musik');

        $after = array_column($svc->taxonomyFor('telkomsel')['chips'], 'label');
        $this->assertContains('Musik', $after);
        $musik = collect($svc->taxonomyFor('telkomsel')['chips'])->firstWhere('label', 'Musik');
        $this->assertSame('Musik', $musik['data_type']);
        $this->assertSame('Musik', $musik['group']);
    }

    public function test_product_filter_exact_digi_type_not_keyword(): void
    {
        $user = \App\Models\User::factory()->create();
        Sanctum::actingAs($user);

        $this->makeDataProduct('tsel-wa', 'Whatsapp 2GB', 'Whatsapp');
        $this->makeDataProduct('tsel-ig', 'Instagram 3GB', 'Instagram');
        // Name contains "roaming" but Digi type is Umum — must NOT match Whatsapp filter
        $this->makeDataProduct('tsel-fake', 'Fake Roaming Name', 'Umum');

        $res = $this->getJson('/api/v1/products?category=data&provider=Telkomsel&data_type=Whatsapp&per_page=50');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();
        $this->assertContains('tsel-wa', $codes);
        $this->assertNotContains('tsel-ig', $codes);
        $this->assertNotContains('tsel-fake', $codes);
    }

    public function test_taxonomy_endpoints_all_seven_operators_use_same_service(): void
    {
        $ops = [
            'telkomsel' => 'Telkomsel',
            'xl' => 'XL',
            'indosat' => 'Indosat',
            'tri' => 'Tri',
            'smartfren' => 'Smartfren',
            'axis' => 'AXIS',
            'byu' => 'by.U',
        ];

        foreach ($ops as $key => $providerName) {
            $provider = Provider::firstOrCreate(
                ['name' => $providerName],
                ['logo' => null, 'is_active' => true]
            );
            $this->makeDataProduct("sku-{$key}-umum", "{$providerName} Umum", 'Umum', $provider);
        }

        $user = \App\Models\User::factory()->create();
        Sanctum::actingAs($user);

        foreach (array_keys($ops) as $key) {
            $res = $this->getJson("/api/v1/catalog/{$key}-data/taxonomy");
            $res->assertOk();
            $chips = $res->json('data.chips');
            $this->assertIsArray($chips);
            $this->assertSame('semua', $chips[0]['key']);
            $labels = array_column($chips, 'label');
            $this->assertContains('Umum', $labels);
            $this->assertNotContains('Favorit', $labels);
        }
    }

    public function test_legacy_keyword_chips_not_returned_by_dynamic_service(): void
    {
        $this->makeDataProduct('tsel-is', 'Internet Sakti 10GB', 'Internet Sakti');
        $legacy = app(TelkomselDataTaxonomyService::class)->chips();
        $legacyLabels = array_column($legacy, 'label');
        $this->assertContains('Roaming', $legacyLabels); // still in config file

        $dynamic = app(DynamicOperatorDataTaxonomyService::class)->taxonomyFor('telkomsel');
        $dynLabels = array_column($dynamic['chips'], 'label');
        $this->assertNotContains('Roaming', $dynLabels);
        $this->assertContains('Internet Sakti', $dynLabels);
    }
}
