<?php

namespace Tests\Unit;

use App\Services\ProductProviders\VipProfilePayload;
use PHPUnit\Framework\TestCase;

class VipProfilePayloadTest extends TestCase
{
    public function test_parses_official_profile_fields(): void
    {
        $profile = VipProfilePayload::fromResponse([
            'result' => true,
            'data' => [
                'full_name' => 'Decha Prio Ariesto Sembiring',
                'username' => 'Dechaprio',
                'balance' => 7685,
                'point' => 0,
                'level' => 'Basic',
                'registered' => '2026-08-01 14:32:30',
            ],
            'message' => 'Successfully got your account details.',
        ]);

        $this->assertSame('Decha Prio Ariesto Sembiring', $profile['full_name']);
        $this->assertSame('Dechaprio', $profile['username']);
        $this->assertSame(7685.0, $profile['balance']);
        $this->assertSame(0, $profile['point']);
        $this->assertSame('Basic', $profile['level']);
        $this->assertSame('2026-08-01 14:32:30', $profile['registered']);
    }

    public function test_missing_optional_fields_are_nullable(): void
    {
        $profile = VipProfilePayload::fromResponse([
            'result' => true,
            'data' => [
                'balance' => 150000,
                'username' => 'demo',
            ],
            'message' => 'OK',
        ]);

        $this->assertNull($profile['full_name']);
        $this->assertSame('demo', $profile['username']);
        $this->assertSame(150000.0, $profile['balance']);
        $this->assertNull($profile['point']);
        $this->assertNull($profile['level']);
        $this->assertNull($profile['registered']);
    }

    public function test_empty_when_data_missing(): void
    {
        $profile = VipProfilePayload::fromResponse([
            'result' => false,
            'message' => 'Invalid API Key',
        ]);

        $this->assertNull($profile['full_name']);
        $this->assertNull($profile['username']);
        $this->assertNull($profile['balance']);
        $this->assertNull($profile['point']);
        $this->assertNull($profile['level']);
        $this->assertNull($profile['registered']);
    }
}
