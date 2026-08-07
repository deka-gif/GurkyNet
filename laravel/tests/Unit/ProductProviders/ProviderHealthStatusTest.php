<?php

namespace Tests\Unit\ProductProviders;

use App\Services\ProductProviders\ProviderHealthStatus;
use PHPUnit\Framework\TestCase;

class ProviderHealthStatusTest extends TestCase
{
    public function test_balance_fail_alone_is_partial_not_offline(): void
    {
        $result = ProviderHealthStatus::evaluate([
            'configured' => true,
            'connection' => 'ok',
            'authentication' => 'ok',
            'sync' => 'ok',
            'balance' => 'failed',
            'inquiry' => 'ok',
            'success_rate' => 'ok',
            'partner_status' => 'online',
        ]);

        $this->assertSame(ProviderHealthStatus::PARTIAL, $result['api_status']);
        $this->assertSame('yellow', $result['health_color']);
        $this->assertTrue($result['transaction_eligible']);
        $this->assertStringContainsString('balance', strtolower($result['description']));
    }

    public function test_connection_timeout_is_offline(): void
    {
        $result = ProviderHealthStatus::evaluate([
            'configured' => true,
            'connection' => 'timeout',
            'authentication' => 'unknown',
            'sync' => 'ok',
            'balance' => 'failed',
            'partner_status' => 'online',
        ]);

        $this->assertSame(ProviderHealthStatus::OFFLINE, $result['api_status']);
        $this->assertFalse($result['transaction_eligible']);
    }

    public function test_auth_failed_status(): void
    {
        $result = ProviderHealthStatus::evaluate([
            'configured' => true,
            'connection' => 'ok',
            'authentication' => 'failed',
            'sync' => 'ok',
            'balance' => 'failed',
            'partner_status' => 'online',
            'message' => 'Wrong Signature',
        ]);

        $this->assertSame(ProviderHealthStatus::AUTH_FAILED, $result['api_status']);
        $this->assertFalse($result['transaction_eligible']);
        $this->assertSame('Wrong Signature', $result['description']);
    }

    public function test_auth_failed_without_provider_message_is_generic_not_hardcoded_secret(): void
    {
        $result = ProviderHealthStatus::evaluate([
            'configured' => true,
            'connection' => 'ok',
            'authentication' => 'failed',
            'sync' => 'ok',
            'balance' => 'failed',
            'partner_status' => 'online',
        ]);

        $this->assertSame(ProviderHealthStatus::AUTH_FAILED, $result['api_status']);
        $this->assertStringNotContainsString('API Key atau Secret', $result['description']);
    }

    public function test_balance_fail_prefers_provider_message(): void
    {
        $result = ProviderHealthStatus::evaluate([
            'configured' => true,
            'connection' => 'ok',
            'authentication' => 'ok',
            'sync' => 'ok',
            'balance' => 'failed',
            'inquiry' => 'ok',
            'success_rate' => 'ok',
            'partner_status' => 'online',
            'message' => 'Balance unavailable',
        ]);

        $this->assertSame(ProviderHealthStatus::PARTIAL, $result['api_status']);
        $this->assertSame('Balance unavailable', $result['description']);
    }

    public function test_partner_maintenance_overrides_api(): void
    {
        $result = ProviderHealthStatus::evaluate([
            'configured' => true,
            'connection' => 'ok',
            'authentication' => 'ok',
            'sync' => 'ok',
            'balance' => 'ok',
            'partner_status' => 'maintenance',
        ]);

        $this->assertSame(ProviderHealthStatus::MAINTENANCE, $result['api_status']);
        $this->assertSame('orange', $result['health_color']);
        $this->assertFalse($result['transaction_eligible']);
    }

    public function test_all_ok_is_online(): void
    {
        $result = ProviderHealthStatus::evaluate([
            'configured' => true,
            'connection' => 'ok',
            'authentication' => 'ok',
            'sync' => 'ok',
            'balance' => 'ok',
            'inquiry' => 'ok',
            'success_rate' => 'ok',
            'partner_status' => 'online',
        ]);

        $this->assertSame(ProviderHealthStatus::ONLINE, $result['api_status']);
        $this->assertTrue($result['transaction_eligible']);
    }

    public function test_partial_is_transaction_eligible(): void
    {
        $this->assertTrue(ProviderHealthStatus::isTransactionEligible('partial', 'online'));
        $this->assertTrue(ProviderHealthStatus::isTransactionEligible('online', 'online'));
        $this->assertTrue(ProviderHealthStatus::isTransactionEligible('unknown', 'online'));
        $this->assertTrue(ProviderHealthStatus::isTransactionEligible(null, 'online'));
        $this->assertFalse(ProviderHealthStatus::isTransactionEligible('offline', 'online'));
        $this->assertFalse(ProviderHealthStatus::isTransactionEligible('auth_failed', 'online'));
        $this->assertFalse(ProviderHealthStatus::isTransactionEligible('online', 'maintenance'));
    }
}
