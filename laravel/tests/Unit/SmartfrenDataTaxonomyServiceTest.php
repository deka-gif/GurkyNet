<?php

namespace Tests\Unit;

use App\Services\Catalog\SmartfrenDataTaxonomyService;
use Tests\TestCase;

class SmartfrenDataTaxonomyServiceTest extends TestCase
{
    public function test_classifies_unlimited_nonstop(): void
    {
        $svc = app(SmartfrenDataTaxonomyService::class);
        $c = $svc->classify('Smartfren Unlimited Nonstop 5G');
        $this->assertSame('unlimited', $c['group']);
    }

    public function test_classifies_aplikasi_tiktok(): void
    {
        $svc = app(SmartfrenDataTaxonomyService::class);
        $c = $svc->classify('Smartfren TikTok 2GB');
        $this->assertSame('aplikasi', $c['group']);
    }

    public function test_classifies_hiburan_klikfilm(): void
    {
        $svc = app(SmartfrenDataTaxonomyService::class);
        $c = $svc->classify('KlikFilm 5GB');
        $this->assertSame('hiburan', $c['group']);
    }

    public function test_classifies_router_connex(): void
    {
        $svc = app(SmartfrenDataTaxonomyService::class);
        $c = $svc->classify('Connex Evo 50GB');
        $this->assertSame('router', $c['group']);
    }

    public function test_classifies_gokil_max_favorit_family(): void
    {
        $svc = app(SmartfrenDataTaxonomyService::class);
        $c = $svc->classify('Gokil Max 20GB');
        $this->assertSame('favorit', $c['group']);
    }

    public function test_classifies_roaming(): void
    {
        $svc = app(SmartfrenDataTaxonomyService::class);
        $c = $svc->classify('Smartfren Roaming Asia');
        $this->assertSame('roaming', $c['group']);
    }

    public function test_detects_smartfren_brand(): void
    {
        $svc = app(SmartfrenDataTaxonomyService::class);
        $this->assertTrue($svc->isSmartfrenBrand('Smartfren'));
        $this->assertTrue($svc->isSmartfrenBrand('SMART'));
        $this->assertFalse($svc->isSmartfrenBrand('Telkomsel'));
    }

    public function test_national_packs_do_not_require_region(): void
    {
        $svc = app(SmartfrenDataTaxonomyService::class);
        $this->assertFalse($svc->mentionsRegion('Unlimited Nonstop 30 Hari'));
        $this->assertSame([], $svc->regionOptions());
    }
}
