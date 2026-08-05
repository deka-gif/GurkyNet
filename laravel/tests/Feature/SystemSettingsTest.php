<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;
use App\Models\User;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;

class SystemSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // create super admin user
        $this->user = User::factory()->create([
            'role' => 'owner'
        ]);
    }

    /** @test */
    public function owner_can_get_all_system_settings()
    {
        SystemSetting::create(['key' => 'app_name', 'value' => 'GurkyNet Test']);

        $response = $this->actingAs($this->user)->getJson('/api/v1/admin/system-settings');

        $response->assertStatus(200)
                 ->assertJsonPath('data.settings.app_name', 'GurkyNet Test');
    }

    /** @test */
    public function non_owner_cannot_access_system_settings()
    {
        $user = User::factory()->create(['role' => 'marketing']);

        $response = $this->actingAs($user)->getJson('/api/v1/admin/system-settings');

        $response->assertStatus(403);
    }

    /** @test */
    public function owner_can_update_system_settings_and_sensitive_keys_are_encrypted()
    {
        $settingsData = [
            'app_name' => 'New App Name',
            'email_smtp_password' => 'secret_password_123',
        ];

        $response = $this->actingAs($this->user)->putJson('/api/v1/admin/system-settings', [
            'settings' => $settingsData
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('data.settings.app_name', 'New App Name')
                 ->assertJsonPath('data.settings.email_smtp_password', 'secret_password_123');

        // Verify in DB that it is encrypted
        $plainTextSetting = SystemSetting::where('key', 'app_name')->first();
        $this->assertEquals('New App Name', $plainTextSetting->value);

        $encryptedSetting = SystemSetting::where('key', 'email_smtp_password')->first();
        $this->assertNotEquals('secret_password_123', $encryptedSetting->value);
        $this->assertEquals('secret_password_123', Crypt::decryptString($encryptedSetting->value));
    }

    /** @test */
    public function owner_can_send_test_email()
    {
        Mail::fake();

        $response = $this->actingAs($this->user)->postJson('/api/v1/admin/system-settings/test-email', [
            'email' => 'test@example.com'
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /** @test */
    public function validation_fails_if_email_is_invalid_for_test_email()
    {
        $response = $this->actingAs($this->user)->postJson('/api/v1/admin/system-settings/test-email', [
            'email' => 'invalid-email'
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['email']);
    }
}
