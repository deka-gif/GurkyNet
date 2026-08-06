<?php

namespace Tests\Unit;

use App\Services\Catalog\AxisDataTaxonomyService;
use Tests\TestCase;

class AxisDataTaxonomyServiceTest extends TestCase
{
    public function test_classifies_bronet(): void
    {
        $svc = app(AxisDataTaxonomyService::class);
        $c = $svc->classify('AXIS Bronet 10GB');
        $this->assertSame('favorit', $c['group']);
    }

    public function test_classifies_bronet_sosmed_as_aplikasi(): void
    {
        $svc = app(AxisDataTaxonomyService::class);
        $c = $svc->classify('Bronet Sosmed 3GB');
        $this->assertSame('aplikasi', $c['group']);
    }

    public function test_classifies_warnet(): void
    {
        $svc = app(AxisDataTaxonomyService::class);
        $c = $svc->classify('Paket Warnet 1 Hari');
        $this->assertSame('warnet', $c['group']);
    }

    public function test_classifies_hiburan_viu(): void
    {
        $svc = app(AxisDataTaxonomyService::class);
        $c = $svc->classify('AXIS Viu 2GB');
        $this->assertSame('hiburan', $c['group']);
    }

    public function test_classifies_produktivitas_obor(): void
    {
        $svc = app(AxisDataTaxonomyService::class);
        $c = $svc->classify('Obor 5GB');
        $this->assertSame('produktivitas', $c['group']);
    }

    public function test_classifies_umroh_mabrur(): void
    {
        $svc = app(AxisDataTaxonomyService::class);
        $c = $svc->classify('Combo Mabrur 10GB');
        $this->assertSame('umroh', $c['group']);
    }

    public function test_detects_axis_brand(): void
    {
        $svc = app(AxisDataTaxonomyService::class);
        $this->assertTrue($svc->isAxisBrand('AXIS'));
        $this->assertTrue($svc->isAxisBrand('Axis'));
        $this->assertFalse($svc->isAxisBrand('XL'));
    }

    public function test_mentions_region(): void
    {
        $svc = app(AxisDataTaxonomyService::class);
        $this->assertTrue($svc->mentionsRegion('Bronet Jawa Timur 5GB'));
        $this->assertFalse($svc->mentionsRegion('Bronet 5GB'));
    }
}
