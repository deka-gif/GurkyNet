<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\Provider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationsServiceMonitoringTest extends TestCase
{
    use RefreshDatabase;

    protected User $ops;
    protected ProductProvider $digi;
    protected ProductProvider $vip;
    protected ProductCategory $dataCategory;
    protected Provider $brand;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ops = User::create([
            'name' => 'Ops NOC',
            'email' => 'ops-noc@gurkypay.com',
            'phone_number' => '081288800099',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->digi = ProductProvider::digiflazz();
        $this->vip = ProductProvider::vip();
        $this->assertNotNull($this->digi);
        $this->assertNotNull($this->vip);

        $this->digi->update([
            'is_active' => true,
            'partner_status' => 'online',
            'avg_response_ms' => 185,
            'success_rate' => 99.91,
            'last_sync_at' => now(),
            'last_health_check_at' => now(),
        ]);
        $this->vip->update([
            'is_active' => true,
            'partner_status' => 'online',
            'avg_response_ms' => 210,
            'success_rate' => 99.5,
            'last_sync_at' => now(),
            'last_health_check_at' => now(),
        ]);

        $this->dataCategory = ProductCategory::create([
            'name' => 'Paket Data',
            'slug' => 'data',
            'icon' => 'wifi',
            'is_active' => true,
        ]);
        $this->brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);
    }

    protected function makeSku(string $sku, string $name, string $ops, ?ProductProvider $provider = null): Product
    {
        return Product::create([
            'product_category_id' => $this->dataCategory->id,
            'provider_id' => $this->brand->id,
            'product_provider_id' => ($provider ?? $this->digi)->id,
            'sku_code' => $sku,
            'name' => $name,
            'base_price' => 10000,
            'sell_price' => 12000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => $ops,
        ]);
    }

    public function test_monitoring_returns_service_cards_not_sku_dump(): void
    {
        $this->makeSku('DATA-1', 'Data 1GB', 'active');
        $this->makeSku('DATA-2', 'Data 2GB', 'active');
        $this->makeSku('DATA-3', 'Data 3GB', 'maintenance');

        Sanctum::actingAs($this->ops);
        $res = $this->getJson('/api/v1/admin/operations/monitoring');
        $res->assertOk();

        $services = collect($res->json('data.services'));
        $this->assertTrue($services->contains(fn ($s) => ($s['key'] ?? '') === 'data'));
        $this->assertTrue($services->contains(fn ($s) => ($s['key'] ?? '') === 'wallet'));

        // Must not dump individual SKUs at overview level
        $names = $services->pluck('name')->implode(' ');
        $this->assertStringNotContainsString('Data 1GB', $names);

        $data = $services->firstWhere('key', 'data');
        $this->assertSame('Partial', $data['status']);
        $this->assertSame(3, $data['totalSku']);
        $this->assertSame(2, $data['onlineSku']);
        $this->assertSame(1, $data['maintenanceSku']);
        $this->assertSame(0, $data['offlineSku']);
        $this->assertContains('Digiflazz', $data['providerNames'] ?? $data['providers'] ?? []);
    }

    public function test_service_becomes_online_when_all_skus_healthy(): void
    {
        $this->makeSku('DATA-OK-1', 'Data OK 1', 'active');
        $this->makeSku('DATA-OK-2', 'Data OK 2', 'active', $this->vip);

        Sanctum::actingAs($this->ops);
        $res = $this->getJson('/api/v1/admin/operations/monitoring?status=Online');
        $res->assertOk();

        $data = collect($res->json('data.services'))->firstWhere('key', 'data');
        $this->assertNotNull($data);
        $this->assertSame('Online', $data['status']);
        $this->assertSame(2, $data['onlineSku']);
    }

    public function test_provider_maintenance_marks_related_skus_and_service(): void
    {
        $this->makeSku('DATA-A', 'Data A', 'active');
        $this->makeSku('DATA-B', 'Data B', 'active');
        $this->digi->update(['partner_status' => 'maintenance']);

        Sanctum::actingAs($this->ops);
        $res = $this->getJson('/api/v1/admin/operations/monitoring?search=Paket');
        $res->assertOk();

        $data = collect($res->json('data.services'))->firstWhere('key', 'data');
        $this->assertNotNull($data);
        $this->assertSame('Maintenance', $data['status']);
        $this->assertSame(2, $data['maintenanceSku']);
        $this->assertSame(0, $data['onlineSku']);
    }

    public function test_service_detail_and_issues_only_show_problematic_skus(): void
    {
        $this->makeSku('DATA-OK', 'Internet Sakti 10GB', 'active');
        $this->makeSku('DATA-M', 'Internet Sakti 25GB', 'maintenance');
        $this->makeSku('DATA-OFF', 'Internet Sakti 50GB', 'inactive');

        Sanctum::actingAs($this->ops);

        $detail = $this->getJson('/api/v1/admin/operations/monitoring/services/data');
        $detail->assertOk();
        $this->assertSame('Partial', $detail->json('data.status'));
        $this->assertSame(3, $detail->json('data.totalSku'));
        $this->assertNotEmpty($detail->json('data.providers'));

        $issues = $this->getJson('/api/v1/admin/operations/monitoring/services/data/issues');
        $issues->assertOk();
        $rows = collect($issues->json('data.data'));
        $this->assertCount(2, $rows);
        $this->assertFalse($rows->contains(fn ($r) => str_contains((string) $r['name'], '10GB')));
        $this->assertTrue($rows->contains(fn ($r) => $r['status'] === 'Maintenance'));
        $this->assertTrue($rows->contains(fn ($r) => $r['status'] === 'Offline'));
    }

    public function test_backend_status_filter_and_search(): void
    {
        $this->makeSku('DATA-X', 'Data X', 'inactive');

        Sanctum::actingAs($this->ops);
        $res = $this->getJson('/api/v1/admin/operations/monitoring?status=Offline&search=data');
        $res->assertOk();

        $services = collect($res->json('data.services'));
        $this->assertTrue($services->every(fn ($s) => strtolower((string) $s['status']) === 'offline'));
        $this->assertTrue($services->contains(fn ($s) => ($s['key'] ?? '') === 'data'));
    }

    public function test_refresh_endpoint_returns_overview(): void
    {
        $this->makeSku('DATA-R', 'Data R', 'active');

        Sanctum::actingAs($this->ops);
        $res = $this->postJson('/api/v1/admin/operations/monitoring/refresh');
        $res->assertOk();
        $this->assertArrayHasKey('services', $res->json('data'));
        $this->assertArrayHasKey('summary', $res->json('data'));
    }
}
