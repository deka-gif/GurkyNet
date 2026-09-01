<?php

namespace Tests\Unit;

use App\Services\Catalog\TelecomOperatorBrandResolver;
use Tests\TestCase;

class TelecomOperatorBrandResolverTest extends TestCase
{
    public function test_canonicalizes_smart_to_smartfren(): void
    {
        $resolver = app(TelecomOperatorBrandResolver::class);
        $this->assertSame('Smartfren', $resolver->resolve('SMART'));
        $this->assertSame('Smartfren', $resolver->resolve('Smartfren'));
    }

    public function test_does_not_merge_xl_and_axis(): void
    {
        $resolver = app(TelecomOperatorBrandResolver::class);
        $this->assertSame('XL', $resolver->resolve('XL'));
        $this->assertSame('AXIS', $resolver->resolve('AXIS'));
        $this->assertNotSame($resolver->resolve('XL'), $resolver->resolve('AXIS'));
    }

    public function test_applies_only_to_telecom_categories(): void
    {
        $resolver = app(TelecomOperatorBrandResolver::class);
        $this->assertTrue($resolver->appliesToCategory('pulsa'));
        $this->assertFalse($resolver->appliesToCategory('game'));
    }
}
