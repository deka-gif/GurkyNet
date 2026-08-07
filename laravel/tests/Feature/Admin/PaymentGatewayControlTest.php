<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentGatewayControlTest extends TestCase
{
    use RefreshDatabase;

    protected User $ops;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ops = User::create([
            'name' => 'Ops PG',
            'email' => 'ops-pg@gurkypay.com',
            'phone_number' => '081288811001',
            'password' => Hash::make('password123'),
            'role' => UserRole::OPERATIONS,
            'transaction_pin' => Hash::make('123456'),
        ]);

        config([
            'services.midtrans.server_key' => 'SB-MID-server-test',
            'services.midtrans.client_key' => 'SB-MID-client-test',
        ]);
    }

    public function test_lists_payment_gateways_without_product_providers(): void
    {
        Sanctum::actingAs($this->ops);

        $res = $this->getJson('/api/v1/admin/operations/payment-gateway-control');
        $res->assertOk();

        $codes = collect($res->json('data'))->pluck('code')->map(fn ($c) => strtolower((string) $c))->all();
        $this->assertContains('midtrans', $codes);
        $this->assertNotContains('digiflazz', $codes);
        $this->assertNotContains('vip', $codes);
    }

    public function test_enable_disable_midtrans_persists_status_setting(): void
    {
        Sanctum::actingAs($this->ops);

        $this->postJson('/api/v1/admin/operations/payment-gateway-control/midtrans/disable')
            ->assertOk()
            ->assertJsonPath('data.enabled', false);

        $this->assertSame('offline', Setting::where('key', 'partner_midtrans_status')->value('value'));

        $this->postJson('/api/v1/admin/operations/payment-gateway-control/midtrans/enable')
            ->assertOk()
            ->assertJsonPath('data.enabled', true);

        $this->assertSame('online', Setting::where('key', 'partner_midtrans_status')->value('value'));
    }

    public function test_non_integrated_gateway_cannot_be_enabled(): void
    {
        Sanctum::actingAs($this->ops);

        $this->postJson('/api/v1/admin/operations/payment-gateway-control/xendit/enable')
            ->assertStatus(422);
    }
}
