<?php

namespace Tests\Feature\Public;

use App\Models\BannerPromotion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicBannerCmsTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_banners_only_returns_active_window_ordered(): void
    {
        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Expired Banner',
            'slug' => 'expired-banner',
            'image_url' => 'https://example.com/a.jpg',
            'is_active' => true,
            'starts_at' => now()->subMonth(),
            'ends_at' => now()->subDay(),
            'sort_order' => 1,
            'priority' => 99,
        ]);

        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Upcoming Banner',
            'slug' => 'upcoming-banner',
            'image_url' => 'https://example.com/b.jpg',
            'is_active' => true,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addMonth(),
            'sort_order' => 2,
            'priority' => 50,
        ]);

        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Live Second',
            'slug' => 'live-second',
            'code' => 'SECOND',
            'image_url' => 'https://example.com/c.jpg',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addWeek(),
            'sort_order' => 2,
            'priority' => 1,
        ]);

        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Live First',
            'slug' => 'live-first',
            'code' => 'FIRST',
            'description' => 'Deskripsi promo',
            'terms' => 'Syarat satu',
            'cta_label' => 'Gunakan Promo',
            'redirect_url' => '/dashboard/pulsa',
            'image_url' => 'https://example.com/d.jpg',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addWeek(),
            'sort_order' => 1,
            'priority' => 10,
        ]);

        $response = $this->getJson('/api/v1/public/banners');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $ids = collect($response->json('data'))->pluck('slug')->all();
        $this->assertSame(['live-first', 'live-second'], $ids);
        $this->assertSame('active', $response->json('data.0.status'));
    }

    public function test_public_banner_detail_by_slug_includes_cms_fields(): void
    {
        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Flash Sale',
            'slug' => 'flash-sale',
            'code' => 'FLASHSALE',
            'description' => 'Diskon spesial',
            'terms' => "1. Berlaku hari ini\n2. Kuota terbatas",
            'cta_label' => 'Gunakan Promo',
            'redirect_url' => '/dashboard/pulsa',
            'image_url' => 'https://example.com/flash.jpg',
            'is_active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDays(3),
            'priority' => 5,
            'sort_order' => 1,
        ]);

        $response = $this->getJson('/api/v1/public/banners/flash-sale');

        $response->assertOk()
            ->assertJsonPath('data.slug', 'flash-sale')
            ->assertJsonPath('data.promoCode', 'FLASHSALE')
            ->assertJsonPath('data.ctaLabel', 'Gunakan Promo')
            ->assertJsonPath('data.terms', "1. Berlaku hari ini\n2. Kuota terbatas")
            ->assertJsonPath('data.status', 'active');
    }

    public function test_inactive_banner_detail_is_hidden(): void
    {
        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Hidden',
            'slug' => 'hidden-promo',
            'image_url' => 'https://example.com/h.jpg',
            'is_active' => false,
        ]);

        $this->getJson('/api/v1/public/banners/hidden-promo')
            ->assertStatus(404);
    }

    public function test_marketing_can_persist_full_cms_banner_fields(): void
    {
        $user = \App\Models\User::create([
            'name' => 'Marketing CMS',
            'email' => 'mkt-cms@gurkypay.com',
            'phone_number' => '081299900011',
            'password' => bcrypt('password123'),
            'role' => \App\Enums\UserRole::MARKETING,
            'transaction_pin' => bcrypt('123456'),
        ]);

        \Laravel\Sanctum\Sanctum::actingAs($user);

        $create = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'Promo CMS Full',
            'slug' => 'promo-cms-full',
            'code' => 'CMSFULL',
            'description' => 'Deskripsi lengkap',
            'terms' => 'Syarat lengkap',
            'link_url' => '/dashboard/game',
            'cta_label' => 'Main Sekarang',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(10)->toDateString(),
            'priority' => 8,
            'sort_order' => 3,
            'image_url' => 'https://example.com/cms.jpg',
            'is_active' => true,
        ]);

        $create->assertCreated()
            ->assertJsonPath('data.slug', 'promo-cms-full')
            ->assertJsonPath('data.promoCode', 'CMSFULL')
            ->assertJsonPath('data.ctaLabel', 'Main Sekarang')
            ->assertJsonPath('data.redirectUrl', '/dashboard/game')
            ->assertJsonPath('data.terms', 'Syarat lengkap');

        $this->assertDatabaseHas('banner_promotions', [
            'slug' => 'promo-cms-full',
            'code' => 'CMSFULL',
            'cta_label' => 'Main Sekarang',
            'redirect_url' => '/dashboard/game',
            'priority' => 8,
            'sort_order' => 3,
        ]);
    }
}
