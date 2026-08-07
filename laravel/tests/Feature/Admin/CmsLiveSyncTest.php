<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Events\CmsContentUpdated;
use App\Models\User;
use App\Models\WebsiteSetting;
use App\Services\Website\CmsSyncService;
use App\Services\Website\PublicHomepageCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CmsLiveSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsMarketing(): User
    {
        $user = User::create([
            'name' => 'Marketing Sync',
            'email' => 'marketing-sync@gurkypay.com',
            'phone_number' => '0814'.random_int(10000000, 99999999),
            'password' => Hash::make('password123'),
            'role' => UserRole::MARKETING,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_patch_whatsapp_only_does_not_require_logo(): void
    {
        $setting = WebsiteSetting::create([
            'website_name' => 'GurkyNet',
            'tagline' => 'Tagline',
            'logo' => '/assets/logo.png',
            'whatsapp' => '6281111111111',
            'maintenance_mode' => false,
            'timezone' => 'Asia/Jakarta',
            'currency' => 'IDR',
            'language' => 'id',
        ]);

        $this->actingAsMarketing();

        Event::fake([CmsContentUpdated::class]);

        $this->patchJson("/api/v1/admin/website/settings/{$setting->id}", [
            'whatsapp' => '6289999999999',
        ])
            ->assertOk()
            ->assertJsonPath('data.whatsapp', '6289999999999');

        $this->assertSame('6289999999999', $setting->fresh()->whatsapp);
        $this->assertSame('/assets/logo.png', $setting->fresh()->logo);

        Event::assertDispatched(CmsContentUpdated::class, function (CmsContentUpdated $event) {
            return in_array(CmsSyncService::SCOPE_SETTINGS, $event->scopes, true);
        });
    }

    public function test_patch_rejects_media_object_logo_by_normalizing_or_omitting(): void
    {
        $setting = WebsiteSetting::create([
            'website_name' => 'GurkyNet',
            'logo' => '/assets/logo.png',
            'maintenance_mode' => false,
            'timezone' => 'Asia/Jakarta',
            'currency' => 'IDR',
            'language' => 'id',
        ]);

        $this->actingAsMarketing();

        // Sending Media-like object should be normalized to URL string, not 422
        $this->patchJson("/api/v1/admin/website/settings/{$setting->id}", [
            'logo' => ['url' => 'https://cdn.example.com/new-logo.png', 'id' => 99],
            'tagline' => 'Updated tagline only',
        ])->assertOk()
            ->assertJsonPath('data.tagline', 'Updated tagline only');
    }

    public function test_cms_sync_revision_bumps_and_clears_cache_on_settings_save(): void
    {
        Cache::flush();
        Cache::put(PublicHomepageCache::KEY, ['stale' => true], 300);
        Cache::put(PublicHomepageCache::SETTINGS_KEY, ['stale' => true], 1800);

        $setting = WebsiteSetting::create([
            'website_name' => 'GurkyNet',
            'maintenance_mode' => false,
            'timezone' => 'Asia/Jakarta',
            'currency' => 'IDR',
            'language' => 'id',
        ]);

        $before = CmsSyncService::status()['revision'];

        $this->actingAsMarketing();
        $this->patchJson("/api/v1/admin/website/settings/{$setting->id}", [
            'website_name' => 'GurkyNet Live',
        ])->assertOk();

        $after = CmsSyncService::status();
        $this->assertGreaterThan($before, $after['revision']);
        $this->assertFalse(Cache::has(PublicHomepageCache::KEY));
        $this->assertFalse(Cache::has(PublicHomepageCache::SETTINGS_KEY));

        $this->getJson('/api/v1/public/cms-sync')
            ->assertOk()
            ->assertJsonPath('data.revision', $after['revision']);
    }

    public function test_public_settings_survive_after_cache_clear(): void
    {
        WebsiteSetting::create([
            'website_name' => 'GurkyNet Public',
            'whatsapp' => '6281230000000',
            'maintenance_mode' => false,
            'timezone' => 'Asia/Jakarta',
            'currency' => 'IDR',
            'language' => 'id',
        ]);

        $this->getJson('/api/v1/public/settings')
            ->assertOk()
            ->assertJsonPath('data.websiteName', 'GurkyNet Public');

        PublicHomepageCache::forget(CmsSyncService::SCOPE_SETTINGS, 'test');

        $this->getJson('/api/v1/public/settings')
            ->assertOk()
            ->assertJsonPath('data.websiteName', 'GurkyNet Public')
            ->assertJsonPath('data.whatsapp', '6281230000000');
    }
}
