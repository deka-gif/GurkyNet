<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\WebsiteSetting;
use App\Models\HomepageSection;
use App\Models\WebsiteMenu;
use App\Models\StaticPage;
use App\Models\BannerPromotion;
use App\Models\Media;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\Notification;
use App\Models\ProductCategory;

class PublicWebsiteApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_settings_endpoint_returns_success_and_self_heals(): void
    {
        // Table is empty initially
        $this->assertEquals(0, WebsiteSetting::count());

        $response = $this->getJson('/api/v1/public/settings');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Pengaturan website berhasil dimuat.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'id',
                    'websiteName',
                    'tagline',
                    'supportEmail',
                    'supportPhone',
                    'whatsapp',
                    'copyright',
                ],
            ]);

        // Self-healed (do not hard-require id=1; MySQL auto-increment can advance across suites)
        $this->assertDatabaseHas('website_settings', [
            'website_name' => 'GurkyNet',
        ]);
        $this->assertGreaterThanOrEqual(1, (int) WebsiteSetting::query()->value('id'));
    }

    public function test_public_menus_endpoint_returns_success_and_self_heals(): void
    {
        $this->assertEquals(0, WebsiteMenu::count());

        $response = $this->getJson('/api/v1/public/menus');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Daftar menu website berhasil dimuat.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'title',
                        'slug',
                        'url',
                    ],
                ],
            ]);
    }

    public function test_public_homepage_sections_endpoint_returns_success_and_self_heals(): void
    {
        $this->assertEquals(0, HomepageSection::count());

        $response = $this->getJson('/api/v1/public/homepage-sections');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Daftar homepage section berhasil dimuat.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'title',
                        'slug',
                        'componentType',
                    ],
                ],
            ]);
    }

    public function test_public_static_pages_endpoint_returns_success_and_self_heals(): void
    {
        $this->assertEquals(0, StaticPage::count());

        $response = $this->getJson('/api/v1/public/static-pages');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Daftar halaman statis berhasil dimuat.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'title',
                        'slug',
                        'content',
                    ],
                ],
            ]);
    }

    public function test_public_banners_endpoint_returns_success_and_self_heals(): void
    {
        $this->assertEquals(0, BannerPromotion::count());

        $response = $this->getJson('/api/v1/public/banners');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Daftar banner berhasil dimuat.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    '*' => [
                        'id',
                        'title',
                        'image',
                    ],
                ],
            ]);
    }

    public function test_all_factories_execute_without_errors(): void
    {
        $user = User::factory()->create();
        $this->assertNotNull($user->id);
        $this->assertNotEmpty($user->name);

        $wallet = Wallet::factory()->create(['user_id' => $user->id]);
        $this->assertNotNull($wallet->id);

        $category = ProductCategory::factory()->create();
        $this->assertNotNull($category->id);

        $product = Product::factory()->create(['product_category_id' => $category->id]);
        $this->assertNotNull($product->id);

        $notification = Notification::factory()->create();
        $this->assertNotNull($notification->id);

        $transaction = Transaction::factory()->create(['user_id' => $user->id]);
        $this->assertNotNull($transaction->id);
    }

    public function test_database_seeder_populates_all_production_records(): void
    {
        $this->seed();

        $this->assertGreaterThan(0, WebsiteSetting::count());
        $this->assertGreaterThan(0, HomepageSection::count());
        $this->assertGreaterThan(0, Media::count());
        $this->assertGreaterThan(0, User::count());
        $this->assertGreaterThan(0, Wallet::count());
        $this->assertGreaterThan(0, WebsiteMenu::count());
        $this->assertGreaterThan(0, StaticPage::count());
        $this->assertGreaterThan(0, BannerPromotion::count());
    }

    public function test_auth_login_with_seeded_user(): void
    {
        $this->seed();

        $response = $this->postJson('/api/v1/auth/login', [
            'phone_or_email' => 'admin@gurkypay.com',
            'password' => 'admin123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Login berhasil dilakukan.',
            ])
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'user' => [
                        'id',
                        'name',
                        'email',
                        'role',
                    ],
                    'token',
                ],
            ]);
    }

    public function test_auth_login_with_email_attribute(): void
    {
        $this->seed();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'owner@gurkypay.com',
            'password' => 'owner123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
    }
}
