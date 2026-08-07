<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;
use App\Models\Provider;
use App\Services\ProductProviders\ProductProviderHealthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class DigiflazzHealthProbeRefactorTest extends TestCase
{
    use RefreshDatabase;

    protected ProductProvider $digi;

    protected function setUp(): void
    {
        parent::setUp();

        // Reset accumulated HTTP stubs from TestCase so this suite owns Digiflazz responses.
        Http::swap(new \Illuminate\Http\Client\Factory);

        config([
            'services.digiflazz.username' => 'buyer-user',
            'services.digiflazz.api_key' => 'buyer-key',
            'services.digiflazz.base_url' => 'https://api.digiflazz.com/v1',
        ]);

        $this->digi = ProductProvider::digiflazz();
        $this->assertNotNull($this->digi);

        $category = ProductCategory::create(['name' => 'Pulsa', 'slug' => 'pulsa-health', 'icon' => 'phone', 'is_active' => true]);
        $brand = Provider::create(['name' => 'Telkomsel H', 'logo' => 't.png', 'is_active' => true]);
        $product = Product::create([
            'product_category_id' => $category->id,
            'provider_id' => $brand->id,
            'product_provider_id' => $this->digi->id,
            'sku_code' => 'DIGI-HEALTH-1',
            'name' => 'Health SKU',
            'base_price' => 10000,
            'sell_price' => 11000,
            'admin_fee' => 0,
            'status' => true,
            'ops_status' => 'active',
        ]);
        ProductProviderSku::create([
            'product_id' => $product->id,
            'product_provider_id' => $this->digi->id,
            'provider_sku' => 'digihealth1',
            'is_active' => true,
            'is_preferred' => true,
            'priority' => 1,
        ]);

        $this->digi->update([
            'is_active' => true,
            'partner_status' => 'online',
            'last_sync_at' => now(),
            'product_count' => 1,
            'api_status' => 'unknown',
        ]);
    }

    public function test_generic_invalid_message_without_deposit_is_partial_not_auth_failed(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/cek-saldo' => Http::response([
                'data' => [
                    'rc' => '42',
                    'message' => 'Parameter request tidak valid untuk deposit',
                ],
            ], 200),
        ]);

        $fresh = app(ProductProviderHealthService::class)->check($this->digi->fresh());

        $this->assertSame('partial', $fresh->api_status);
        $this->assertNotSame('auth_failed', $fresh->api_status);
        $this->assertStringContainsString('tidak valid', (string) $fresh->last_error);
        $this->assertStringNotContainsString('API Key atau Secret', (string) $fresh->last_error);
    }

    public function test_wrong_signature_is_auth_failed_with_provider_message(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/cek-saldo' => Http::response([
                'data' => [
                    'rc' => '01',
                    'message' => 'Wrong Signature',
                ],
            ], 200),
        ]);

        $fresh = app(ProductProviderHealthService::class)->check($this->digi->fresh());

        $this->assertSame('auth_failed', $fresh->api_status);
        $this->assertSame('Wrong Signature', $fresh->last_error);
    }

    public function test_balance_ok_is_online_and_logs_request_attempt(): void
    {
        Log::spy();

        Http::fake([
            'https://api.digiflazz.com/v1/cek-saldo' => Http::response([
                'data' => [
                    'deposit' => 125000,
                    'message' => 'OK',
                ],
            ], 200),
        ]);

        $fresh = app(ProductProviderHealthService::class)->check($this->digi->fresh());

        $this->assertSame('online', $fresh->api_status);
        $this->assertSame(125000.0, (float) $fresh->balance);
        $this->assertNull($fresh->last_error);

        Log::shouldHaveReceived('info')->withArgs(function ($message) {
            return is_string($message) && str_contains($message, 'Digiflazz API Request Attempt');
        })->atLeast()->once();
    }

    public function test_http_401_is_auth_failed(): void
    {
        Http::fake([
            'https://api.digiflazz.com/v1/cek-saldo' => Http::response([
                'data' => ['message' => 'Unauthorized'],
            ], 401),
        ]);

        $fresh = app(ProductProviderHealthService::class)->check($this->digi->fresh());

        $this->assertSame('auth_failed', $fresh->api_status);
        $this->assertSame('Unauthorized', $fresh->last_error);
    }
}
