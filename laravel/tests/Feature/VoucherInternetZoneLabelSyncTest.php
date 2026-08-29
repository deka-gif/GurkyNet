<?php

namespace Tests\Feature;

use App\Models\DigiflazzProduct;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VoucherInternetZoneLabelSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_backfill_command_sets_zone_label_from_vip_meta_and_skips_pulsa(): void
    {
        $viCategory = ProductCategory::create(['slug' => 'voucher-internet', 'name' => 'Voucher Internet', 'icon' => 'wifi']);
        $pulsaCategory = ProductCategory::create(['slug' => 'pulsa', 'name' => 'Pulsa', 'icon' => 'phone']);
        $telkomsel = Provider::create(['name' => 'Telkomsel', 'is_active' => true]);
        $xl = Provider::create(['name' => 'XL Axiata', 'is_active' => true]);
        $vip = ProductProvider::query()->where('code', 'vip')->first()
            ?? ProductProvider::create(['code' => 'vip', 'name' => 'VIPAYMENT', 'is_active' => true, 'priority' => 2]);

        $regional = Product::create([
            'product_category_id' => $viCategory->id,
            'provider_id' => $telkomsel->id,
            'sku_code' => 'VIP-TEST-Z1',
            'name' => 'Voucher Telkomsel 1 GB 3 Hari (Sumatera Utara Zona 1)',
            'base_price' => 10000,
            'sell_price' => 12000,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $regional->id,
            'product_provider_id' => $vip->id,
            'provider_sku' => 'TEST-Z1',
            'base_price' => 10000,
            'provider_meta' => ['category' => 'Sumatera Utara Zona 1', 'type' => 'paket-lainnya'],
            'is_active' => true,
        ]);

        $umum = Product::create([
            'product_category_id' => $viCategory->id,
            'provider_id' => $telkomsel->id,
            'sku_code' => 'pre33213237',
            'name' => 'Voucher Telkomsel 3 GB 5 Hari',
            'base_price' => 13000,
            'sell_price' => 15000,
            'status' => true,
        ]);

        DigiflazzProduct::create([
            'buyer_sku_code' => 'pre33213237',
            'product_name' => 'Voucher Telkomsel 3 GB 5 Hari',
            'category' => 'Voucher',
            'brand' => 'TELKOMSEL',
            'type' => 'Umum',
            'seller_price' => 13000,
        ]);

        $pulsa = Product::create([
            'product_category_id' => $pulsaCategory->id,
            'provider_id' => $telkomsel->id,
            'sku_code' => 'PULSA-10K',
            'name' => 'Pulsa Telkomsel 10K',
            'base_price' => 10000,
            'sell_price' => 11000,
            'status' => true,
        ]);

        ProductProviderSku::create([
            'product_id' => $pulsa->id,
            'product_provider_id' => $vip->id,
            'provider_sku' => 'PULSA10K',
            'base_price' => 10000,
            'provider_meta' => ['category' => 'Jawa Barat'],
            'is_active' => true,
        ]);

        $this->artisan('catalog:backfill-voucher-internet-zone-labels')->assertSuccessful();

        $this->assertSame('Sumatera Utara Zona 1', $regional->fresh()->zone_label);
        $this->assertNull($umum->fresh()->zone_label);
        $this->assertNull($pulsa->fresh()->zone_label);
    }

    public function test_product_api_exposes_zone_label(): void
    {
        $category = ProductCategory::create(['slug' => 'voucher-internet', 'name' => 'Voucher Internet', 'icon' => 'wifi']);
        $telkomsel = Provider::create(['name' => 'Telkomsel', 'is_active' => true]);
        Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $telkomsel->id,
            'sku_code' => 'VI-API-1',
            'name' => 'Voucher Telkomsel Test',
            'zone_label' => 'Jabodetabek',
            'base_price' => 10000,
            'sell_price' => 12000,
            'status' => true,
            'ops_status' => 'active',
        ]);

        $response = $this->getJson('/api/v1/products?category=voucher-internet&per_page=10');
        $response->assertOk();
        $rows = collect($response->json('data'));
        $hit = $rows->firstWhere('code', 'VI-API-1');
        $this->assertNotNull($hit);
        $this->assertSame('Jabodetabek', $hit['zoneLabel']);
    }
}
