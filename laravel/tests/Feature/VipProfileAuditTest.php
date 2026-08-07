<?php

namespace Tests\Feature;

use App\Services\VipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class VipProfileAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'services.vip.username' => 'api-id-test',
            'services.vip.merchant_id' => 'api-id-test',
            'services.vip.api_key' => 'api-key-test',
            'services.vip.signature' => '',
        ]);
    }

    public function test_profile_parses_official_fields_and_keeps_balance_for_health(): void
    {
        Http::fake([
            'vip-reseller.co.id/api/profile' => Http::response([
                'result' => true,
                'data' => [
                    'full_name' => 'Decha Prio Ariesto Sembiring',
                    'username' => 'Dechaprio',
                    'balance' => 7685,
                    'point' => 12,
                    'level' => 'Basic',
                    'registered' => '2026-08-01 14:32:30',
                ],
                'message' => 'Successfully got your account details.',
            ], 200),
        ]);

        $result = app(VipService::class)->profile();

        $this->assertTrue($result['success']);
        $this->assertSame(7685.0, $result['balance']);
        $this->assertSame('Decha Prio Ariesto Sembiring', $result['profile']['full_name']);
        $this->assertSame('Dechaprio', $result['profile']['username']);
        $this->assertSame(12, $result['profile']['point']);
        $this->assertSame('Basic', $result['profile']['level']);
        $this->assertSame('2026-08-01 14:32:30', $result['profile']['registered']);
    }

    public function test_legacy_balance_only_response_still_succeeds(): void
    {
        Http::fake([
            'vip-reseller.co.id/api/profile' => Http::response([
                'result' => true,
                'message' => 'OK',
                'data' => ['balance' => 150000],
            ], 200),
        ]);

        $result = app(VipService::class)->profile();

        $this->assertTrue($result['success']);
        $this->assertSame(150000.0, $result['balance']);
        $this->assertNull($result['profile']['full_name']);
        $this->assertNull($result['profile']['username']);
        $this->assertNull($result['profile']['point']);
        $this->assertNull($result['profile']['level']);
        $this->assertNull($result['profile']['registered']);
        $this->assertSame(150000.0, $result['profile']['balance']);
    }

    public function test_compatibility_saldo_alias_still_feeds_health_balance(): void
    {
        Http::fake([
            'vip-reseller.co.id/api/profile' => Http::response([
                'result' => true,
                'message' => 'OK',
                'data' => ['saldo' => 99000, 'username' => 'legacy'],
            ], 200),
        ]);

        $result = app(VipService::class)->profile();

        $this->assertTrue($result['success']);
        $this->assertSame(99000.0, $result['balance']);
        $this->assertNull($result['profile']['balance']);
        $this->assertSame('legacy', $result['profile']['username']);
    }
}
