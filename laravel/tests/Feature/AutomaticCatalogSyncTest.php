<?php

namespace Tests\Feature;

use App\Actions\Admin\Operations\RunAutomaticCatalogSyncAction;
use App\Models\ActivityLog;
use App\Models\ProductProvider;
use App\Models\Setting;
use App\Models\User;
use App\Enums\UserRole;
use App\Services\ProductProviders\AutomaticCatalogSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AutomaticCatalogSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory);

        config([
            'services.digiflazz.username' => 'buyer-user',
            'services.digiflazz.api_key' => 'buyer-key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
            'services.vip.merchant_id' => 'vip-merchant',
            'services.vip.api_key' => 'vip-key',
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'ppob.catalog_auto_sync.enabled' => true,
            'ppob.catalog_auto_sync.daily_at' => '23:59',
            'ppob.catalog_auto_sync.timezone' => 'Asia/Jakarta',
            'ppob.catalog_auto_sync.digiflazz_cooldown_minutes' => 5,
            'ppob.catalog_auto_sync.retry_delay_seconds' => 1,
            'ppob.catalog_auto_sync.max_retries' => 1,
        ]);

        Setting::updateOrCreate(['key' => 'default_margin'], ['value' => '1000']);
        Cache::forget(AutomaticCatalogSyncService::LOCK_KEY);

        $this->assertNotNull(ProductProvider::digiflazz());
        $this->assertNotNull(ProductProvider::vip());
    }

    protected function fakeProviderCatalogs(): void
    {
        Http::fake([
            'api.digiflazz.com/v1/price-list' => function ($request) {
                $cmd = $request->data()['cmd'] ?? 'prepaid';
                if ($cmd === 'pasca') {
                    return Http::response([
                        'data' => [[
                            'product_name' => 'PLN Pasca',
                            'category' => 'Pascabayar',
                            'brand' => 'PLN',
                            'admin' => 2500,
                            'commission' => 1000,
                            'buyer_sku_code' => 'pln',
                            'buyer_product_status' => true,
                            'seller_product_status' => true,
                            'desc' => 'pln',
                        ]],
                    ], 200);
                }

                return Http::response([
                    'data' => [[
                        'product_name' => 'XL 5',
                        'category' => 'Pulsa',
                        'brand' => 'XL',
                        'type' => 'Umum',
                        'seller_name' => 'Seller',
                        'price' => 5000,
                        'buyer_sku_code' => 'X5',
                        'buyer_product_status' => true,
                        'seller_product_status' => true,
                        'unlimited_stock' => true,
                        'stock' => 0,
                        'multi' => false,
                        'start_cut_off' => '00:00',
                        'end_cut_off' => '00:00',
                        'desc' => 'x5',
                    ]],
                ], 200);
            },
            'vip-reseller.co.id/api/prepaid' => Http::response([
                'result' => true,
                'message' => 'OK',
                'data' => [[
                    'code' => 'vipxl5',
                    'name' => 'VIP XL 5',
                    'price' => 5100,
                    'brand' => 'XL',
                    'type' => 'pulsa',
                    'status' => 'available',
                ]],
            ], 200),
            'vip-reseller.co.id/api/game-feature' => Http::response([
                'result' => true,
                'message' => 'OK',
                'data' => [],
            ], 200),
        ]);
    }

    public function test_next_sync_is_today_2359_before_schedule_and_tomorrow_after(): void
    {
        $svc = app(AutomaticCatalogSyncService::class);

        $before = $svc->nextSyncAt(now('Asia/Jakarta')->setTime(10, 35, 0));
        $this->assertSame('23:59', $before->format('H:i'));
        $this->assertTrue($before->isSameDay(now('Asia/Jakarta')));

        $after = $svc->nextSyncAt(now('Asia/Jakarta')->setTime(0, 10, 0)->addDay());
        // from next-day 00:10 → next is that day's 23:59
        $this->assertSame('23:59', $after->format('H:i'));
        $this->assertTrue($after->isSameDay(now('Asia/Jakarta')->addDay()));
    }

    public function test_automatic_sync_runs_digiflazz_then_vip_and_writes_activity_log(): void
    {
        $this->fakeProviderCatalogs();

        $result = app(RunAutomaticCatalogSyncAction::class)->execute([
            'force' => true,
            'source' => 'test',
        ]);

        $this->assertSame('success', $result['status']);
        $this->assertDatabaseHas('activity_logs', [
            'activity' => 'AUTO_PRODUCT_PROVIDER_SYNC_STARTED',
        ]);
        $this->assertDatabaseHas('activity_logs', [
            'activity' => 'AUTO_PRODUCT_PROVIDER_SYNC_FINISHED',
        ]);

        $status = app(AutomaticCatalogSyncService::class)->statusPayload();
        $this->assertSame('success', $status['lastStatus']);
        $this->assertNotNull($status['lastSynchronization']['at']);
        $this->assertNotNull($status['nextSynchronization']['at']);
    }

    public function test_automatic_sync_retries_then_continues_to_vip_after_digi_failure(): void
    {
        $digiCalls = 0;
        Http::fake(function ($request) use (&$digiCalls) {
            $url = $request->url();
            if (str_contains($url, 'digiflazz.com')) {
                $digiCalls++;

                return Http::response([
                    'data' => [
                        'rc' => '83',
                        'status' => 'Gagal',
                        'message' => 'Anda telah mencapai limitasi pengecekan pricelist',
                    ],
                ], 200);
            }

            if (str_contains($url, 'vip-reseller')) {
                return Http::response([
                    'result' => true,
                    'data' => [[
                        'code' => 'vipxl5',
                        'name' => 'VIP XL 5',
                        'price' => ['basic' => 5100],
                        'status' => 'available',
                    ]],
                ], 200);
            }

            return Http::response(['data' => []], 200);
        });

        $result = app(RunAutomaticCatalogSyncAction::class)->execute([
            'force' => true,
            'source' => 'test',
        ]);

        $this->assertSame('failed', $result['status']);
        $this->assertGreaterThanOrEqual(2, $digiCalls); // initial + retry
        $this->assertSame('failed', $result['providers']['digiflazz']['status'] ?? null);
        $this->assertSame('success', $result['providers']['vip']['status'] ?? null);
        $this->assertDatabaseHas('activity_logs', [
            'activity' => 'AUTO_PRODUCT_PROVIDER_SYNC_FAILED',
        ]);
    }

    public function test_disabled_auto_sync_is_skipped_unless_forced(): void
    {
        config(['ppob.catalog_auto_sync.enabled' => false]);

        $skipped = app(RunAutomaticCatalogSyncAction::class)->execute(['source' => 'test']);
        $this->assertSame('skipped', $skipped['status']);

        $this->fakeProviderCatalogs();
        $forced = app(RunAutomaticCatalogSyncAction::class)->execute([
            'force' => true,
            'source' => 'test',
        ]);
        $this->assertSame('success', $forced['status']);
    }

    public function test_control_center_auto_sync_endpoint(): void
    {
        $ops = User::create([
            'name' => 'Ops Auto',
            'email' => 'ops-auto@gurkypay.com',
            'phone_number' => '081299900099',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Sanctum::actingAs($ops);

        $this->getJson('/api/v1/admin/operations/product-provider-control/auto-sync')
            ->assertOk()
            ->assertJsonPath('data.schedule.time', '23:59')
            ->assertJsonPath('data.schedule.frequency', 'Daily');
    }

    public function test_artisan_command_is_registered(): void
    {
        $this->fakeProviderCatalogs();
        $exit = Artisan::call('ppob:catalog-auto-sync', ['--force' => true]);
        $this->assertSame(0, $exit);
    }
}
