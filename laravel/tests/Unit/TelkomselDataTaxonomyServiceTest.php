<?php

namespace Tests\Unit;

use App\Services\Catalog\TelkomselDataTaxonomyService;
use Tests\TestCase;

class TelkomselDataTaxonomyServiceTest extends TestCase
{
    public function test_classifies_internet_sakti(): void
    {
        $svc = app(TelkomselDataTaxonomyService::class);
        $c = $svc->classify('Telkomsel Internet Sakti 10GB 30 Hari');
        $this->assertSame('internet-sakti', $c['group']);
    }

    public function test_classifies_combo_sakti_not_internet(): void
    {
        $svc = app(TelkomselDataTaxonomyService::class);
        $c = $svc->classify('Combo Sakti 12GB');
        $this->assertSame('combo-sakti', $c['group']);
    }

    public function test_parses_quota_and_validity(): void
    {
        $svc = app(TelkomselDataTaxonomyService::class);
        $meta = $svc->parseMeta('Internet Sakti 20GB 30 Hari');
        $this->assertSame('20 GB', $meta['quota']);
        $this->assertSame('30 Hari', $meta['validity']);
    }

    public function test_detects_telkomsel_brand(): void
    {
        $svc = app(TelkomselDataTaxonomyService::class);
        $this->assertTrue($svc->isTelkomselBrand('Telkomsel'));
        $this->assertFalse($svc->isTelkomselBrand('XL'));
    }
}
