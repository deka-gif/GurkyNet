<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Models\WebsiteSetting;
use App\Models\HomepageSection;
use App\Models\WebsiteMenu;
use App\Models\StaticPage;
use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WebsiteContentTest extends TestCase
{
    use RefreshDatabase;

    protected User $marketingUser;
    protected User $ownerUser;
    protected User $regularUser;
    protected User $superAdminUser;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Marketing User
        $this->marketingUser = User::create([
            'name' => 'Marketing Admin',
            'email' => 'marketing@gurkypay.com',
            'phone_number' => '081222222225',
            'password' => Hash::make('password123'),
            'role' => UserRole::MARKETING,
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

        // 3. Regular User
        $this->regularUser = User::create([
            'name' => 'Budi Customer',
            'email' => 'budi@gurkypay.com',
            'phone_number' => '081555555555',
            'password' => Hash::make('password123'),
            'role' => UserRole::USER,
            'transaction_pin' => Hash::make('123456'),
        ]);

        // 4. Super Admin User
        $this->superAdminUser = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@gurkypay.com',
            'phone_number' => '081666666666',
            'password' => Hash::make('password123'),
            'role' => UserRole::SUPER_ADMIN,
            'transaction_pin' => Hash::make('123456'),
        ]);
    }

    /** ==========================================
     *  ROLE AUTHORIZATION TESTS
     *  ========================================== */

    public function test_regular_user_cannot_access_website_settings_endpoints(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->getJson('/api/v1/admin/website/settings');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_marketing_user_can_access_website_settings_endpoints(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $response = $this->getJson('/api/v1/admin/website/settings');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_owner_user_can_access_website_settings_endpoints(): void
    {
        Sanctum::actingAs($this->ownerUser);

        $response = $this->getJson('/api/v1/admin/website/settings');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_super_admin_user_can_access_website_settings_endpoints(): void
    {
        Sanctum::actingAs($this->superAdminUser);

        $response = $this->getJson('/api/v1/admin/website/settings');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }

    /** ==========================================
     *  WEBSITE SETTINGS CRUD TESTS
     *  ========================================== */

    public function test_can_create_website_setting(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $payload = [
            'website_name' => 'GurkyPay Portal',
            'tagline' => 'Fastest Payment Engine',
            'logo' => 'https://image.url/logo.png',
            'logo_dark' => 'https://image.url/logo_dark.png',
            'favicon' => 'https://image.url/favicon.ico',
            'support_email' => 'support@gurkypay.com',
            'support_phone' => '021-1234567',
            'whatsapp' => '081234567890',
            'office_address' => 'Gurky Tower Jakarta',
            'google_maps_url' => 'https://maps.google.com/gurky',
            'facebook' => 'https://facebook.com/gurkypay',
            'instagram' => 'https://instagram.com/gurkypay',
            'tiktok' => 'https://tiktok.com/@gurkypay',
            'youtube' => 'https://youtube.com/gurkypay',
            'twitter' => 'https://twitter.com/gurkypay',
            'copyright' => '© 2026 GurkyPay',
            'maintenance_mode' => false,
            'timezone' => 'Asia/Jakarta',
            'currency' => 'IDR',
            'language' => 'id',
        ];

        $response = $this->postJson('/api/v1/admin/website/settings', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Pengaturan website berhasil dibuat.',
            ])
            ->assertJsonPath('data.websiteName', 'GurkyPay Portal')
            ->assertJsonPath('data.timezone', 'Asia/Jakarta');

        $this->assertDatabaseHas('website_settings', [
            'website_name' => 'GurkyPay Portal',
            'timezone' => 'Asia/Jakarta',
        ]);
    }

    public function test_can_show_website_setting(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $setting = WebsiteSetting::create([
            'website_name' => 'Initial Web',
            'maintenance_mode' => true,
        ]);

        $response = $this->getJson("/api/v1/admin/website/settings/{$setting->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonPath('data.websiteName', 'Initial Web')
            ->assertJsonPath('data.maintenanceMode', true);
    }

    public function test_can_update_website_setting(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $setting = WebsiteSetting::create([
            'website_name' => 'Old Name',
            'maintenance_mode' => false,
        ]);

        $payload = [
            'website_name' => 'Updated Name',
            'maintenance_mode' => true,
        ];

        $response = $this->putJson("/api/v1/admin/website/settings/{$setting->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Pengaturan website berhasil diperbarui.',
            ])
            ->assertJsonPath('data.websiteName', 'Updated Name')
            ->assertJsonPath('data.maintenanceMode', true);

        $this->assertDatabaseHas('website_settings', [
            'id' => $setting->id,
            'website_name' => 'Updated Name',
            'maintenance_mode' => 1,
        ]);
    }

    public function test_can_delete_website_setting(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $setting = WebsiteSetting::create([
            'website_name' => 'Temporary Setting',
        ]);

        $response = $this->deleteJson("/api/v1/admin/website/settings/{$setting->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Pengaturan website berhasil dihapus.',
            ]);

        $this->assertDatabaseMissing('website_settings', [
            'id' => $setting->id,
        ]);
    }

    /** ==========================================
     *  HOMEPAGE SECTION CRUD TESTS
     *  ========================================== */

    public function test_can_create_homepage_section(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $payload = [
            'title' => 'Promo Banner Hero',
            'slug' => 'promo-banner-hero',
            'component_type' => 'hero',
            'display_order' => 1,
            'visible' => true,
            'status' => 'active',
            'description' => 'Featured banner for top promotion',
        ];

        $response = $this->postJson('/api/v1/admin/website/homepage-sections', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Homepage section berhasil dibuat.',
            ])
            ->assertJsonPath('data.slug', 'promo-banner-hero')
            ->assertJsonPath('data.componentType', 'hero');

        $this->assertDatabaseHas('homepage_sections', [
            'slug' => 'promo-banner-hero',
            'component_type' => 'hero',
        ]);
    }

    public function test_cannot_create_homepage_section_with_invalid_component_type(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $payload = [
            'title' => 'Invalid Section',
            'slug' => 'invalid-section',
            'component_type' => 'slider_custom', // invalid type
        ];

        $response = $this->postJson('/api/v1/admin/website/homepage-sections', $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['component_type']);
    }

    public function test_can_list_homepage_sections_with_pagination(): void
    {
        Sanctum::actingAs($this->marketingUser);

        HomepageSection::create([
            'title' => 'Hero Banner',
            'slug' => 'hero-banner',
            'component_type' => 'hero',
            'display_order' => 1,
        ]);

        HomepageSection::create([
            'title' => 'Footer Links',
            'slug' => 'footer-links',
            'component_type' => 'footer',
            'display_order' => 10,
        ]);

        $response = $this->getJson('/api/v1/admin/website/homepage-sections?per_page=1');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonPath('pagination.perPage', 1);
    }

    public function test_can_update_homepage_section(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $section = HomepageSection::create([
            'title' => 'Old Title',
            'slug' => 'old-title',
            'component_type' => 'faq',
            'display_order' => 5,
        ]);

        $payload = [
            'title' => 'New Title',
            'display_order' => 6,
        ];

        $response = $this->putJson("/api/v1/admin/website/homepage-sections/{$section->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Homepage section berhasil diperbarui.',
            ])
            ->assertJsonPath('data.title', 'New Title')
            ->assertJsonPath('data.displayOrder', 6);

        $this->assertDatabaseHas('homepage_sections', [
            'id' => $section->id,
            'title' => 'New Title',
            'display_order' => 6,
        ]);
    }

    public function test_can_delete_homepage_section(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $section = HomepageSection::create([
            'title' => 'Section to Delete',
            'slug' => 'to-delete',
            'component_type' => 'news',
        ]);

        $response = $this->deleteJson("/api/v1/admin/website/homepage-sections/{$section->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Homepage section berhasil dihapus.',
            ]);

        $this->assertDatabaseMissing('homepage_sections', [
            'id' => $section->id,
        ]);
    }

    /** ==========================================
     *  WEBSITE MENU CRUD TESTS
     *  ========================================== */

    public function test_can_create_website_menu(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $payload = [
            'title' => 'About Us Link',
            'slug' => 'about-us-link',
            'url' => '/about-us',
            'icon' => 'info',
            'display_order' => 3,
            'visible' => true,
            'open_in_new_tab' => false,
        ];

        $response = $this->postJson('/api/v1/admin/website/menus', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Menu website berhasil dibuat.',
            ])
            ->assertJsonPath('data.url', '/about-us')
            ->assertJsonPath('data.icon', 'info');

        $this->assertDatabaseHas('website_menus', [
            'url' => '/about-us',
            'icon' => 'info',
        ]);
    }

    public function test_can_update_website_menu(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $menu = WebsiteMenu::create([
            'title' => 'Home',
            'url' => '/',
            'display_order' => 1,
        ]);

        $payload = [
            'title' => 'Homepage Updated',
            'display_order' => 2,
        ];

        $response = $this->putJson("/api/v1/admin/website/menus/{$menu->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Menu website berhasil diperbarui.',
            ])
            ->assertJsonPath('data.title', 'Homepage Updated')
            ->assertJsonPath('data.displayOrder', 2);

        $this->assertDatabaseHas('website_menus', [
            'id' => $menu->id,
            'title' => 'Homepage Updated',
        ]);
    }

    public function test_can_delete_website_menu(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $menu = WebsiteMenu::create([
            'title' => 'Delete Me',
            'url' => '/delete-me',
        ]);

        $response = $this->deleteJson("/api/v1/admin/website/menus/{$menu->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Menu website berhasil dihapus.',
            ]);

        $this->assertDatabaseMissing('website_menus', [
            'id' => $menu->id,
        ]);
    }

    /** ==========================================
     *  STATIC PAGE CRUD TESTS
     *  ========================================== */

    public function test_can_create_static_page(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $payload = [
            'title' => 'Privacy Policy',
            'slug' => 'privacy-policy',
            'content' => '<h1>Privacy Policy</h1><p>We respect your privacy.</p>',
            'seo_title' => 'Privacy Policy - GurkyPay',
            'seo_description' => 'Read our privacy policy to understand how we protect your information.',
            'status' => 'published',
            'published_at' => '2026-07-31 12:00:00',
        ];

        $response = $this->postJson('/api/v1/admin/website/static-pages', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Halaman statis berhasil dibuat.',
            ])
            ->assertJsonPath('data.slug', 'privacy-policy')
            ->assertJsonPath('data.status', 'published');

        $this->assertDatabaseHas('static_pages', [
            'slug' => 'privacy-policy',
            'status' => 'published',
        ]);
    }

    public function test_can_update_static_page(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $page = StaticPage::create([
            'title' => 'Terms of Service',
            'slug' => 'terms-of-service',
            'content' => 'Original Terms',
            'status' => 'draft',
        ]);

        $payload = [
            'content' => 'Updated Terms and Conditions',
            'status' => 'published',
        ];

        $response = $this->putJson("/api/v1/admin/website/static-pages/{$page->id}", $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Halaman statis berhasil diperbarui.',
            ])
            ->assertJsonPath('data.content', 'Updated Terms and Conditions')
            ->assertJsonPath('data.status', 'published');

        $this->assertDatabaseHas('static_pages', [
            'id' => $page->id,
            'content' => 'Updated Terms and Conditions',
            'status' => 'published',
        ]);
    }

    public function test_can_delete_static_page(): void
    {
        Sanctum::actingAs($this->marketingUser);

        $page = StaticPage::create([
            'title' => 'Page to Delete',
            'slug' => 'delete-this-page',
            'content' => 'Deletable Content',
        ]);

        $response = $this->deleteJson("/api/v1/admin/website/static-pages/{$page->id}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Halaman statis berhasil dihapus.',
            ]);

        $this->assertDatabaseMissing('static_pages', [
            'id' => $page->id,
        ]);
    }
}
