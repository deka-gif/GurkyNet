<?php

namespace Tests\Feature\Public;

use App\Models\HomepageSection;
use App\Models\User;
use App\Models\WebsiteSetting;
use App\Enums\UserRole;
use App\Services\Website\PublicHomepageCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PublicHomepageCacheTest extends TestCase
{
    use RefreshDatabase;

    public function test_homepage_payload_is_cached_and_served_once_from_cache(): void
    {
        Cache::flush();
        WebsiteSetting::query()->delete();
        HomepageSection::query()->delete();

        HomepageSection::create([
            'title' => 'Hero',
            'slug' => 'hero-test',
            'component_type' => 'hero',
            'display_order' => 1,
            'visible' => true,
            'status' => 'active',
            'description' => 'Hello',
            'animation' => 'fade',
        ]);

        $first = $this->getJson('/api/v1/public/homepage');
        $first->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'settings',
                    'sections',
                    'banners',
                    'homepageCategories',
                    'featuredProducts',
                    'faqs',
                    'menus',
                    'pages',
                    'seo',
                ],
            ]);

        $this->assertTrue(Cache::has(PublicHomepageCache::KEY));

        // Mutate DB without going through CMS action (simulates stale cache window)
        HomepageSection::where('slug', 'hero-test')->update(['title' => 'Hero Changed']);

        $second = $this->getJson('/api/v1/public/homepage');
        $second->assertOk();
        $titles = collect($second->json('data.sections'))->pluck('title')->all();
        $this->assertContains('Hero', $titles);
        $this->assertNotContains('Hero Changed', $titles);
    }

    public function test_marketing_section_update_invalidates_homepage_cache(): void
    {
        Cache::flush();

        $section = HomepageSection::create([
            'title' => 'Hero',
            'slug' => 'hero-invalidate',
            'component_type' => 'hero',
            'display_order' => 1,
            'visible' => true,
            'status' => 'active',
            'description' => 'Hello',
        ]);

        $this->getJson('/api/v1/public/homepage')->assertOk();
        $this->assertTrue(Cache::has(PublicHomepageCache::KEY));

        $user = User::create([
            'name' => 'Marketing',
            'email' => 'mkt-home@gurkypay.com',
            'phone_number' => '081299900088',
            'password' => Hash::make('password123'),
            'role' => UserRole::MARKETING,
            'transaction_pin' => Hash::make('123456'),
        ]);
        Sanctum::actingAs($user);

        $this->putJson("/api/v1/admin/website/homepage-sections/{$section->id}", [
            'title' => 'Hero Updated',
            'subtitle' => 'Sub CMS',
            'button_label' => 'Mulai',
            'button_url' => '/register',
            'animation' => 'slide_up',
        ])->assertOk();

        $this->assertFalse(Cache::has(PublicHomepageCache::KEY));

        $fresh = $this->getJson('/api/v1/public/homepage');
        $fresh->assertOk();
        $hero = collect($fresh->json('data.sections'))->firstWhere('slug', 'hero-invalidate');
        $this->assertSame('Hero Updated', $hero['title'] ?? null);
        $this->assertSame('Sub CMS', $hero['subtitle'] ?? null);
        $this->assertSame('Mulai', $hero['buttonLabel'] ?? null);
        $this->assertSame('slide_up', $hero['animation'] ?? null);
    }
}
