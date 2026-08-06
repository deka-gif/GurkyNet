<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\OtpCode;
use App\Models\SupportTicket;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountCenterTest extends TestCase
{
    use RefreshDatabase;

    protected User $userWithPin;
    protected User $userWithoutPin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userWithPin = User::create([
            'name' => 'With Pin',
            'email' => 'withpin@gurkypay.com',
            'phone_number' => '081111111111',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
            'pin_updated_at' => now()->subDay(),
        ]);

        Wallet::create([
            'user_id' => $this->userWithPin->id,
            'wallet_number' => 'W20001',
            'balance' => 50000,
            'status' => 'active',
        ]);

        $this->userWithoutPin = User::create([
            'name' => 'No Pin',
            'email' => 'nopin@gurkypay.com',
            'phone_number' => '082222222222',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => null,
        ]);

        Wallet::create([
            'user_id' => $this->userWithoutPin->id,
            'wallet_number' => 'W20002',
            'balance' => 25000,
            'status' => 'active',
        ]);
    }

    public function test_profile_exposes_has_pin_and_wallet_number(): void
    {
        Sanctum::actingAs($this->userWithPin);

        $response = $this->getJson('/api/v1/profile');

        $response->assertStatus(200)
            ->assertJsonPath('data.hasPin', true)
            ->assertJsonPath('data.wallet.wallet_number', 'W20001')
            ->assertJsonPath('data.wallet.walletNo', 'W20001');

        Sanctum::actingAs($this->userWithoutPin);
        $this->getJson('/api/v1/profile')
            ->assertStatus(200)
            ->assertJsonPath('data.hasPin', false);
    }

    public function test_user_can_create_pin_when_missing(): void
    {
        Sanctum::actingAs($this->userWithoutPin);

        $response = $this->postJson('/api/v1/pin/create', [
            'pin' => '654321',
            'pin_confirmation' => '654321',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.hasPin', true);

        $this->userWithoutPin->refresh();
        $this->assertTrue(Hash::check('654321', $this->userWithoutPin->transaction_pin));
        $this->assertNotNull($this->userWithoutPin->pin_updated_at);
    }

    public function test_cannot_create_pin_when_already_set(): void
    {
        Sanctum::actingAs($this->userWithPin);

        $this->postJson('/api/v1/pin/create', [
            'pin' => '999999',
            'pin_confirmation' => '999999',
        ])->assertStatus(422);
    }

    public function test_forgot_pin_via_otp(): void
    {
        Sanctum::actingAs($this->userWithPin);

        OtpCode::create([
            'phone_number' => '081111111111',
            'code' => '112233',
            'action' => 'pin_reset',
            'is_used' => false,
            'expires_at' => now()->addMinutes(10),
        ]);

        $response = $this->postJson('/api/v1/pin/forgot', [
            'phone_number' => '081111111111',
            'otp' => '112233',
            'pin' => '777777',
            'pin_confirmation' => '777777',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.hasPin', true);

        $this->userWithPin->refresh();
        $this->assertTrue(Hash::check('777777', $this->userWithPin->transaction_pin));
    }

    public function test_avatar_upload(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->userWithoutPin);

        $file = UploadedFile::fake()->image('avatar.jpg', 200, 200);

        $response = $this->post('/api/v1/profile/avatar', [
            'avatar' => $file,
        ], [
            'Accept' => 'application/json',
        ]);

        $response->assertStatus(200);
        $this->userWithoutPin->refresh();
        $this->assertNotNull($this->userWithoutPin->avatar_path);
        Storage::disk('public')->assertExists($this->userWithoutPin->avatar_path);
        $this->assertNotEmpty($response->json('data.avatar'));
    }

    public function test_user_can_create_and_list_complaints(): void
    {
        Sanctum::actingAs($this->userWithoutPin);

        $create = $this->postJson('/api/v1/complaints', [
            'category' => 'Transaksi',
            'subject' => 'Gagal bayar pulsa',
            'description' => 'Transaksi pending lebih dari 1 jam.',
        ]);

        $create->assertStatus(201)
            ->assertJsonPath('data.subject', 'Gagal bayar pulsa')
            ->assertJsonPath('data.status', 'Open');

        $id = $create->json('data.id');

        $this->getJson('/api/v1/complaints')
            ->assertStatus(200)
            ->assertJsonPath('data.0.id', $id);

        $this->getJson('/api/v1/complaints/' . $id)
            ->assertStatus(200)
            ->assertJsonPath('data.subject', 'Gagal bayar pulsa');

        // Other user cannot see this complaint
        Sanctum::actingAs($this->userWithPin);
        $this->getJson('/api/v1/complaints/' . $id)->assertStatus(404);
        $this->assertDatabaseHas('support_tickets', [
            'id' => $id,
            'user_id' => $this->userWithoutPin->id,
        ]);
    }

    public function test_help_and_about_endpoints_authenticated(): void
    {
        Sanctum::actingAs($this->userWithoutPin);

        $this->getJson('/api/v1/help')->assertStatus(200);
        $this->getJson('/api/v1/about')
            ->assertStatus(200)
            ->assertJsonStructure(['data' => ['version', 'appName']]);
    }
}
