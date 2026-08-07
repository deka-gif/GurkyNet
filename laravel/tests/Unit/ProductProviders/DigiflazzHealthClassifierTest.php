<?php

namespace Tests\Unit\ProductProviders;

use App\Services\ProductProviders\DigiflazzHealthClassifier;
use App\Services\ProductProviders\ProviderHealthStatus;
use PHPUnit\Framework\TestCase;

class DigiflazzHealthClassifierTest extends TestCase
{
    public function test_rc_mapping_table(): void
    {
        $this->assertSame(ProviderHealthStatus::CONFIG_ERROR, DigiflazzHealthClassifier::statusForRc('40'));
        $this->assertSame(ProviderHealthStatus::AUTH_FAILED, DigiflazzHealthClassifier::statusForRc('41'));
        $this->assertSame(ProviderHealthStatus::AUTH_FAILED, DigiflazzHealthClassifier::statusForRc('42'));
        $this->assertSame(ProviderHealthStatus::NETWORK_CONFIGURATION, DigiflazzHealthClassifier::statusForRc('45'));
        $this->assertNull(DigiflazzHealthClassifier::statusForRc('00'));
        $this->assertNull(DigiflazzHealthClassifier::statusForRc(null));
    }

    public function test_rc_42_wins_over_deposit(): void
    {
        $result = DigiflazzHealthClassifier::classify([
            'http_status' => 400,
            'body' => [
                'data' => [
                    'rc' => 42,
                    'message' => 'Gagal memproses API Buyer',
                    'deposit' => 999999,
                ],
            ],
            'latency_ms' => 83,
            'connection_error' => false,
            'error_message' => null,
        ]);

        $this->assertSame(ProviderHealthStatus::AUTH_FAILED, $result['status']);
        $this->assertSame('failed', $result['authentication']);
        $this->assertSame('unknown', $result['balance']);
        $this->assertSame('42', $result['provider_code']);
        $this->assertSame('Gagal memproses API Buyer', $result['provider_message']);
        $this->assertNull($result['balance_value']);
    }

    public function test_message_alone_does_not_force_auth_failed(): void
    {
        $result = DigiflazzHealthClassifier::classify([
            'http_status' => 200,
            'body' => [
                'data' => [
                    'message' => 'Wrong Signature without rc',
                ],
            ],
            'latency_ms' => 50,
            'connection_error' => false,
            'error_message' => null,
        ]);

        $this->assertSame(ProviderHealthStatus::PARTIAL, $result['status']);
        $this->assertSame('ok', $result['authentication']);
    }
}
