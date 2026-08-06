<?php

namespace Tests\Unit;

use App\Services\Catalog\IndosatDataTaxonomyService;
use Tests\TestCase;

class IndosatDataTaxonomyServiceTest extends TestCase
{
    public function test_classifies_freedom_internet(): void
    {
        $svc = app(IndosatDataTaxonomyService::class);
        $c = $svc->classify('Indosat Freedom Internet 10GB');
        $this->assertSame('freedom', $c['group']);
    }

    public function test_classifies_freedom_apps_not_freedom(): void
    {
        $svc = app(IndosatDataTaxonomyService::class);
        $c = $svc->classify('Freedom Apps 5GB');
        $this->assertSame('freedom-apps', $c['group']);
    }

    public function test_classifies_gift_before_freedom(): void
    {
        $svc = app(IndosatDataTaxonomyService::class);
        $c = $svc->classify('Freedom Internet Gift 3GB');
        $this->assertSame('gift', $c['group']);
    }

    public function test_classifies_5g_hifi(): void
    {
        $svc = app(IndosatDataTaxonomyService::class);
        $c = $svc->classify('HiFi Air 20GB');
        $this->assertSame('5g', $c['group']);
    }

    public function test_classifies_bisnis_umkm(): void
    {
        $svc = app(IndosatDataTaxonomyService::class);
        $c = $svc->classify('UMKMFreedom 15GB');
        $this->assertSame('bisnis', $c['group']);
    }

    public function test_classifies_roaming_umroh(): void
    {
        $svc = app(IndosatDataTaxonomyService::class);
        $c = $svc->classify('Umroh Haji Internet 10GB');
        $this->assertSame('roaming', $c['group']);
    }

    public function test_detects_indosat_brand(): void
    {
        $svc = app(IndosatDataTaxonomyService::class);
        $this->assertTrue($svc->isIndosatBrand('Indosat'));
        $this->assertTrue($svc->isIndosatBrand('IM3'));
        $this->assertFalse($svc->isIndosatBrand('Telkomsel'));
    }

    public function test_mentions_region(): void
    {
        $svc = app(IndosatDataTaxonomyService::class);
        $this->assertTrue($svc->mentionsRegion('Freedom Internet Jabodetabek 10GB'));
        $this->assertFalse($svc->mentionsRegion('Freedom Internet 10GB'));
    }
}
