<?php

namespace Tests\Unit;

use App\Services\Catalog\ProductMappingService;
use Tests\TestCase;

class ProductMappingServiceTest extends TestCase
{
    public function test_maps_digiflazz_games_to_game(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Games', 'Mobile Legends', 'MLBB 86 Diamond');
        $this->assertSame('game', $m['slug']);
    }

    public function test_maps_netflix_to_langganan_not_game(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Games', 'Netflix', 'Netflix 1 Bulan');
        $this->assertSame('langganan-digital', $m['slug']);
    }

    public function test_maps_google_play_to_voucher_digital(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Voucher', 'Google Play', 'Google Play 100rb');
        $this->assertSame('voucher-digital', $m['slug']);
    }

    public function test_maps_gopay_to_topup_digital(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'E-Money', 'GoPay', 'GoPay 50.000');
        $this->assertSame('topup-digital', $m['slug']);
    }

    public function test_maps_pdam_to_tagihan_family(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'PDAM', 'PDAM Jakarta', 'PDAM');
        $this->assertSame('pdam', $m['slug']);
        $this->assertSame('pembayaran-tagihan', $m['hub']);
    }

    public function test_streaming_category_to_langganan(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Streaming', 'Spotify', 'Spotify Premium');
        $this->assertSame('langganan-digital', $m['slug']);
    }

    public function test_vip_game_hint(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('vip', 'prepaid', 'Free Fire', 'FF 70 Diamond', true);
        $this->assertSame('game', $m['slug']);
    }

    public function test_filter_slugs_include_legacy_ewallet(): void
    {
        $svc = app(ProductMappingService::class);
        $slugs = $svc->filterSlugs('topup-digital');
        $this->assertContains('ewallet', $slugs);
        $this->assertContains('topup-digital', $slugs);
    }
}
