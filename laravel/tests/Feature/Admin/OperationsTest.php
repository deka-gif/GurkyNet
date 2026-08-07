<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Models\ProductCategory;
use App\Models\Provider;
use App\Models\Product;
use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationsTest extends TestCase
{
    use RefreshDatabase;

    protected User $operationsUser;
    protected User $ownerUser;
    protected User $superAdminUser;
    protected User $regularUser;
    protected Provider $provider;
    protected ProductCategory $category;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Operations User
        $this->operationsUser = User::create([
            'name' => 'Operations Admin',
            'email' => 'operations@gurkypay.com',
            'phone_number' => '081222222223',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 2. Owner User
        $this->ownerUser = User::create([
            'name' => 'Owner Admin',
            'email' => 'owner@gurkypay.com',
            'phone_number' => '081333333333',
            'password' => Hash::make('password123'),
            'role' => UserRole::OWNER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 3. Super Admin
        $this->superAdminUser = User::create([
            'name' => 'Super Admin',
            'email' => 'admin@gurkypay.com',
            'phone_number' => '081444444444',
            'password' => Hash::make('password123'),
            'role' => UserRole::SUPER_ADMIN,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 4. Regular User
        $this->regularUser = User::create([
            'name' => 'Budi Customer',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081555555555',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // Seed Category, Provider, Product
        $this->category = ProductCategory::create([
            'name' => 'Pulsa HP',
            'slug' => 'pulsa-hp',
            'icon' => 'phone',
            'service_type' => 'pulsa',
            'is_active' => true,
        ]);

        $this->provider = Provider::create([
            'name' => 'Telkomsel',
            'logo' => 'telkomsel.png',
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'product_category_id' => $this->category->id,
            'provider_id' => $this->provider->id,
            'sku_code' => 'S10',
            'name' => 'Telkomsel 10rb',
            'base_price' => 10000.00,
            'sell_price' => 11500.00,
            'admin_fee' => 0.00,
            'status' => true,
        ]);
    }

    public function test_unauthorized_user_cannot_access_operations_dashboard(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->getJson('/api/v1/admin/operations/dashboard');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_operations_user_can_access_dashboard(): void
    {
        Sanctum::actingAs($this->operationsUser);

        $response = $this->getJson('/api/v1/admin/operations/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'product_summary' => [
                        'product_count',
                        'active_products',
                        'inactive_products',
                        'maintenance_products',
                    ],
                    'provider_health' => [
                        'total_providers',
                        'active_providers',
                        'inactive_providers',
                        'health_status',
                    ],
                    'provider_status',
                    'recent_operation_logs',
                ],
                'meta',
                'errors',
            ]);
    }

    public function test_operations_user_can_list_products(): void
    {
        Sanctum::actingAs($this->operationsUser);

        $response = $this->getJson('/api/v1/admin/operations/products?search=Telkomsel');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data',
                'meta' => [
                    'pagination' => ['currentPage', 'lastPage', 'perPage', 'total'],
                ],
            ]);
    }

    public function test_operations_user_can_update_product(): void
    {
        Sanctum::actingAs($this->operationsUser);

        $response = $this->putJson("/api/v1/admin/operations/products/{$this->product->id}", [
            'margin' => 2000,
            'status' => true,
            'admin_notes' => 'Menaikkan margin ke 2000',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('products', [
            'id' => $this->product->id,
            'sell_price' => 12000.00,
        ]);
    }

    public function test_operations_user_can_list_providers(): void
    {
        Sanctum::actingAs($this->operationsUser);

        $response = $this->getJson('/api/v1/admin/operations/providers');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data',
                'meta' => [
                    'pagination' => ['currentPage', 'lastPage', 'perPage', 'total'],
                ],
            ]);

        $codes = collect($response->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all();
        $this->assertContains('digiflazz', $codes);
    }

    public function test_operations_user_can_update_provider(): void
    {
        Sanctum::actingAs($this->operationsUser);

        $digi = \App\Models\ProductProvider::digiflazz();
        $this->assertNotNull($digi);

        $response = $this->putJson("/api/v1/admin/operations/providers/{$digi->id}", [
            'status' => 'maintenance',
            'notes' => 'Penyedia sedang mengalami gangguan jaringan',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('product_providers', [
            'id' => $digi->id,
            'partner_status' => 'maintenance',
            'is_active' => true,
        ]);
    }

    public function test_operations_user_can_get_pricing_rules(): void
    {
        Sanctum::actingAs($this->operationsUser);

        $response = $this->getJson('/api/v1/admin/operations/pricing');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'margin_rules' => [
                        'default_margin',
                        'category_margin',
                        'provider_margin',
                    ],
                ],
            ]);
    }

    public function test_operations_user_can_update_pricing_rules(): void
    {
        Sanctum::actingAs($this->operationsUser);

        $response = $this->putJson('/api/v1/admin/operations/pricing', [
            'default_margin' => 1800,
            'category_margin' => [
                ['category' => 'Pulsa', 'margin' => 1800],
                ['category' => 'Data', 'margin' => 2200],
            ],
            'provider_margin' => [
                ['provider' => 'Telkomsel', 'margin' => 1800],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('settings', [
            'key' => 'default_margin',
            'value' => '1800',
        ]);
    }
}
