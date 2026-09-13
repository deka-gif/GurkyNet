<?php

namespace Tests\Unit;

use App\Services\Catalog\VoucherInternetTembakOperatorGuard;
use Tests\TestCase;

class VoucherInternetTembakOperatorGuardTest extends TestCase
{
    public function test_detects_all_seven_operators_from_prefix(): void
    {
        $guard = app(VoucherInternetTembakOperatorGuard::class);

        $this->assertSame('telkomsel', $guard->detectOperatorKeyFromPhone('081234567890'));
        $this->assertSame('indosat', $guard->detectOperatorKeyFromPhone('081512345678'));
        $this->assertSame('xl', $guard->detectOperatorKeyFromPhone('081812345678'));
        $this->assertSame('tri', $guard->detectOperatorKeyFromPhone('089512345678'));
        $this->assertSame('axis', $guard->detectOperatorKeyFromPhone('083812345678'));
        $this->assertSame('smartfren', $guard->detectOperatorKeyFromPhone('088812345678'));
        $this->assertSame('byu', $guard->detectOperatorKeyFromPhone('085112345678'));
        $this->assertSame('xl', $guard->detectOperatorKeyFromPhone('+6281812345678'));
        $this->assertNull($guard->detectOperatorKeyFromPhone('080012345678'));
    }

    public function test_normalizes_client_and_catalog_brand_labels(): void
    {
        $guard = app(VoucherInternetTembakOperatorGuard::class);

        $this->assertSame('telkomsel', $guard->normalizeOperatorKey('Telkomsel'));
        $this->assertSame('xl', $guard->normalizeOperatorKey('XL Axiata'));
        $this->assertSame('xl', $guard->normalizeOperatorKey('XL'));
        $this->assertSame('tri', $guard->normalizeOperatorKey('Tri (3)'));
        $this->assertSame('tri', $guard->normalizeOperatorKey('Tri'));
        $this->assertSame('axis', $guard->normalizeOperatorKey('AXIS'));
        $this->assertSame('byu', $guard->normalizeOperatorKey('by.U'));
        $this->assertSame('smartfren', $guard->normalizeOperatorKey('Smartfren'));
        $this->assertSame('indosat', $guard->normalizeOperatorKey('IM3'));
    }
}
