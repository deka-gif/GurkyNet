<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Models\User;
use App\Services\ProductProviders\ProductCatalogCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationsProviderPartnerTest extends TestCase
{
    use RefreshDatabase;

    protected User $ops;
    protected ProductProvider $digi;
    protected ProductProvider $vip;
    protected ProductCategory $pulsa;
    protected ProductCategory $game;
    protected Product $digiPulsa;
    protected Product $vipGame;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ops = User::create([
            'name' => 'Ops Partner',
            'email' => 'ops-partner@gurkypay.com',
            'phone_number' => '081288800001',
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
            'api_status' => 'online',
            'health_color' => 'green',
        ]);
        $this->vip->update([
            'is_active' => true,
            'partner_status' => 'online',
            'api_status' => 'online',
            'health_color' => 'green',
        ]);

        $this->pulsa = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa', 'icon' => 'phone', 'is_active' => true]);
        $this->game = ProductCategory::create(['name' => 'Game', 'slug' => 'game', 'icon' => 'game', 'is_active' => true]);
        $brand = Provider::create(['name' => 'Telkomsel', 'logo' => 't.png', 'is_active' => true]);
        $ml = Provider::create(['name' => 'Mobile Legends', 'logo' => 'm.png', 'is_active' => true]);

        $this->digiPulsa = Product::create([
            'product_category_id' => $this->pulsa->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'TSEL10-P',
            'name' => 'Telkomsel 10rb',
            'base_price' => 10000,
            'sell_price' => 11500,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $this->digiPulsa->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'TSEL10-P',
            'base_price' => 10000,
            'is_active' => true,
        ]);

        $this->vipGame = Product::create([
            'product_category_id' => $this->game->id,
            'provider_id' => $ml->id,
            'product_provider_id' => $this->vip->id,
            'sku_code' => 'VIP-ML86',
            'name' => 'ML 86 Diamonds',
            'base_price' => 20000,
            'sell_price' => 22000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $this->vipGame->id,
            'product_provider_id' => $this->vip->id,
            'provider_sku' => 'VIP-ML86',
            'base_price' => 20000,
            'is_active' => true,
        ]);

        $this->digi->update(['product_count' => 1]);
        $this->vip->update(['product_count' => 1]);
        ProductCatalogCache::bump();
    }

    public function test_lists_real_partners_including_digiflazz_vip_without_midtrans(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson('/api/v1/admin/operations/providers?per_page=50');
        $res->assertOk();

        $codes = collect($res->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all();
        $this->assertContains('digiflazz', $codes);
        $this->assertContains('vip', $codes);
        $this->assertNotContains('midtrans', $codes);
    }

    public function test_status_filter_online_maintenance_offline(): void
    {
        Sanctum::actingAs($this->ops);

        $this->vip->update(['partner_status' => 'maintenance', 'is_active' => true, 'api_status' => 'online']);
        $this->digi->update(['partner_status' => 'offline', 'is_active' => false, 'api_status' => 'offline']);

        $maint = $this->getJson('/api/v1/admin/operations/providers?status=Maintenance&per_page=50');
        $maint->assertOk();
        $this->assertContains('vip', collect($maint->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all());
        $this->assertNotContains('digiflazz', collect($maint->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all());

        $offline = $this->getJson('/api/v1/admin/operations/providers?status=Offline&per_page=50');
        $offline->assertOk();
        $this->assertContains('digiflazz', collect($offline->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all());
    }

    public function test_supported_service_filter_game(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson('/api/v1/admin/operations/providers?supported_service=game&per_page=50');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all();
        $this->assertContains('vip', $codes);
        $this->assertNotContains('digiflazz', $codes);
    }

    public function test_search_by_name_and_service(): void
    {
        Sanctum::actingAs($this->ops);

        $byName = $this->getJson('/api/v1/admin/operations/providers?search=Digiflazz&per_page=50');
        $byName->assertOk();
        $this->assertContains('digiflazz', collect($byName->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all());

        $byService = $this->getJson('/api/v1/admin/operations/providers?search=Game&per_page=50');
        $byService->assertOk();
        $this->assertContains('vip', collect($byService->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all());
    }

    public function test_combined_filters(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson('/api/v1/admin/operations/providers?status=online&supported_service=game&search=VIP&per_page=50');
        $res->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all();
        $this->assertSame(['vip'], $codes);
        $this->assertSame(1, $res->json('meta.pagination.total'));
    }

    public function test_digiflazz_maintenance_marks_products_maintenance_vip_still_sellable(): void
    {
        Sanctum::actingAs($this->ops);

        $this->postJson('/api/v1/admin/operations/product-provider-control/'.$this->digi->id.'/maintenance')
            ->assertOk();

        ProductCatalogCache::bump();

        $catalog = $this->getJson('/api/v1/products?per_page=100');
        $catalog->assertOk();
        $rows = collect($catalog->json('data'));

        $digiRow = $rows->firstWhere('code', 'TSEL10-P');
        $this->assertNotNull($digiRow);
        $this->assertSame('maintenance', $digiRow['availabilityStatus']);
        $this->assertFalse($digiRow['isPurchasable']);

        $vipRow = $rows->firstWhere('code', 'VIP-ML86');
        $this->assertNotNull($vipRow);
        $this->assertSame('active', $vipRow['availabilityStatus']);
        $this->assertTrue($vipRow['isPurchasable']);
    }

    public function test_provider_offline_hides_products_from_user_catalog(): void
    {
        Sanctum::actingAs($this->ops);

        $this->postJson('/api/v1/admin/operations/product-provider-control/'.$this->digi->id.'/disable')
            ->assertOk();

        ProductCatalogCache::bump();

        $catalog = $this->getJson('/api/v1/products?per_page=100');
        $catalog->assertOk();
        $codes = collect($catalog->json('data'))->pluck('code')->all();
        $this->assertNotContains('TSEL10-P', $codes);
        $this->assertContains('VIP-ML86', $codes);
    }

    public function test_provider_management_update_is_rejected(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->putJson('/api/v1/admin/operations/providers/'.$this->digi->id, [
            'status' => 'offline',
        ]);
        $this->assertContains($res->status(), [400, 422]);
        $this->assertFalse((bool) $res->json('success'));
    }

    public function test_refresh_status_endpoint_runs_backend_probe(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->postJson('/api/v1/admin/operations/providers/refresh-status');
        $res->assertOk()
            ->assertJsonPath('success', true);
        $this->assertGreaterThanOrEqual(2, (int) $res->json('data.updated_count'));
    }
}
