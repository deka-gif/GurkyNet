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

    /**
     * Regression guard: a product's real provider category must win over a
     * name-keyword coincidence. "Pulsa" is Digiflazz-authoritative here even though
     * the product name contains "voucher" and "data", which would otherwise trip the
     * voucher-internet name_keywords fallback if it ran before the provider category.
     */
    public function test_provider_category_outranks_name_keyword_coincidence(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Pulsa', 'Telkomsel', 'Bonus Voucher Data Telkomsel 5000');
        $this->assertSame('pulsa', $m['slug']);
        $this->assertSame('provider_category', $m['source']);
    }

    public function test_name_keyword_still_used_as_fallback_when_provider_category_unmapped(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Unrecognized Provider Category', '', 'Voucher Kuota XL 5GB');
        $this->assertSame('voucher-internet', $m['slug']);
        $this->assertSame('name_keyword', $m['source']);
    }

    /** Regression: "perdana" must not false-positive brand_override "dana" → topup-digital. */
    public function test_axis_aktivasi_perdana_maps_to_aktivasi_perdana_not_ewallet(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map(
            'digiflazz',
            'Aktivasi Perdana',
            'AXIS',
            'Aktivasi Perdana Axis 3 GB 60 Hari (SP5K SP7K)'
        );
        $this->assertSame('aktivasi-perdana', $m['slug']);
        $this->assertSame('brand_override', $m['source']);
    }

    /** Regression: Telkomsel kuota vouchers belong in voucher-internet, not gift-card voucher-digital. */
    public function test_telkomsel_voucher_category_maps_to_voucher_internet(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map(
            'digiflazz',
            'Voucher',
            'TELKOMSEL',
            'Voucher Telkomsel 2.5 GB 5 Hari'
        );
        $this->assertSame('voucher-internet', $m['slug']);
        $this->assertSame('brand_override', $m['source']);
    }

    public function test_dana_ewallet_still_maps_to_topup_digital(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'E-Money', 'DANA', 'DANA 50.000');
        $this->assertSame('topup-digital', $m['slug']);
    }
}
