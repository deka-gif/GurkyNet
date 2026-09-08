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

    /**
     * Regression: Telkomsel GamesMAX / Free Fire data packages must stay in Paket Data,
     * never Layanan Game (brand_override "free fire" must not win for telco brands).
     */
    public function test_telkomsel_gamesmax_free_fire_maps_to_data_not_game(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map(
            'digiflazz',
            'Data',
            'Telkomsel',
            'GamesMAX Free Fire 1.5GB 3 Hari'
        );
        $this->assertSame('data', $m['slug']);
        $this->assertNotSame('game', $m['slug']);
    }

    /** Digi mislabels as Games but brand is Telkomsel → still Paket Data. */
    public function test_telkomsel_never_stays_in_game_even_if_provider_says_games(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map(
            'digiflazz',
            'Games',
            'Telkomsel',
            'Free Fire Combo 2GB 3 Hari'
        );
        $this->assertSame('data', $m['slug']);
        $this->assertSame('telco_not_game', $m['source']);
    }

    /**
     * Telkomsel data packs titled after streaming apps must stay in Paket Data,
     * not Langganan Digital (brand_override "youtube" must not win for telco).
     */
    public function test_telkomsel_youtube_pack_maps_to_data_not_langganan(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map(
            'digiflazz',
            'Data',
            'Telkomsel',
            'YouTube 2GB 3 Hari'
        );
        $this->assertSame('data', $m['slug']);
        $this->assertNotSame('langganan-digital', $m['slug']);
    }

    /** Digi mislabels Telkomsel as Streaming → Paket Data under Telkomsel. */
    public function test_telkomsel_streaming_category_maps_to_data_not_langganan(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map(
            'digiflazz',
            'Streaming',
            'Telkomsel',
            'Paket Streaming 5GB'
        );
        $this->assertSame('data', $m['slug']);
        $this->assertSame('telco_not_langganan', $m['source']);
    }

    /** Tri + Vidio-named pack → Paket Data (Tri), not Langganan Digital. */
    public function test_tri_vidio_pack_maps_to_data_not_langganan(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map(
            'digiflazz',
            'Streaming',
            'Tri',
            'Vidio 1GB 7 Hari'
        );
        $this->assertSame('data', $m['slug']);
        $this->assertSame('telco_not_langganan', $m['source']);
    }

    /** Real streaming subscription brands still map to Langganan Digital. */
    public function test_real_vidio_brand_still_maps_to_langganan(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Streaming', 'Vidio', 'Vidio Platinum 30 Hari');
        $this->assertSame('langganan-digital', $m['slug']);
    }

    /** Real game top-up brands still map to Game. */
    public function test_real_free_fire_brand_still_maps_to_game(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Games', 'Free Fire', 'Free Fire 70 Diamond');
        $this->assertSame('game', $m['slug']);
    }

    public function test_dana_ewallet_still_maps_to_topup_digital(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'E-Money', 'DANA', 'DANA 50.000');
        $this->assertSame('topup-digital', $m['slug']);
        $this->assertSame('E-Wallet', $m['name']);
    }

    public function test_pln_prepaid_is_token_pln_slug(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'PLN', 'PLN', 'Token Listrik 20rb', false, 'prepaid');
        $this->assertSame('pln', $m['slug']);
        $this->assertSame('Token PLN', $m['name']);
        $this->assertSame('pln_list_type_prepaid', $m['source']);
    }

    public function test_pln_prepaid_without_list_type_stays_token_pln(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'PLN', 'PLN', 'Token Listrik 20rb');
        $this->assertSame('pln', $m['slug']);
        $this->assertSame('Token PLN', $m['name']);
    }

    public function test_pln_pasca_brand_pln_maps_to_pln_pascabayar(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Pascabayar', 'PLN', 'Tagihan Listrik', false, 'pasca');
        $this->assertSame('pln-pascabayar', $m['slug']);
        $this->assertSame('PLN Pascabayar', $m['name']);
        $this->assertSame('pln_list_type_pasca', $m['source']);
    }

    public function test_pln_pasca_brand_pln_pascabayar_maps_to_pln_pascabayar(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Pascabayar', 'PLN PASCABAYAR', 'PLN Pascabayar', false, 'pasca');
        $this->assertSame('pln-pascabayar', $m['slug']);
        $this->assertSame('PLN Pascabayar', $m['name']);
    }

    public function test_aktivasi_voucher_maps_to_voucher_internet(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Aktivasi Voucher', 'XL', 'Aktivasi Voucher XL');
        $this->assertSame('voucher-internet', $m['slug']);
    }

    public function test_canonicalize_raw_aliases(): void
    {
        $svc = app(ProductMappingService::class);
        $this->assertSame('game', $svc->canonicalizeSlug('game-feature'));
        $this->assertSame('game', $svc->canonicalizeSlug('gamed'));
        $this->assertSame('game', $svc->canonicalizeSlug('voucher-game'));
        $this->assertSame('topup-digital', $svc->canonicalizeSlug('saldo-emoney'));
        $this->assertSame('topup-digital', $svc->canonicalizeSlug('e-money'));
        $this->assertSame('langganan-digital', $svc->canonicalizeSlug('streaming-tv'));
        $this->assertSame('pulsa', $svc->canonicalizeSlug('pulsa-reguler'));
        $this->assertSame('data', $svc->canonicalizeSlug('paket-lainnya'));
        $this->assertSame('voucher-digital', $svc->canonicalizeSlug('voucher'));
    }

    /** Digiflazz pascabayar sub-types resolve via brand_overrides (category is always Pascabayar). */
    public function test_pascabayar_internet_brand_maps_to_internet_pascabayar(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Pascabayar', 'INTERNET PASCABAYAR', 'XL HOME', false, 'pasca');
        $this->assertSame('internet-pascabayar', $m['slug']);
        $this->assertSame('brand_override', $m['source']);
    }

    public function test_pascabayar_hp_brand_maps_to_hp_pascabayar(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Pascabayar', 'HP PASCABAYAR', 'Halo Postpaid', false, 'pasca');
        $this->assertSame('hp-pascabayar', $m['slug']);

        foreach (['by.U', 'Telkomsel Omni', 'Indosat Only4u', 'Tri CuanMax', 'XL Axis Cuanku'] as $brand) {
            $mapped = $svc->map('digiflazz', 'Pascabayar', $brand, $brand.' Postpaid', false, 'pasca');
            $this->assertSame('hp-pascabayar', $mapped['slug'], $brand);
        }
    }

    public function test_singapore_thailand_topup_map_to_international(): void
    {
        $svc = app(ProductMappingService::class);
        $this->assertSame(
            'international',
            $svc->map('digiflazz', 'Singapore TOPUP', 'Starhub', 'Starhub 10', false, 'prepaid')['slug']
        );
        $this->assertSame(
            'international',
            $svc->map('digiflazz', 'Thailand TOPUP', 'TrueMove', 'TrueMove H 10', false, 'prepaid')['slug']
        );
    }

    public function test_prepaid_gas_maps_to_gas_prepaid_not_postpaid_gas(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Gas', 'Pertagas', 'Pertagas 50.000', false, 'prepaid');
        $this->assertSame('gas-prepaid', $m['slug']);
        $mPasca = $svc->map('digiflazz', 'Pascabayar', 'GAS NEGARA', 'Gas Negara', false, 'pasca');
        $this->assertSame('gas', $mPasca['slug']);
    }

    public function test_pascabayar_gas_negara_brand_maps_to_gas(): void
    {
        $svc = app(ProductMappingService::class);
        $m = $svc->map('digiflazz', 'Pascabayar', 'GAS NEGARA', 'Gas Negara', false, 'pasca');
        $this->assertSame('gas', $m['slug']);
        $this->assertContains($m['source'], ['brand_override', 'gas_list_type_pasca']);
    }

    public function test_ewallet_and_voucher_unaffected_by_pln_list_type_guard(): void
    {
        $svc = app(ProductMappingService::class);
        $this->assertSame(
            'topup-digital',
            $svc->map('digiflazz', 'E-Money', 'DANA', 'DANA 50.000', false, 'prepaid')['slug']
        );
        $this->assertSame(
            'voucher-digital',
            $svc->map('digiflazz', 'Voucher', 'Alfamart', 'Alfamart 50rb', false, 'prepaid')['slug']
        );
        $this->assertSame(
            'game',
            $svc->map('digiflazz', 'Games', 'Free Fire', 'Free Fire 70 Diamond', false, 'prepaid')['slug']
        );
        $this->assertSame(
            'data',
            $svc->map('digiflazz', 'Data', 'XL', 'Xtra Combo', false, 'prepaid')['slug']
        );
    }
}
