<?php

namespace Tests\Unit;

use App\Services\Catalog\TriDataTaxonomyService;
use Tests\TestCase;

class TriDataTaxonomyServiceTest extends TestCase
{
    public function test_classifies_alwayson(): void
    {
        $svc = app(TriDataTaxonomyService::class);
        $c = $svc->classify('Tri AlwaysOn 10GB');
        $this->assertSame('alwayson', $c['group']);
    }

    public function test_classifies_happy_play_as_hiburan(): void
    {
        $svc = app(TriDataTaxonomyService::class);
        $c = $svc->classify('Happy Play 5GB');
        $this->assertSame('hiburan', $c['group']);
    }

    public function test_classifies_unlimited_sosmed(): void
    {
        $svc = app(TriDataTaxonomyService::class);
        $c = $svc->classify('Unlimited Sosmed 30 Hari');
        $this->assertSame('unlimited', $c['group']);
    }

    public function test_classifies_pure_as_harian(): void
    {
        $svc = app(TriDataTaxonomyService::class);
        $c = $svc->classify('Pure 7 Hari 2GB');
        $this->assertSame('paket-harian', $c['group']);
    }

    public function test_classifies_khusus_ojol(): void
    {
        $svc = app(TriDataTaxonomyService::class);
        $c = $svc->classify('Sahabat Ojol 3GB');
        $this->assertSame('khusus', $c['group']);
    }

    public function test_classifies_roaming_travel(): void
    {
        $svc = app(TriDataTaxonomyService::class);
        $c = $svc->classify('Happy Travel Roaming');
        $this->assertSame('roaming', $c['group']);
    }

    public function test_detects_tri_brand(): void
    {
        $svc = app(TriDataTaxonomyService::class);
        $this->assertTrue($svc->isTriBrand('TRI'));
        $this->assertTrue($svc->isTriBrand('Tri'));
        $this->assertTrue($svc->isTriBrand('3'));
        $this->assertFalse($svc->isTriBrand('Telkomsel'));
    }

    public function test_mentions_region(): void
    {
        $svc = app(TriDataTaxonomyService::class);
        $this->assertTrue($svc->mentionsRegion('AlwaysOn Jakarta Raya 5GB'));
        $this->assertFalse($svc->mentionsRegion('AlwaysOn 5GB'));
    }
}
