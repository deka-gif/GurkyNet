<?php

namespace Tests\Unit;

use App\Support\WilayahMatcher;
use PHPUnit\Framework\TestCase;

class WilayahMatcherTest extends TestCase
{
    public function test_resolves_known_cities(): void
    {
        $this->assertSame('Jawa Barat', WilayahMatcher::resolveProvince('Kota Cimahi'));
        $this->assertSame('Jawa Timur', WilayahMatcher::resolveProvince('PBB Surabaya'));
        $this->assertSame('Bali', WilayahMatcher::resolveProvince('SAMSAT Denpasar'));
        $this->assertSame('DKI Jakarta', WilayahMatcher::resolveProvince('Jakarta Selatan'));
    }

    public function test_city_label_strips_service_words(): void
    {
        $label = WilayahMatcher::cityLabel('PBB Kota Bandung', 'Kota Bandung');
        $this->assertStringContainsString('Bandung', $label);
        $this->assertStringNotContainsString('PBB', strtoupper($label));
    }
}
