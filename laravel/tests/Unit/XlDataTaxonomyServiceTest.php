<?php

namespace Tests\Unit;

use App\Services\Catalog\XlDataTaxonomyService;
use Tests\TestCase;

class XlDataTaxonomyServiceTest extends TestCase
{
    public function test_classifies_paket_akrab(): void
    {
        $svc = app(XlDataTaxonomyService::class);
        $c = $svc->classify('XL Paket Akrab 15GB');
        $this->assertSame('paket-akrab', $c['group']);
    }

    public function test_classifies_xtra_combo_not_murah(): void
    {
        $svc = app(XlDataTaxonomyService::class);
        $c = $svc->classify('Xtra Combo 30GB 30 Hari');
        $this->assertSame('xtra-combo', $c['group']);
    }

    public function test_classifies_murah_bebas_puas(): void
    {
        $svc = app(XlDataTaxonomyService::class);
        $c = $svc->classify('Bebas Puas 5rb');
        $this->assertSame('murah', $c['group']);
    }

    public function test_classifies_kuota_tambahan_games(): void
    {
        $svc = app(XlDataTaxonomyService::class);
        $c = $svc->classify('XL Apps Games 2GB');
        $this->assertSame('kuota-tambahan', $c['group']);
    }

    public function test_classifies_roaming_umroh(): void
    {
        $svc = app(XlDataTaxonomyService::class);
        $c = $svc->classify('Internet Umroh 10GB');
        $this->assertSame('roaming', $c['group']);
    }

    public function test_detects_xl_brand(): void
    {
        $svc = app(XlDataTaxonomyService::class);
        $this->assertTrue($svc->isXlBrand('XL'));
        $this->assertTrue($svc->isXlBrand('XL Axiata'));
        $this->assertFalse($svc->isXlBrand('Telkomsel'));
    }

    public function test_mentions_region(): void
    {
        $svc = app(XlDataTaxonomyService::class);
        $this->assertTrue($svc->mentionsRegion('XL Xtra Combo West 20GB'));
        $this->assertFalse($svc->mentionsRegion('XL Xtra Combo 20GB'));
    }
}
