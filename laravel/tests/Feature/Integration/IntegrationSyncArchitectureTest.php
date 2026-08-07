<?php

namespace Tests\Feature\Integration;

use App\Enums\UserRole;
use App\Models\ProductProvider;
use App\Models\User;
use App\Services\Integration\IntegrationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IntegrationSyncArchitectureTest extends TestCase
{
    use RefreshDatabase;

    protected function makeOwner(): User
    {
        return User::create([
            'name' => 'Owner',
            'email' => 'own-int-'.uniqid().'@gurkypay.com',
            'phone_number' => '081'.random_int(100000000, 999999999),
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    public function test_integration_policy_forbids_dashboard_provider_calls(): void
    {
        $policy = app(IntegrationService::class)->policy();
        $this->assertFalse($policy['dashboard_may_call_provider']);
        $this->assertFalse($policy['owner_may_call_provider']);
        $this->assertSame(600, $policy['balance_ttl_seconds']);
        $this->assertSame(60, $policy['health_ttl_seconds']);
    }

    public function test_balance_sync_is_rate_limited(): void
    {
        Cache::flush();
        $provider = ProductProvider::query()->firstOrCreate(
            ['code' => 'digiflazz'],
            [
                'name' => 'Digiflazz',
                'is_active' => true,
                'partner_status' => 'online',
                'sort_order' => 1,
                'priority' => 1,
            ]
        );
        $provider->forceFill(['balance' => 1_000_000, 'partner_status' => 'online'])->save();

        $svc = app(IntegrationService::class);
        // First call acquires throttle (may skip actual remote if adapter fails — still marks synced or skipped)
        $first = $svc->syncBalances(false);
        $second = $svc->syncBalances(false);

        $this->assertTrue($second['skipped'] ?? false);
        $this->assertArrayHasKey('rows', $second);
    }

    public function test_owner_dashboard_reads_balance_from_database_not_live_cache_key(): void
    {
        $provider = ProductProvider::query()->firstOrCreate(
            ['code' => 'digiflazz'],
            [
                'name' => 'Digiflazz',
                'is_active' => true,
                'partner_status' => 'online',
                'sort_order' => 1,
                'priority' => 1,
            ]
        );
        $provider->forceFill(['balance' => 4_200_000, 'partner_status' => 'online'])->save();

        $owner = $this->makeOwner();
        Sanctum::actingAs($owner);

        // Poison old live-cache key — dashboard must ignore it
        Cache::put('digiflazz_balance', 999.0, 60);

        $data = $this->getJson('/api/v1/admin/executive/dashboard')->assertOk()->json('data');
        $this->assertSame(4200000.0, (float) ($data['digiflazz_balance'] ?? 0));
    }

    public function test_scheduler_commands_are_registered(): void
    {
        $this->assertSame(0, Artisan::call('integration:sync-balances'));
        $this->assertSame(0, Artisan::call('integration:health-probe'));
        $this->assertSame(0, Artisan::call('integration:payment-status'));
        $this->assertSame(0, Artisan::call('integration:retry-failed'));
    }

    public function test_public_provider_status_uses_database_source(): void
    {
        $provider = ProductProvider::query()->firstOrCreate(
            ['code' => 'digiflazz'],
            [
                'name' => 'Digiflazz',
                'is_active' => true,
                'partner_status' => 'online',
                'sort_order' => 1,
                'priority' => 1,
            ]
        );
        $provider->forceFill(['balance' => 500_000, 'partner_status' => 'online', 'is_active' => true])->save();

        $data = $this->getJson('/api/v1/public/provider-status')->assertOk()->json('data');
        $this->assertSame('database', $data['source'] ?? null);
    }
}
