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

    public function test_hint_reader_parses_phone_from_desc(): void
    {
        $reader = app(LanggananDigiflazzHintReader::class);
        $parsed = $reader->parseDesc('Format: nomor HP pelanggan');

        $this->assertNotNull($parsed);
        $this->assertSame('account', $parsed['delivery']);
        $this->assertSame('phone', $parsed['fields'][0]['key']);
    }
}
