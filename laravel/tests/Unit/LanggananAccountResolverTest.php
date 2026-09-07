<?php

namespace Tests\Unit;

use App\Models\DigiflazzProduct;
use App\Services\Langganan\LanggananAccountResolver;
use App\Services\Langganan\LanggananDigiflazzHintReader;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LanggananAccountResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_sku_schema_overrides_brand(): void
    {
        config([
            'gurky_langganan.sku_schemas' => [
                'NFLXSPECIAL' => [
                    'delivery' => 'account',
                    'fields' => [
                        ['key' => 'phone', 'label' => 'Nomor HP Netflix', 'required' => true, 'input' => 'phone'],
                    ],
                ],
            ],
        ]);

        $resolver = app(LanggananAccountResolver::class);
        $schema = $resolver->resolveForProduct('Netflix', 'NFLXSPECIAL');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame('phone', $schema['fields'][0]['key']);
        $this->assertSame('phone', $schema['fields'][0]['input']);
    }

    public function test_digiflazz_desc_email_hint_per_sku(): void
    {
        DigiflazzProduct::create([
            'buyer_sku_code' => 'STREAMEMAIL01',
            'product_name' => 'Streaming Email Paket',
            'category' => 'Streaming',
            'brand' => 'Unknown Stream',
            'seller_price' => 10000,
            'desc' => 'Masukkan email akun untuk aktivasi',
        ]);

        $resolver = app(LanggananAccountResolver::class);
        $schema = $resolver->resolveForProduct('Unknown Stream', 'STREAMEMAIL01');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame('email', $schema['fields'][0]['key']);
    }

    public function test_digiflazz_desc_voucher_hint_per_sku(): void
    {
        DigiflazzProduct::create([
            'buyer_sku_code' => 'STREAMVOUCH01',
            'product_name' => 'Streaming Voucher',
            'category' => 'Streaming',
            'brand' => 'Unknown Stream',
            'seller_price' => 10000,
            'desc' => 'Produk voucher, kode aktivasi via SN',
        ]);

        $resolver = app(LanggananAccountResolver::class);
        $schema = $resolver->resolveForProduct('Unknown Stream', 'STREAMVOUCH01');

        $this->assertSame('voucher', $schema['delivery']);
        $this->assertSame([], $schema['fields']);
    }

    public function test_falls_back_to_brand_when_sku_has_no_hint(): void
    {
        $resolver = app(LanggananAccountResolver::class);
        $schema = $resolver->resolveForProduct('Vidio', 'VIDIOUNKNOWN');

        $this->assertSame('voucher', $schema['delivery']);
        $this->assertSame([], $schema['fields']);
    }

    public function test_unmapped_brand_is_unknown_not_voucher(): void
    {
        $resolver = app(LanggananAccountResolver::class);
        $schema = $resolver->resolveForProduct('Brand Tanpa Mapping XYZ', 'SKUUNKNOWN99');

        $this->assertSame('unknown', $schema['delivery']);
        $this->assertSame([], $schema['fields']);
    }

    public function test_vidio_digi_sku_is_phone(): void
    {
        $resolver = app(LanggananAccountResolver::class);
        $schema = $resolver->resolveForProduct('Vidio', 'pre33615183');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame('phone', $schema['fields'][0]['key']);
    }

    public function test_nex_and_kvision_sku_unknown(): void
    {
        $resolver = app(LanggananAccountResolver::class);

        $this->assertSame('unknown', $resolver->resolveForProduct('Nex Parabola', 'pre33615053')['delivery']);
        $this->assertSame('unknown', $resolver->resolveForProduct('K-VISION', 'kvision30d')['delivery']);
    }

    public function test_hint_reader_parses_phone_from_desc(): void
    {
        $reader = app(LanggananDigiflazzHintReader::class);
        $parsed = $reader->parseDesc('Format: nomor HP pelanggan');

        $this->assertNotNull($parsed);
        $this->assertSame('account', $parsed['delivery']);
        $this->assertSame('phone', $parsed['fields'][0]['key']);
    }

    public function test_hint_reader_vidio_phone_phrase(): void
    {
        $reader = app(LanggananDigiflazzHintReader::class);
        $parsed = $reader->parseDesc('Masukkan no hp yang terdaftar di Vidio');

        $this->assertNotNull($parsed);
        $this->assertSame('phone', $parsed['fields'][0]['key']);
    }

    public function test_hint_reader_does_not_false_positive_on_bare_id(): void
    {
        $reader = app(LanggananDigiflazzHintReader::class);
        $this->assertNull($reader->parseDesc('Bonus id bisa berubah'));
        $this->assertNull($reader->parseDesc('-'));
    }

    public function test_digi_sku_schema_does_not_apply_to_vip_product(): void
    {
        $vip = \App\Models\ProductProvider::vip() ?? \App\Models\ProductProvider::create([
            'code' => 'vip',
            'name' => 'VIP',
            'is_active' => true,
            'priority' => 2,
            'sort_order' => 2,
        ]);
        $category = \App\Models\ProductCategory::create([
            'name' => 'Langganan Digital',
            'slug' => 'langganan-digital',
            'icon' => 'tv',
        ]);
        $brand = \App\Models\Provider::create(['name' => 'Vidio', 'is_active' => true]);
        \App\Models\Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $vip->id,
            'sku_code' => 'VIP-pre33615183',
            'name' => 'Vidio VIP',
            'base_price' => 30000,
            'sell_price' => 31000,
            'admin_fee' => 0,
            'status' => true,
        ]);

        $resolver = app(LanggananAccountResolver::class);
        $schema = $resolver->resolveForProduct('Vidio', 'VIP-pre33615183');

        // Digi phone SKU map must not leak; VIP falls to Vidio brand voucher.
        $this->assertSame('voucher', $schema['delivery']);
        $this->assertSame([], $schema['fields']);
    }

    public function test_vidio_digi_phone_beats_brand_voucher(): void
    {
        $resolver = app(LanggananAccountResolver::class);
        $schema = $resolver->resolveForProduct('Vidio', 'pre33615184');

        $this->assertSame('account', $schema['delivery']);
        $this->assertSame('phone', $schema['fields'][0]['key']);
    }
}
