<?php

namespace Tests\Unit;

use App\Services\Catalog\VoucherInternetZoneLabelResolver;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class VoucherInternetZoneLabelResolverTest extends TestCase
{
    private VoucherInternetZoneLabelResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resolver = new VoucherInternetZoneLabelResolver;
    }

    public function test_applies_to_voucher_internet_and_sms_slugs(): void
    {
        $this->assertTrue($this->resolver->appliesToCategorySlug('voucher-internet'));
        $this->assertTrue($this->resolver->appliesToCategorySlug('sms-telepon'));
        $this->assertTrue($this->resolver->appliesToCategorySlug('paket-sms-telpon'));
        $this->assertFalse($this->resolver->appliesToCategorySlug('pulsa'));
        $this->assertFalse($this->resolver->appliesToCategorySlug(null));
    }

    #[DataProvider('vipMetaProvider')]
    public function test_from_vip_provider_meta(array $meta, ?string $name, ?string $expected): void
    {
        $this->assertSame($expected, $this->resolver->fromVipProviderMeta($meta, $name));
    }

    public static function vipMetaProvider(): array
    {
        return [
            'regional category' => [['category' => 'Sumatera Utara Zona 1'], null, 'Sumatera Utara Zona 1'],
            'umum becomes null' => [['category' => 'Umum'], null, null],
            'gamemax by name' => [['category' => 'GamesMAX Unlimited Play'], 'Voucher Telkomsel GamesMAX Unlimited Play Silver Free Fire / 30 Hari', null],
        ];
    }

    public function test_from_digiflazz_type_vi_unchanged(): void
    {
        $this->assertSame(
            'Jawa Barat',
            $this->resolver->fromDigiflazzType('Jawa Barat', 'Voucher Telkomsel 1.5 GB 3 Hari (Jawa Barat)', 'voucher-internet')
        );
        $this->assertNull($this->resolver->fromDigiflazzType('Umum', 'Voucher Telkomsel 3 GB 5 Hari', 'voucher-internet'));
        // Non-geo Digi type on VI still kept (existing VI catalog may use it); SMS filters separately.
        $this->assertSame('Hot Promo', $this->resolver->fromDigiflazzType('Hot Promo', 'Promo', 'voucher-internet'));
    }

    public function test_sms_keeps_geo_types_and_nulls_non_geo(): void
    {
        $this->assertSame(
            'Sumatera Utara Zona 3',
            $this->resolver->fromDigiflazzType('Sumatera Utara Zona 3', 'Telkomsel Telepon', 'sms-telepon')
        );
        $this->assertSame(
            'Papua Maluku',
            $this->resolver->fromDigiflazzType('Papua Maluku', 'Telkomsel Telepon', 'sms-telepon')
        );
        $this->assertNull($this->resolver->fromDigiflazzType('Telepon Pas', 'Telkomsel Telepon Pas', 'sms-telepon'));
        $this->assertNull($this->resolver->fromDigiflazzType('Spesial', 'Telkomsel Spesial', 'sms-telepon'));
        $this->assertNull($this->resolver->fromDigiflazzType('Umum', 'Telkomsel SMS', 'sms-telepon'));
        $this->assertNull($this->resolver->fromDigiflazzType('Semua Operator', 'Telkomsel', 'sms-telepon'));
    }
}
