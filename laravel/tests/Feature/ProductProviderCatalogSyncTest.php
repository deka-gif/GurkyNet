<?php

namespace Tests\Feature;

use App\Actions\Admin\Operations\SyncDigiflazzCatalogAction;
use App\Actions\Admin\Operations\SyncVipCatalogAction;
use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductPrice;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\ProductSyncRun;
use App\Models\Provider;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Digiflazz / VIPayment product catalog sync — FR-OPS-01..10, SRS Bagian 15.
 * Covers: create/update, retirement (deactivation), failure safety ("keep last known
 * good"), category-mapping visibility, price separation, sync-run logging, and RBAC.
 */
class ProductProviderCatalogSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Http::swap(new \Illuminate\Http\Client\Factory());

        config([
            'services.digiflazz.username' => 'gurky_test_user',
            'services.digiflazz.api_key' => 'gurky_test_key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
            'services.vip.base_url' => 'https://vip-reseller.co.id/api',
            'services.vip.username' => 'vip_test_id',
            'services.vip.merchant_id' => 'vip_test_id',
            'services.vip.api_key' => 'vip_test_key_real',
            'services.vip.signature' => '',
        ]);

        ProductProvider::digiflazz()?->update(['is_active' => true, 'api_status' => 'online']);
        ProductProvider::vip()?->update(['is_active' => true, 'api_status' => 'online']);
    }

    // Http::fake() MERGES stub callbacks across calls rather than replacing them, so
    // re-calling it mid-test with a new static response would leave the FIRST-registered
    // handler still matching. Register each endpoint's fake exactly once (closure reading
    // a mutable property) and mutate the property to change what the next call returns.
    protected ?array $digiflazzFakeResponse = null;
    protected int $digiflazzFakeStatus = 200;
    protected bool $digiflazzFakePrimed = false;

    protected ?array $vipPrepaidFakeResponse = null;
    protected int $vipPrepaidFakeStatus = 200;
    protected ?array $vipGameFakeResponse = ['result' => true, 'data' => []];
    protected int $vipGameFakeStatus = 200;
    protected bool $vipFakePrimed = false;

    protected function digiflazzRow(array $overrides = []): array
    {
        return array_merge([
            'product_name' => 'Telkomsel 10K',
            'category' => 'Pulsa',
            'brand' => 'Telkomsel',
            'buyer_sku_code' => 'TSEL10K',
            'buyer_product_status' => true,
            'seller_product_status' => true,
            'unlimited_stock' => true,
            'price' => 10000,
            'seller_price' => 10000,
        ], $overrides);
    }

    protected function primeDigiflazzFake(): void
    {
        if ($this->digiflazzFakePrimed) {
            return;
        }
        $this->digiflazzFakePrimed = true;
        Http::fake([
            'https://api.digiflazz.com/v1/price-list' => function () {
                return Http::response($this->digiflazzFakeResponse ?? ['data' => []], $this->digiflazzFakeStatus);
            },
        ]);
    }

    protected function fakeDigiflazzPriceList(array $rows): void
    {
        $this->digiflazzFakeResponse = ['data' => $rows];
        $this->digiflazzFakeStatus = 200;
        $this->primeDigiflazzFake();
    }

    protected function fakeDigiflazzRcError(string $rc = '83', string $message = 'Anda telah mencapai limitasi pengecekan pricelist.'): void
    {
        $this->digiflazzFakeResponse = ['data' => ['rc' => $rc, 'message' => $message]];
        $this->digiflazzFakeStatus = 200;
        $this->primeDigiflazzFake();
    }

    protected function vipRow(array $overrides = []): array
    {
        return array_merge([
            'code' => 'XL5GB',
            'name' => 'XL Data 5GB',
            'brand' => 'XL',
            'category' => 'data',
            'price' => ['basic' => 24000, 'premium' => null, 'special' => null],
            'status' => 'available',
        ], $overrides);
    }

    protected function primeVipFake(): void
    {
        if ($this->vipFakePrimed) {
            return;
        }
        $this->vipFakePrimed = true;
        Http::fake([
            'https://vip-reseller.co.id/api/prepaid' => function () {
                return Http::response($this->vipPrepaidFakeResponse ?? ['result' => true, 'data' => []], $this->vipPrepaidFakeStatus);
            },
            'https://vip-reseller.co.id/api/game-feature' => function () {
                return Http::response($this->vipGameFakeResponse ?? ['result' => true, 'data' => []], $this->vipGameFakeStatus);
            },
        ]);
    }

    protected function fakeVipPrepaid(array $rows, int $status = 200): void
    {
        $this->vipPrepaidFakeResponse = ['result' => true, 'data' => $rows];
        $this->vipPrepaidFakeStatus = $status;
        $this->primeVipFake();
    }

    protected function fakeVipPrepaidFailure(int $status = 500, string $message = 'down'): void
    {
        $this->vipPrepaidFakeResponse = ['result' => false, 'message' => $message];
        $this->vipPrepaidFakeStatus = $status;
        $this->primeVipFake();
    }

    protected function fakeVipGameFailure(int $status = 500, string $message = 'error'): void
    {
        $this->vipGameFakeResponse = ['result' => false, 'message' => $message];
        $this->vipGameFakeStatus = $status;
        $this->primeVipFake();
    }

    // ---------------------------------------------------------------------
    // Digiflazz
    // ---------------------------------------------------------------------

    public function test_digiflazz_sync_creates_new_product(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);

        $result = app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $this->assertSame('success', $result['status']);
        $product = Product::where('sku_code', 'TSEL10K')->first();
        $this->assertNotNull($product);
        $this->assertSame('Telkomsel 10K', $product->name);
        $this->assertTrue((bool) $product->status);
    }

    public function test_digiflazz_sync_updates_existing_product_and_preserves_margin(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow(['seller_price' => 10000, 'price' => 10000])]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $product = Product::where('sku_code', 'TSEL10K')->firstOrFail();
        $originalMargin = (float) $product->sell_price - (float) $product->base_price;
        $this->assertGreaterThan(0, $originalMargin);

        // Cost goes up — margin must be PRESERVED, not overwritten by provider's price.
        $this->fakeDigiflazzPriceList([$this->digiflazzRow(['seller_price' => 12000, 'price' => 12000])]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $product->refresh();
        $this->assertEquals(12000.0, (float) $product->base_price);
        $this->assertEquals($originalMargin, (float) $product->sell_price - (float) $product->base_price);
    }

    public function test_digiflazz_sync_deactivates_missing_sku(): void
    {
        $this->fakeDigiflazzPriceList([
            $this->digiflazzRow(['buyer_sku_code' => 'TSEL10K']),
            $this->digiflazzRow(['buyer_sku_code' => 'TSEL20K', 'product_name' => 'Telkomsel 20K']),
        ]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);
        $this->assertTrue((bool) Product::where('sku_code', 'TSEL20K')->firstOrFail()->status);

        // TSEL20K no longer present in the provider's response — must be retired, not deleted.
        $this->fakeDigiflazzPriceList([$this->digiflazzRow(['buyer_sku_code' => 'TSEL10K'])]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $retired = Product::where('sku_code', 'TSEL20K')->first();
        $this->assertNotNull($retired, 'Deactivation must never hard-delete the product row.');
        $this->assertFalse((bool) $retired->status);
        $this->assertTrue((bool) Product::where('sku_code', 'TSEL10K')->firstOrFail()->status);
    }

    public function test_digiflazz_sync_failure_preserves_last_known_good_catalog(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);
        $before = Product::where('sku_code', 'TSEL10K')->firstOrFail();
        $this->assertTrue((bool) $before->status);

        // Rate-limited (RC83) response with zero data rows must never wipe the catalog.
        $this->fakeDigiflazzRcError();
        try {
            app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);
        } catch (\App\Exceptions\ProviderCatalogException $e) {
            // Expected — sync surfaces the failure instead of silently succeeding.
        }

        $after = Product::where('sku_code', 'TSEL10K')->firstOrFail();
        $this->assertTrue((bool) $after->status, 'A rate-limited/failed fetch must never deactivate existing products.');

        $run = ProductSyncRun::where('provider_code', ProductProvider::CODE_DIGIFLAZZ)->latest('id')->first();
        $this->assertNotNull($run);
        $this->assertSame(ProductSyncRun::STATUS_FAILED, $run->status);
    }

    public function test_digiflazz_persists_category_mapping_source(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $product = Product::where('sku_code', 'TSEL10K')->firstOrFail();
        $this->assertSame('provider_category', $product->category_mapping_source);
    }

    public function test_digiflazz_sync_creates_sync_run_with_correct_counts(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true, 'triggered_by' => 'manual']);

        $run = ProductSyncRun::where('provider_code', ProductProvider::CODE_DIGIFLAZZ)->latest('id')->firstOrFail();
        $this->assertSame(ProductSyncRun::STATUS_SUCCESS, $run->status);
        $this->assertSame('manual', $run->triggered_by);
        $this->assertSame(1, $run->created_count);
        $this->assertNotNull($run->started_at);
        $this->assertNotNull($run->completed_at);
    }

    // ---------------------------------------------------------------------
    // VIP
    // ---------------------------------------------------------------------

    public function test_vip_sync_creates_new_product(): void
    {
        $this->fakeVipPrepaid([$this->vipRow()]);

        $result = app(SyncVipCatalogAction::class)->execute(['include_game' => false]);

        $this->assertSame(1, $result['imported']);
        $product = Product::where('sku_code', 'VIP-XL5GB')->first();
        $this->assertNotNull($product);
        $this->assertTrue((bool) $product->status);
    }

    public function test_vip_sync_updates_existing_product(): void
    {
        $this->fakeVipPrepaid([$this->vipRow(['price' => ['basic' => 24000, 'premium' => null, 'special' => null]])]);
        app(SyncVipCatalogAction::class)->execute(['include_game' => false]);

        $this->fakeVipPrepaid([$this->vipRow(['price' => ['basic' => 27000, 'premium' => null, 'special' => null]])]);
        $result = app(SyncVipCatalogAction::class)->execute(['include_game' => false]);

        $this->assertSame(1, $result['updated']);
        $product = Product::where('sku_code', 'VIP-XL5GB')->firstOrFail();
        $this->assertEquals(27000.0, (float) $product->base_price);
    }

    public function test_vip_sync_deactivates_missing_sku(): void
    {
        $this->fakeVipPrepaid([
            $this->vipRow(['code' => 'XL5GB', 'name' => 'XL Data 5GB']),
            $this->vipRow(['code' => 'XL10GB', 'name' => 'XL Data 10GB']),
        ]);
        app(SyncVipCatalogAction::class)->execute(['include_game' => false]);
        $this->assertTrue((bool) Product::where('sku_code', 'VIP-XL10GB')->firstOrFail()->status);

        // XL10GB retired from VIP's catalog this run.
        $this->fakeVipPrepaid([$this->vipRow(['code' => 'XL5GB', 'name' => 'XL Data 5GB'])]);
        $result = app(SyncVipCatalogAction::class)->execute(['include_game' => false]);

        $this->assertGreaterThan(0, $result['disabled']);
        $retired = Product::where('sku_code', 'VIP-XL10GB')->first();
        $this->assertNotNull($retired);
        $this->assertFalse((bool) $retired->status);
        $skuOffer = ProductProviderSku::where('provider_sku', 'XL10GB')
            ->where('product_provider_id', ProductProvider::vip()->id)
            ->firstOrFail();
        $this->assertFalse((bool) $skuOffer->is_active);
    }

    public function test_vip_sync_skips_deactivation_when_game_catalog_fetch_fails(): void
    {
        $this->fakeVipPrepaid([
            $this->vipRow(['code' => 'XL5GB', 'name' => 'XL Data 5GB']),
        ]);
        app(SyncVipCatalogAction::class)->execute(['include_game' => false]);

        // Now request BOTH catalogs, but the game-feature endpoint fails this run —
        // XL5GB (prepaid, unrelated to the failure) must NOT be treated as "missing".
        $this->fakeVipPrepaid([$this->vipRow(['code' => 'XL5GB', 'name' => 'XL Data 5GB'])]);
        $this->fakeVipGameFailure();
        $result = app(SyncVipCatalogAction::class)->execute(['include_game' => true]);

        $this->assertSame(0, $result['disabled'], 'A partial-catalog fetch failure must never trigger deactivation.');
        $this->assertTrue((bool) Product::where('sku_code', 'VIP-XL5GB')->firstOrFail()->status);
    }

    public function test_vip_sync_failure_preserves_catalog(): void
    {
        $this->fakeVipPrepaid([$this->vipRow()]);
        app(SyncVipCatalogAction::class)->execute(['include_game' => false]);
        $before = Product::where('sku_code', 'VIP-XL5GB')->firstOrFail();
        $this->assertTrue((bool) $before->status);

        $this->fakeVipPrepaidFailure();
        try {
            app(SyncVipCatalogAction::class)->execute(['include_game' => false]);
            $this->fail('Expected VIP sync to throw on a failed prepaid fetch.');
        } catch (\RuntimeException $e) {
            // expected
        }

        $after = Product::where('sku_code', 'VIP-XL5GB')->firstOrFail();
        $this->assertTrue((bool) $after->status);

        $run = ProductSyncRun::where('provider_code', ProductProvider::CODE_VIP)->latest('id')->firstOrFail();
        $this->assertSame(ProductSyncRun::STATUS_FAILED, $run->status);
    }

    public function test_vip_sync_creates_sync_run_with_correct_counts(): void
    {
        $this->fakeVipPrepaid([$this->vipRow()]);
        app(SyncVipCatalogAction::class)->execute(['include_game' => false, 'triggered_by' => 'scheduled']);

        $run = ProductSyncRun::where('provider_code', ProductProvider::CODE_VIP)->latest('id')->firstOrFail();
        $this->assertSame(ProductSyncRun::STATUS_SUCCESS, $run->status);
        $this->assertSame('scheduled', $run->triggered_by);
        $this->assertSame(1, $run->created_count);
    }

    public function test_vip_sync_persists_category_mapping_source(): void
    {
        $this->fakeVipPrepaid([$this->vipRow()]);
        app(SyncVipCatalogAction::class)->execute(['include_game' => false]);

        $product = Product::where('sku_code', 'VIP-XL5GB')->firstOrFail();
        $this->assertNotNull($product->category_mapping_source);
    }

    // ---------------------------------------------------------------------
    // Cross-cutting: catalog consistency, pricing separation, RBAC
    // ---------------------------------------------------------------------

    public function test_duplicate_sync_run_does_not_duplicate_products(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $this->assertSame(1, Product::where('sku_code', 'TSEL10K')->count());
    }

    public function test_inactive_product_not_shown_in_user_catalog(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow(['buyer_sku_code' => 'TSEL10K'])]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        // Retire it.
        $this->fakeDigiflazzPriceList([]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $response = $this->getJson('/api/v1/products?keyword=TSEL10K');
        $response->assertOk();
        $codes = collect($response->json('data'))->pluck('code')->all();
        $this->assertNotContains('TSEL10K', $codes, 'A deactivated product must not appear in the user-facing catalog.');
    }

    public function test_user_and_operations_read_the_same_synced_catalog(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $userResponse = $this->getJson('/api/v1/products?keyword=TSEL10K');
        $userResponse->assertOk();
        $userProduct = collect($userResponse->json('data'))->firstWhere('code', 'TSEL10K');
        $this->assertNotNull($userProduct);

        $ops = $this->operationsUser();
        Sanctum::actingAs($ops);
        $opsResponse = $this->getJson('/api/v1/admin/operations/products?search=TSEL10K');
        $opsResponse->assertOk();
        $opsProduct = collect($opsResponse->json('data'))->firstWhere('code', 'TSEL10K');
        $this->assertNotNull($opsProduct);

        // Same source of truth — identical price/category, not a second representation.
        $this->assertSame($userProduct['category'], $opsProduct['category']);
        $this->assertEquals($userProduct['price'], $opsProduct['price']);
    }

    public function test_agent_pricing_is_untouched_by_sync(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);
        $product = Product::where('sku_code', 'TSEL10K')->firstOrFail();

        $agentPrice = ProductPrice::create([
            'product_id' => $product->id,
            'agent_level' => 'gold',
            'sell_price' => 10800,
            'effective_from' => now(),
            'is_current' => true,
        ]);

        // Cost changes on the next sync — agent tier pricing must remain exactly as Ops set it.
        $this->fakeDigiflazzPriceList([$this->digiflazzRow(['seller_price' => 15000, 'price' => 15000])]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $agentPrice->refresh();
        $this->assertEquals(10800.0, (float) $agentPrice->sell_price);
    }

    public function test_unmapped_product_is_flagged_and_filterable_by_operations(): void
    {
        // A category/brand/name combination that resolves via the lowest-priority
        // keyword-fallback path is still fine; a truly unrecognized category with no
        // brand/name-keyword hit falls through to the config unmapped_fallback default.
        $this->fakeDigiflazzPriceList([$this->digiflazzRow([
            'buyer_sku_code' => 'UNKNOWNSKU1',
            'category' => 'ZzzTotallyUnrecognizedCategoryXyz',
            'brand' => 'ZzzUnknownBrand',
            'product_name' => 'ZzzUnknownBrand Random Product',
        ])]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $product = Product::where('sku_code', 'UNKNOWNSKU1')->firstOrFail();
        $this->assertSame('unmapped_fallback', $product->category_mapping_source);

        $ops = $this->operationsUser();
        Sanctum::actingAs($ops);
        $response = $this->getJson('/api/v1/admin/operations/products?unmapped=1');
        $response->assertOk();
        $codes = collect($response->json('data'))->pluck('code')->all();
        $this->assertContains('UNKNOWNSKU1', $codes);
    }

    public function test_manual_sync_rbac_operations_can_trigger_owner_cannot(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);

        $ops = $this->operationsUser();
        Sanctum::actingAs($ops);
        $this->postJson('/api/v1/admin/operations/sync', ['cmd' => ['prepaid']])->assertOk();

        $owner = User::create([
            'name' => 'Owner User',
            'email' => 'owner-sync-test@gurkynet.test',
            'phone_number' => '081200000099',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
        ]);
        Sanctum::actingAs($owner);
        $this->postJson('/api/v1/admin/operations/sync', ['cmd' => ['prepaid']])->assertStatus(403);

        $regularUser = User::create([
            'name' => 'Regular User',
            'email' => 'user-sync-test@gurkynet.test',
            'phone_number' => '081200000098',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
        ]);
        Sanctum::actingAs($regularUser);
        $this->postJson('/api/v1/admin/operations/sync', ['cmd' => ['prepaid']])->assertStatus(403);
    }

    public function test_sync_run_log_never_leaks_provider_credentials(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $run = ProductSyncRun::latest('id')->firstOrFail();
        $dump = json_encode($run->toArray());
        $this->assertStringNotContainsString('gurky_test_key', $dump);
        $this->assertStringNotContainsString('api_key', $dump);
        $this->assertStringNotContainsString('secret', $dump);

        $ops = $this->operationsUser();
        Sanctum::actingAs($ops);
        $response = $this->getJson('/api/v1/admin/operations/sync-runs');
        $response->assertOk();
        $body = json_encode($response->json());
        $this->assertStringNotContainsString('gurky_test_key', $body);
    }

    public function test_last_synced_at_exposed_on_product_resource(): void
    {
        $this->fakeDigiflazzPriceList([$this->digiflazzRow()]);
        app(SyncDigiflazzCatalogAction::class)->execute(['cmd' => ['prepaid'], 'inline_all_cmds' => true]);

        $response = $this->getJson('/api/v1/products?keyword=TSEL10K');
        $response->assertOk();
        $product = collect($response->json('data'))->firstWhere('code', 'TSEL10K');
        $this->assertNotNull($product['lastSyncedAt'] ?? null);
    }

    protected function operationsUser(): User
    {
        return User::create([
            'name' => 'Ops User',
            'email' => 'ops-sync-test@gurkynet.test',
            'phone_number' => '081200000097',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
        ]);
    }
}
