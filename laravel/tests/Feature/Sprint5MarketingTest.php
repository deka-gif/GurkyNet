<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\BannerPromotion;
use App\Models\User;
use App\Models\WebsiteSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 5 — FR-MKT01, FR-MKT04, FR-MKT06 (Marketing identity, logos, homepage banners).
 */
class Sprint5MarketingTest extends TestCase
{
    use RefreshDatabase;

    protected User $marketing;
    protected User $finance;
    protected User $operations;
    protected User $cs;
    protected User $agent;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        $this->marketing = $this->makeUser('marketing-s5@gurkynet.test', '081511100001', UserRole::MARKETING);
        $this->finance = $this->makeUser('finance-s5@gurkynet.test', '081511100002', UserRole::FINANCE);
        $this->operations = $this->makeUser('ops-s5@gurkynet.test', '081511100003', UserRole::OPERATIONS);
        $this->cs = $this->makeUser('cs-s5@gurkynet.test', '081511100004', UserRole::CUSTOMER_SUPPORT);
        $this->agent = $this->makeUser('user-s5@gurkynet.test', '081511100005', UserRole::USER);
    }

    private function makeUser(string $email, string $phone, UserRole $role): User
    {
        return User::create([
            'name' => $email,
            'email' => $email,
            'phone_number' => $phone,
            'password' => Hash::make('password123'),
            'role' => $role,
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    // ─── FR-MKT01 ───────────────────────────────────────────────

    public function test_fr_mkt01_marketing_can_save_company_identity_with_operating_hours(): void
    {
        Sanctum::actingAs($this->marketing);

        $setting = WebsiteSetting::create([
            'website_name' => 'GurkyNet Seed',
            'support_email' => 'old@gurkynet.test',
        ]);

        $payload = [
            'website_name' => 'PT GurkyNet Digital',
            'office_address' => 'Jl. Merdeka No. 1',
            'support_phone' => '021-555000',
            'support_email' => 'cs@gurkynet.test',
            'operating_hours' => 'Senin–Jumat 09:00–17:00 WIB',
        ];

        $this->patchJson("/api/v1/admin/website/settings/{$setting->id}", $payload)
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.websiteName', 'PT GurkyNet Digital')
            ->assertJsonPath('data.operatingHours', 'Senin–Jumat 09:00–17:00 WIB')
            ->assertJsonPath('data.officeAddress', 'Jl. Merdeka No. 1');

        $this->assertDatabaseHas('website_settings', [
            'id' => $setting->id,
            'website_name' => 'PT GurkyNet Digital',
            'operating_hours' => 'Senin–Jumat 09:00–17:00 WIB',
            'support_email' => 'cs@gurkynet.test',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'activity' => 'MARKETING_UPDATE_COMPANY_SETTINGS',
        ]);

        $public = $this->getJson('/api/v1/public/settings');
        $public->assertStatus(200)
            ->assertJsonPath('data.operatingHours', 'Senin–Jumat 09:00–17:00 WIB')
            ->assertJsonPath('data.websiteName', 'PT GurkyNet Digital');

        $help = $this->actingAs($this->agent)->getJson('/api/v1/help');
        $help->assertStatus(200)
            ->assertJsonPath('data.operatingHours', 'Senin–Jumat 09:00–17:00 WIB');
    }

    public function test_fr_mkt01_operating_hours_max_length_validated(): void
    {
        Sanctum::actingAs($this->marketing);
        $setting = WebsiteSetting::create(['website_name' => 'GurkyNet']);

        $this->patchJson("/api/v1/admin/website/settings/{$setting->id}", [
            'operating_hours' => str_repeat('x', 256),
        ])->assertStatus(422);
    }

    public function test_fr_mkt01_unauthorized_roles_cannot_mutate_company_identity(): void
    {
        $setting = WebsiteSetting::create(['website_name' => 'GurkyNet Locked']);

        foreach ([$this->finance, $this->operations, $this->cs, $this->agent] as $user) {
            Sanctum::actingAs($user);
            $this->patchJson("/api/v1/admin/website/settings/{$setting->id}", [
                'website_name' => 'Hacked',
                'operating_hours' => '00:00–24:00',
            ])->assertStatus(403);
        }

        $this->assertDatabaseHas('website_settings', [
            'id' => $setting->id,
            'website_name' => 'GurkyNet Locked',
        ]);
    }

    // ─── FR-MKT04 ───────────────────────────────────────────────

    public function test_fr_mkt04_png_and_svg_logo_upload_accepted(): void
    {
        Sanctum::actingAs($this->marketing);

        $png = UploadedFile::fake()->image('logo.png', 64, 64);
        $pngResp = $this->post('/api/v1/admin/media', [
            'file' => $png,
            'folder' => 'logos',
        ], ['Accept' => 'application/json']);
        $pngResp->assertStatus(201)->assertJsonPath('success', true);
        $pngId = $pngResp->json('data.id');
        $this->assertNotEmpty($pngResp->json('data.url'));

        $svgContent = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#0ea5e9"/></svg>';
        $svg = UploadedFile::fake()->createWithContent('logo.svg', $svgContent);
        $svgResp = $this->post('/api/v1/admin/media', [
            'file' => $svg,
            'folder' => 'logos',
        ], ['Accept' => 'application/json']);
        $svgResp->assertStatus(201)->assertJsonPath('success', true);
        $svgId = $svgResp->json('data.id');

        $setting = WebsiteSetting::create(['website_name' => 'Brand']);
        $this->patchJson("/api/v1/admin/website/settings/{$setting->id}", [
            'logo_media_id' => $pngId,
            'logo_dark_media_id' => $svgId,
            'favicon_media_id' => $pngId,
        ])->assertStatus(200)
            ->assertJsonPath('data.logoMediaId', $pngId)
            ->assertJsonPath('data.logoDarkMediaId', $svgId)
            ->assertJsonPath('data.faviconMediaId', $pngId);

        $publicUrl = $svgResp->json('data.url');
        $this->assertIsString($publicUrl);
    }

    public function test_fr_mkt04_invalid_and_oversized_files_rejected(): void
    {
        Sanctum::actingAs($this->marketing);

        $exe = UploadedFile::fake()->create('malware.exe', 100, 'application/octet-stream');
        $this->post('/api/v1/admin/media', [
            'file' => $exe,
            'folder' => 'logos',
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $badSvg = UploadedFile::fake()->createWithContent(
            'evil.svg',
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        );
        $this->post('/api/v1/admin/media', [
            'file' => $badSvg,
            'folder' => 'logos',
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $huge = UploadedFile::fake()->create('big.png', 6000, 'image/png');
        $this->post('/api/v1/admin/media', [
            'file' => $huge,
            'folder' => 'logos',
        ], ['Accept' => 'application/json'])->assertStatus(422);
    }

    // ─── FR-MKT06 ───────────────────────────────────────────────

    public function test_fr_mkt06_banner_crud_order_schedule_public_and_audit(): void
    {
        Sanctum::actingAs($this->marketing);

        $createA = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'Banner A',
            'image_url' => 'https://cdn.example.com/a.jpg',
            'is_active' => true,
            'sort_order' => 2,
            'starts_at' => now()->subDay()->toIso8601String(),
            'ends_at' => now()->addWeek()->toIso8601String(),
        ]);
        $createA->assertStatus(201);
        $idA = $createA->json('data.id');

        $createB = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'Banner B First',
            'image_url' => 'https://cdn.example.com/b.jpg',
            'is_active' => true,
            'sort_order' => 1,
            'starts_at' => now()->subHour()->toIso8601String(),
            'ends_at' => now()->addDays(3)->toIso8601String(),
        ]);
        $createB->assertStatus(201);
        $idB = $createB->json('data.id');

        $upcoming = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'Upcoming',
            'image_url' => 'https://cdn.example.com/u.jpg',
            'is_active' => true,
            'sort_order' => 0,
            'starts_at' => now()->addDay()->toIso8601String(),
            'ends_at' => now()->addMonth()->toIso8601String(),
        ]);
        $upcoming->assertStatus(201);
        $idUpcoming = $upcoming->json('data.id');

        $inactive = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'Inactive',
            'image_url' => 'https://cdn.example.com/i.jpg',
            'is_active' => false,
            'sort_order' => 0,
        ]);
        $inactive->assertStatus(201);
        $idInactive = $inactive->json('data.id');

        $list = $this->getJson('/api/v1/admin/marketing/banners');
        $list->assertStatus(200);
        $this->assertGreaterThanOrEqual(4, count($list->json('data')));

        $this->putJson("/api/v1/admin/marketing/banners/{$idA}", [
            'title' => 'Banner A Updated',
            'sort_order' => 3,
        ])->assertStatus(200)->assertJsonPath('data.title', 'Banner A Updated');

        $this->assertDatabaseHas('activity_logs', ['activity' => 'MARKETING_CREATE_BANNER']);
        $this->assertDatabaseHas('activity_logs', ['activity' => 'MARKETING_UPDATE_BANNER']);

        $public = $this->getJson('/api/v1/public/banners');
        $public->assertStatus(200);
        $titles = collect($public->json('data'))->pluck('title')->all();
        $this->assertSame(['Banner B First', 'Banner A Updated'], $titles);
        $this->assertNotContains('Upcoming', $titles);
        $this->assertNotContains('Inactive', $titles);

        $this->deleteJson("/api/v1/admin/marketing/banners/{$idB}")->assertStatus(200);
        $this->assertSoftDeleted('banner_promotions', ['id' => $idB]);
        $this->assertDatabaseHas('activity_logs', ['activity' => 'MARKETING_DELETE_BANNER']);

        $publicAfter = $this->getJson('/api/v1/public/banners');
        $titlesAfter = collect($publicAfter->json('data'))->pluck('title')->all();
        $this->assertSame(['Banner A Updated'], $titlesAfter);
        $this->assertNotContains('Banner B First', $titlesAfter);

        // Keep fixtures referenced so static analysis is happy.
        $this->assertNotNull(BannerPromotion::withTrashed()->find($idUpcoming));
        $this->assertNotNull(BannerPromotion::find($idInactive));
    }

    public function test_fr_mkt06_non_marketing_cannot_mutate_banners(): void
    {
        foreach ([$this->finance, $this->operations, $this->cs, $this->agent] as $user) {
            Sanctum::actingAs($user);
            $this->postJson('/api/v1/admin/marketing/banners', [
                'title' => 'Nope',
                'image_url' => 'https://cdn.example.com/x.jpg',
                'is_active' => true,
            ])->assertStatus(403);
        }
    }
}
