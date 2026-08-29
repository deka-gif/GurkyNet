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

    public function test_applies_only_to_voucher_internet_slug(): void
    {
        $this->assertTrue($this->resolver->appliesToCategorySlug('voucher-internet'));
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
            'gamesmax by name' => [['category' => 'GamesMAX Unlimited Play'], 'Voucher Telkomsel GamesMAX Unlimited Play Silver Free Fire / 30 Hari', null],
        ];
    }

    public function test_from_digiflazz_type(): void
    {
        $this->assertSame('Jawa Barat', $this->resolver->fromDigiflazzType('Jawa Barat', 'Voucher Telkomsel 1.5 GB 3 Hari (Jawa Barat)'));
        $this->assertNull($this->resolver->fromDigiflazzType('Umum', 'Voucher Telkomsel 3 GB 5 Hari'));
    }
}
