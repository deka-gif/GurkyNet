<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\LoginLog;
use App\Models\ActivityLog;
use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    protected User $regularUser;
    protected string $originalPassword = 'password123';
    protected string $originalPin = '123456';

    protected function setUp(): void
    {
        parent::setUp();

        // Create Regular User
        $this->regularUser = User::create([
            'name' => 'Budi Customer',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081555555555',
            'password' => Hash::make($this->originalPassword),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make($this->originalPin),
            'birth_date' => '1995-05-12',
            'gender' => 'Laki-laki',
            'address' => 'Jl. Merdeka No. 10, Jakarta',
        ]);

        // Create Wallet for Budi
        Wallet::create([
            'user_id' => $this->regularUser->id,
            'wallet_number' => 'W10001',
            'balance' => 150000.00,
            'status' => 'active',
        ]);
    }

    public function test_unauthorized_user_cannot_access_profile_endpoints(): void
    {
        $response = $this->getJson('/api/v1/profile');

        $response->assertStatus(401);
    }

    public function test_get_profile(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->getJson('/api/v1/profile');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'id',
                    'name',
                    'email',
                    'phone',
                    'birthDate',
                    'gender',
                    'address',
                    'role',
                    'wallet' => [
                        'walletNo',
                        'balance',
                        'status',
                    ],
                ],
            ])
            ->assertJsonPath('data.name', 'Budi Customer')
            ->assertJsonPath('data.wallet.balance', 150000);
    }

    public function test_update_profile(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->putJson('/api/v1/profile', [
            'name' => 'Budi Setiawan',
            'phone_number' => '081234567890',
            'email' => 'budi_new@gurkypay.com',
            'birth_date' => '1994-04-10',
            'gender' => 'Laki-laki',
            'address' => 'Jl. Sudirman No. 25, Jakarta',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.name', 'Budi Setiawan')
            ->assertJsonPath('data.email', 'budi_new@gurkypay.com');

        $this->assertDatabaseHas('users', [
            'id' => $this->regularUser->id,
            'name' => 'Budi Setiawan',
            'email' => 'budi_new@gurkypay.com',
            'birth_date' => '1994-04-10',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $this->regularUser->id,
            'activity' => 'PROFILE_UPDATE',
        ]);
    }

    public function test_change_password_success(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->putJson('/api/v1/profile/password', [
            'current_password' => $this->originalPassword,
            'new_password' => 'newpassword123',
            'new_password_confirmation' => 'newpassword123',
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertTrue(Hash::check('newpassword123', $this->regularUser->fresh()->password));
    }

    public function test_change_password_wrong_current_password(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->putJson('/api/v1/profile/password', [
            'current_password' => 'wrongpassword',
            'new_password' => 'newpassword123',
            'new_password_confirmation' => 'newpassword123',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_change_pin_success(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->putJson('/api/v1/profile/pin', [
            'current_pin' => $this->originalPin,
            'new_pin' => '654321',
            'new_pin_confirmation' => '654321',
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertTrue(Hash::check('654321', $this->regularUser->fresh()->transaction_pin));
    }

    public function test_change_pin_wrong_current_pin(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->putJson('/api/v1/profile/pin', [
            'current_pin' => '999999',
            'new_pin' => '654321',
            'new_pin_confirmation' => '654321',
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_get_security_overview(): void
    {
        Sanctum::actingAs($this->regularUser);

        // Seed a login log
        LoginLog::create([
            'user_id' => $this->regularUser->id,
            'ip_address' => '192.168.1.1',
            'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'logged_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/profile/security');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'last_login' => [
                        'ip_address',
                        'user_agent',
                        'logged_at',
                    ],
                    'registered_devices' => [
                        '*' => [
                            'user_agent',
                            'ip_address',
                            'last_login_at',
                        ]
                    ],
                    'active_tokens',
                    'two_factor_status',
                ],
            ]);
    }

    public function test_logout_one_device(): void
    {
        $user = $this->regularUser;

        // Generate 2 tokens
        $token1 = $user->createToken('Device 1');
        $token2 = $user->createToken('Device 2');

        // Authenticate with Token 1 via real Sanctum bearer token (not TransientToken).
        $this->withToken($token1->plainTextToken);

        $this->assertDatabaseHas('personal_access_tokens', ['id' => $token2->accessToken->id]);

        $response = $this->deleteJson("/api/v1/profile/sessions/{$token2->accessToken->id}");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token2->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $token1->accessToken->id]);
    }

    public function test_logout_all_devices_except_current(): void
    {
        $user = $this->regularUser;

        // Generate 3 tokens
        $token1 = $user->createToken('Device 1');
        $token2 = $user->createToken('Device 2');
        $token3 = $user->createToken('Device 3');

        // Authenticate with Token 1 via real Sanctum bearer token (not TransientToken).
        $this->withToken($token1->plainTextToken);

        $this->assertDatabaseHas('personal_access_tokens', ['id' => $token2->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $token3->accessToken->id]);

        $response = $this->deleteJson('/api/v1/profile/sessions');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token2->accessToken->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token3->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $token1->accessToken->id]);
    }
}
