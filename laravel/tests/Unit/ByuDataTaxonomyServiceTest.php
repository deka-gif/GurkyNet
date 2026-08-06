<?php

namespace Tests\Unit;

use App\Services\Catalog\ByuDataTaxonomyService;
use Tests\TestCase;

class ByuDataTaxonomyServiceTest extends TestCase
{
    public function test_classifies_nagih_favorit(): void
    {
        $svc = app(ByuDataTaxonomyService::class);
        $c = $svc->classify('by.U Yang Bikin Nagih 10GB');
        $this->assertSame('favorit', $c['group']);
    }

    public function test_classifies_super_kaget(): void
    {
        $svc = app(ByuDataTaxonomyService::class);
        $c = $svc->classify('Super Kaget 5GB');
        $this->assertSame('favorit', $c['group']);
    }

    public function test_classifies_mbps_unlimited(): void
    {
        $svc = app(ByuDataTaxonomyService::class);
        $c = $svc->classify('by.U Unlimited 2 Mbps');
        $this->assertSame('unlimited', $c['group']);
    }

    public function test_classifies_topping_ggwp(): void
    {
        $svc = app(ByuDataTaxonomyService::class);
        $c = $svc->classify('GGWP Topping 2GB');
        $this->assertSame('topping', $c['group']);
    }

    public function test_classifies_jajan(): void
    {
        $svc = app(ByuDataTaxonomyService::class);
        $c = $svc->classify('by.U Jajan 1GB');
        $this->assertSame('jajan', $c['group']);
    }

    public function test_classifies_roam_space(): void
    {
        $svc = app(ByuDataTaxonomyService::class);
        $c = $svc->classify('Roam Space Asia');
        $this->assertSame('roaming', $c['group']);
    }

    public function test_detects_byu_brand(): void
    {
        $svc = app(ByuDataTaxonomyService::class);
        $this->assertTrue($svc->isByuBrand('by.U'));
        $this->assertTrue($svc->isByuBrand('BYU'));
        $this->assertFalse($svc->isByuBrand('Telkomsel'));
    }

    public function test_national_no_region(): void
    {
        $svc = app(ByuDataTaxonomyService::class);
        $this->assertFalse($svc->mentionsRegion('Yang Bikin Nagih 10GB'));
        $this->assertSame([], $svc->regionOptions());
    }
}
