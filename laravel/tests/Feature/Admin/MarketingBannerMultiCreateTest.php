<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\BannerPromotion;
use App\Models\Media;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Regression: creating 2+ banners must not return Server Error (SQL 500).
 * Root causes covered: NULL image_url with media_id, soft-deleted slug unique.
 */
class MarketingBannerMultiCreateTest extends TestCase
{
    use RefreshDatabase;

    protected User $marketing;

    protected Media $media;

    protected function setUp(): void
    {
        parent::setUp();

        $this->marketing = User::create([
            'name' => 'Marketing Multi',
            'email' => 'mkt-multi@gurkypay.com',
            'phone_number' => '081211122233',
            'password' => Hash::make('password123'),
            'role' => UserRole::MARKETING,
            'transaction_pin' => Hash::make('123456'),
        ]);

        $this->media = Media::create([
            'filename' => 'banner-web.png',
            'original_name' => 'banner-web.png',
            'mime_type' => 'image/png',
            'extension' => 'png',
            'size' => 1200,
            'width' => 1920,
            'height' => 420,
            'alt_text' => 'Banner',
            'folder' => 'banners',
            'storage_disk' => 'public',
            'url' => 'banners/banner-web.png',
            'uploaded_by' => 'test',
        ]);

        Sanctum::actingAs($this->marketing);
    }

    public function test_can_create_multiple_banners_with_media_id_only(): void
    {
        foreach ([1, 2, 3] as $n) {
            $response = $this->postJson('/api/v1/admin/marketing/banners', [
                'title' => "Banner Multi {$n}",
                'image_media_id' => $this->media->id,
                'image_url' => null,
                'is_active' => true,
                'sort_order' => $n,
            ]);

            $response->assertCreated()
                ->assertJsonPath('success', true)
                ->assertJsonPath('data.title', "Banner Multi {$n}");
        }

        $this->assertSame(3, BannerPromotion::where('type', 'banner')->count());

        $public = $this->getJson('/api/v1/public/banners');
        $public->assertOk();
        $this->assertCount(3, $public->json('data'));
    }

    public function test_soft_deleted_slug_does_not_cause_server_error(): void
    {
        $first = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'Slug Clash',
            'slug' => 'slug-clash',
            'image_media_id' => $this->media->id,
            'is_active' => true,
        ]);
        $first->assertCreated();

        $id = $first->json('data.id');
        $this->deleteJson("/api/v1/admin/marketing/banners/{$id}")->assertOk();

        $second = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'Slug Clash Again',
            'slug' => 'slug-clash',
            'image_media_id' => $this->media->id,
            'is_active' => true,
        ]);

        // Must not be 500 — soft-deleted slug is auto-suffixed (or 422 if active conflict).
        $this->assertNotSame(500, $second->status(), $second->getContent());
        $second->assertCreated();
        $this->assertNotSame('slug-clash', $second->json('data.slug'));
    }

    public function test_can_create_banner_with_mobile_media_only(): void
    {
        $mobile = Media::create([
            'filename' => 'banner-mobile.png',
            'original_name' => 'banner-mobile.png',
            'mime_type' => 'image/png',
            'extension' => 'png',
            'size' => 800,
            'width' => 1080,
            'height' => 450,
            'alt_text' => 'Mobile',
            'folder' => 'banners',
            'storage_disk' => 'public',
            'url' => 'banners/banner-mobile.png',
            'uploaded_by' => 'test',
        ]);

        // Matches production CMS payload that caused 500 (2026-09-06): only mobile_image_media_id set.
        $response = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'Mobile Only Banner',
            'image_url' => null,
            'image_media_id' => null,
            'mobile_image_media_id' => $mobile->id,
            'cta_label' => 'Gunakan Promo',
            'is_active' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.title', 'Mobile Only Banner');

        $this->assertDatabaseHas('banner_promotions', [
            'title' => 'Mobile Only Banner',
            'mobile_image_media_id' => $mobile->id,
            'image_url' => 'banners/banner-mobile.png',
        ]);
    }

    public function test_reject_create_without_image(): void
    {
        $response = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'No Image',
            'is_active' => true,
        ]);

        $response->assertStatus(422);
    }
}
