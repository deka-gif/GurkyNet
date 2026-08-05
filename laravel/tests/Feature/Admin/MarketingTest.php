<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Models\BannerPromotion;
use App\Models\Notification;
use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MarketingTest extends TestCase
{
    use RefreshDatabase;

    protected User $marketingUser;
    protected User $ownerUser;
    protected User $regularUser;

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
    }

    public function test_unauthorized_user_cannot_access_marketing_dashboard(): void
    {
        Sanctum::actingAs($this->regularUser);

        $response = $this->getJson('/api/v1/admin/marketing/dashboard');

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
            ]);
    }

    public function test_marketing_user_can_access_dashboard(): void
    {
        Sanctum::actingAs($this->marketingUser);

        // Seed some data first
        BannerPromotion::create([
            'type' => 'banner',
            'title' => 'Test Banner 1',
            'image_url' => 'http://test.com/banner1.png',
            'is_active' => true,
        ]);

        BannerPromotion::create([
            'type' => 'promotion',
            'title' => 'Test Promo 1',
            'code' => 'PROMO1',
            'discount_amount' => 10000,
            'discount_type' => 'fixed',
            'image_url' => 'http://test.com/promo1.png',
            'is_active' => true,
        ]);

        BannerPromotion::create([
            'type' => 'voucher',
            'title' => 'Test Voucher 1',
            'code' => 'VOUCHER1',
            'discount_amount' => 5000,
            'discount_type' => 'fixed',
            'quota' => 100,
            'used_count' => 10,
            'image_url' => 'http://test.com/voucher1.png',
            'is_active' => true,
        ]);

        Notification::create([
            'type' => 'announcement',
            'title' => 'Test Announce 1',
            'message' => 'Announcement message',
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/v1/admin/marketing/dashboard');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'campaign_summary' => [
                        'banner_count',
                        'promotion_count',
                        'voucher_count',
                        'announcement_count',
                        'total_campaigns',
                        'active_campaigns',
                    ],
                    'campaign_performance' => [
                        'total_views',
                        'total_clicks',
                        'ctr_percentage',
                        'total_vouchers_redeemed',
                        'total_quota_available',
                        'conversion_rate',
                    ],
                    'recent_marketing_activities',
                ],
            ]);
    }

    public function test_banner_crud_operations(): void
    {
        Sanctum::actingAs($this->marketingUser);

        // 1. Create
        $response = $this->postJson('/api/v1/admin/marketing/banners', [
            'title' => 'Promo Lebaran',
            'image_url' => 'http://gurkypay.com/lebaran.png',
            'redirect_url' => 'http://gurkypay.com/promo-lebaran',
            'is_active' => true,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Promo Lebaran',
                    'type' => 'banner',
                ],
            ]);

        $bannerId = $response->json('data.id');

        // 2. Read / List
        $response = $this->getJson('/api/v1/admin/marketing/banners?search=Lebaran');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // 3. Update
        $response = $this->putJson("/api/v1/admin/marketing/banners/{$bannerId}", [
            'title' => 'Promo Lebaran Diperbarui',
            'is_active' => false,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Promo Lebaran Diperbarui',
                    'isActive' => false,
                ],
            ]);

        // 4. Delete
        $response = $this->deleteJson("/api/v1/admin/marketing/banners/{$bannerId}");
        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        // Check soft delete
        $this->assertSoftDeleted('banner_promotions', [
            'id' => $bannerId,
        ]);
    }

    public function test_promotion_crud_operations(): void
    {
        Sanctum::actingAs($this->marketingUser);

        // 1. Create
        $response = $this->postJson('/api/v1/admin/marketing/promotions', [
            'title' => 'Cashback 10%',
            'code' => 'CASHBACK10',
            'description' => 'Dapatkan cashback 10% transaksi pulsa',
            'discount_amount' => 10,
            'discount_type' => 'percentage',
            'min_transaction' => 20000,
            'quota' => 50,
            'image_url' => 'http://gurkypay.com/cb10.png',
            'redirect_url' => 'http://gurkypay.com/cashback',
            'is_active' => true,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Cashback 10%',
                    'code' => 'CASHBACK10',
                    'type' => 'promotion',
                ],
            ]);

        $promotionId = $response->json('data.id');

        // 2. Read / List
        $response = $this->getJson('/api/v1/admin/marketing/promotions?search=CASHBACK');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // 3. Update
        $response = $this->putJson("/api/v1/admin/marketing/promotions/{$promotionId}", [
            'title' => 'Cashback 15%',
            'discount_amount' => 15,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Cashback 15%',
                    'discountAmount' => 15,
                ],
            ]);

        // 4. Delete
        $response = $this->deleteJson("/api/v1/admin/marketing/promotions/{$promotionId}");
        $response->assertStatus(200);

        $this->assertSoftDeleted('banner_promotions', [
            'id' => $promotionId,
        ]);
    }

    public function test_voucher_crud_operations(): void
    {
        Sanctum::actingAs($this->marketingUser);

        // 1. Create
        $response = $this->postJson('/api/v1/admin/marketing/vouchers', [
            'title' => 'Voucher Merdeka',
            'code' => 'MERDEKA77',
            'description' => 'Voucher diskon spesial kemerdekaan',
            'discount_amount' => 17000,
            'discount_type' => 'fixed',
            'min_transaction' => 50000,
            'quota' => 100,
            'image_url' => 'http://gurkypay.com/voucher-merdeka.png',
            'is_active' => true,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Voucher Merdeka',
                    'code' => 'MERDEKA77',
                    'type' => 'voucher',
                ],
            ]);

        $voucherId = $response->json('data.id');

        // 2. Read / List
        $response = $this->getJson('/api/v1/admin/marketing/vouchers?search=MERDEKA');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // 3. Update
        $response = $this->putJson("/api/v1/admin/marketing/vouchers/{$voucherId}", [
            'title' => 'Voucher Kemerdekaan RI',
            'quota' => 200,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Voucher Kemerdekaan RI',
                    'quota' => 200,
                ],
            ]);

        // 4. Delete
        $response = $this->deleteJson("/api/v1/admin/marketing/vouchers/{$voucherId}");
        $response->assertStatus(200);

        $this->assertSoftDeleted('banner_promotions', [
            'id' => $voucherId,
        ]);
    }

    public function test_announcement_crud_operations(): void
    {
        Sanctum::actingAs($this->marketingUser);

        // 1. Create
        $response = $this->postJson('/api/v1/admin/marketing/announcements', [
            'title' => 'Pemeliharaan Sistem',
            'message' => 'Sistem akan mengalami pemeliharaan malam ini pukul 00:00 WIB',
            'type' => 'announcement',
            'is_active' => true,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Pemeliharaan Sistem',
                    'type' => 'announcement',
                ],
            ]);

        $announcementId = $response->json('data.id');

        // 2. Read / List
        $response = $this->getJson('/api/v1/admin/marketing/announcements?search=Pemeliharaan');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // 3. Update
        $response = $this->putJson("/api/v1/admin/marketing/announcements/{$announcementId}", [
            'title' => 'Pemeliharaan Server Utama',
            'is_active' => false,
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'title' => 'Pemeliharaan Server Utama',
                    'isActive' => false,
                ],
            ]);

        // 4. Delete
        $response = $this->deleteJson("/api/v1/admin/marketing/announcements/{$announcementId}");
        $response->assertStatus(200);

        $this->assertSoftDeleted('notifications', [
            'id' => $announcementId,
        ]);
    }
}
