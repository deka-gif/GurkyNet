<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\v1\AuthController;
use App\Http\Controllers\Api\v1\WalletController;
use App\Http\Controllers\Api\v1\ProductController;
use App\Http\Controllers\Api\v1\TransactionController;
use App\Http\Controllers\Api\v1\HealthCheckController;
use App\Http\Controllers\Api\v1\Admin\FinanceController;
use App\Http\Controllers\Api\v1\Admin\OperationsController;
use App\Http\Controllers\Api\v1\Admin\MarketingController;
use App\Http\Controllers\Api\v1\Admin\CustomerSupportController;
use App\Http\Controllers\Api\v1\Admin\OwnerController;
use App\Http\Controllers\Api\v1\Admin\WebsiteSettingController;
use App\Http\Controllers\Api\v1\Admin\HomepageSectionController;
use App\Http\Controllers\Api\v1\Admin\WebsiteMenuController;
use App\Http\Controllers\Api\v1\Admin\StaticPageController;
use App\Http\Controllers\Api\v1\ProfileController;
use App\Http\Controllers\Api\v1\Public\PublicWebsiteController;
use App\Http\Middleware\EnsureRole;

/*
|--------------------------------------------------------------------------
| API Routes - GurkyPay Core Engine (v1.0.0)
|--------------------------------------------------------------------------
*/

// Root level health routes for general platform observability
Route::middleware([\App\Http\Middleware\StandardizeApiErrors::class, \App\Http\Middleware\TraceRequest::class])->group(function () {
    Route::get('/health', [HealthCheckController::class, 'health']);
    Route::get('/status', [HealthCheckController::class, 'status']);
    Route::get('/metrics', [HealthCheckController::class, 'metrics']);
});

Route::prefix('v1')->middleware([\App\Http\Middleware\StandardizeApiErrors::class, \App\Http\Middleware\TraceRequest::class])->group(function () {
    
    // Module health routes inside v1
    Route::get('/health', [HealthCheckController::class, 'health']);
    Route::get('/status', [HealthCheckController::class, 'status']);
    Route::get('/metrics', [HealthCheckController::class, 'metrics']);
    
    // Public Website Content Endpoints (no authentication required)
    // These endpoints serve the public-facing frontend: website config, navigation
    // menus, published static pages, and visible homepage sections.
    Route::prefix('public')->group(function () {
        Route::get('/settings',           [PublicWebsiteController::class, 'settings']);
        Route::get('/menus',              [PublicWebsiteController::class, 'menus']);
        Route::get('/static-pages',       [PublicWebsiteController::class, 'staticPages']);
        Route::get('/homepage-sections',  [PublicWebsiteController::class, 'homepageSections']);
        Route::get('/banners', [PublicWebsiteController::class, 'banners']);
    });

    // Product and PPOB Module (Public)
    Route::get('/categories', [ProductController::class, 'indexCategories']);
    Route::get('/categories/{slug}', [ProductController::class, 'showCategory']);
    Route::get('/providers', [ProductController::class, 'indexProviders']);
    Route::get('/products', [ProductController::class, 'indexProducts']);
    Route::get('/products/{sku_code}', [ProductController::class, 'showProduct']);

    // Digiflazz Webhook Callback
    Route::post('/webhooks/digiflazz', [TransactionController::class, 'digiflazzCallback']);

    // Midtrans Webhook Callback
    Route::post('/webhooks/midtrans', [TransactionController::class, 'midtransCallback']);

    // Public Authentication Endpoints
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    
    // OTP Management Endpoints
    Route::post('/auth/otp/request', [AuthController::class, 'requestOtp']);
    Route::post('/auth/otp/verify', [AuthController::class, 'verifyOtp']);
    
    // Forgot Password Reset
    Route::post('/auth/password/reset', [AuthController::class, 'resetPassword']);

    // Protected API Endpoints (Requires Laravel Sanctum)
    Route::middleware('auth:sanctum')->group(function () {
        
        // Session and Profile Management
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/refresh', [AuthController::class, 'refresh']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        
        // Profile & Account Management Module
        Route::prefix('profile')->group(function () {
            Route::get('/', [ProfileController::class, 'show']);
            Route::put('/', [ProfileController::class, 'update']);
            Route::put('/password', [ProfileController::class, 'updatePassword']);
            Route::put('/pin', [ProfileController::class, 'updatePin']);
            Route::get('/security', [ProfileController::class, 'security']);
            Route::delete('/sessions/{id}', [ProfileController::class, 'revokeSession']);
            Route::delete('/sessions', [ProfileController::class, 'revokeOtherSessions']);
        });
        
        // PIN Verification / Settings
        Route::post('/auth/pin', [AuthController::class, 'changePin']);

        // Notification API Module
        Route::prefix('notifications')->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\v1\NotificationController::class, 'index']);
            Route::put('/read-all', [\App\Http\Controllers\Api\v1\NotificationController::class, 'readAll']);
            Route::put('/{id}/read', [\App\Http\Controllers\Api\v1\NotificationController::class, 'read']);
            Route::delete('/{id}', [\App\Http\Controllers\Api\v1\NotificationController::class, 'destroy']);
        });

        // Wallet and Financial Modules
        Route::get('/wallet', [WalletController::class, 'show']);
        Route::get('/wallet/history', [WalletController::class, 'history']);
        Route::post('/wallet/topup', [WalletController::class, 'topUp']);
        Route::post('/wallet/transfer', [WalletController::class, 'transfer']);

        // Transaction Engine Module
        Route::get('/transactions', [TransactionController::class, 'index']);
        Route::post('/transactions', [TransactionController::class, 'store']);
        Route::get('/transactions/{id_or_invoice}', [TransactionController::class, 'show']);
        Route::post('/transactions/{id_or_invoice}/cancel', [TransactionController::class, 'cancel']);
        Route::get('/transactions/{id_or_invoice}/receipt', [TransactionController::class, 'receipt']);

        // Finance Administration Module
        Route::prefix('admin/finance')->middleware([EnsureRole::class . ':finance,owner'])->group(function () {
            Route::get('/dashboard', [FinanceController::class, 'dashboard']);
            Route::get('/reports', [FinanceController::class, 'reports']);
            Route::get('/refunds', [FinanceController::class, 'refunds']);
            Route::post('/refunds/{id}/approve', [FinanceController::class, 'approveRefund']);
            Route::post('/refunds/{id}/reject', [FinanceController::class, 'rejectRefund']);
            Route::get('/settlements', [FinanceController::class, 'settlements']);
        });

        // Operations Administration Module
        Route::prefix('admin/operations')->middleware([EnsureRole::class . ':operations,owner'])->group(function () {
            Route::get('/dashboard', [OperationsController::class, 'dashboard']);
            Route::get('/products', [OperationsController::class, 'products']);
            Route::put('/products/{id}', [OperationsController::class, 'updateProduct']);
            Route::get('/providers', [OperationsController::class, 'providers']);
            Route::put('/providers/{id}', [OperationsController::class, 'updateProvider']);
            Route::get('/pricing', [OperationsController::class, 'pricing']);
            Route::put('/pricing', [OperationsController::class, 'updatePricing']);
        });

        // Marketing Administration Module
        Route::prefix('admin/marketing')->middleware([EnsureRole::class . ':marketing,owner'])->group(function () {
            Route::get('/dashboard', [MarketingController::class, 'dashboard']);

            Route::get('/banners', [MarketingController::class, 'banners']);
            Route::post('/banners', [MarketingController::class, 'storeBanner']);
            Route::put('/banners/{id}', [MarketingController::class, 'updateBanner']);
            Route::delete('/banners/{id}', [MarketingController::class, 'destroyBanner']);

            Route::get('/promotions', [MarketingController::class, 'promotions']);
            Route::post('/promotions', [MarketingController::class, 'storePromotion']);
            Route::put('/promotions/{id}', [MarketingController::class, 'updatePromotion']);
            Route::delete('/promotions/{id}', [MarketingController::class, 'destroyPromotion']);

            Route::get('/vouchers', [MarketingController::class, 'vouchers']);
            Route::post('/vouchers', [MarketingController::class, 'storeVoucher']);
            Route::put('/vouchers/{id}', [MarketingController::class, 'updateVoucher']);
            Route::delete('/vouchers/{id}', [MarketingController::class, 'destroyVoucher']);

            Route::get('/announcements', [MarketingController::class, 'announcements']);
            Route::post('/announcements', [MarketingController::class, 'storeAnnouncement']);
            Route::put('/announcements/{id}', [MarketingController::class, 'updateAnnouncement']);
            Route::delete('/announcements/{id}', [MarketingController::class, 'destroyAnnouncement']);
        });

        // Customer Support Administration Module
        Route::prefix('admin/customer-support')->middleware([EnsureRole::class . ':customer_support,owner'])->group(function () {
            Route::get('/dashboard', [CustomerSupportController::class, 'dashboard']);
            Route::get('/tickets', [CustomerSupportController::class, 'tickets']);
            Route::get('/tickets/{id}', [CustomerSupportController::class, 'showTicket']);
            Route::post('/tickets/{id}/reply', [CustomerSupportController::class, 'replyTicket']);
            Route::put('/tickets/{id}/status', [CustomerSupportController::class, 'updateStatus']);
            Route::get('/customers', [CustomerSupportController::class, 'customers']);
            Route::get('/investigations/{transaction}', [CustomerSupportController::class, 'investigation']);
            Route::get('/refunds', [CustomerSupportController::class, 'refunds']);
            Route::get('/knowledge-base', [CustomerSupportController::class, 'knowledgeBase']);
        });

        // Executive Owner Administration Module
        Route::prefix('admin/executive')->middleware([EnsureRole::class . ':owner'])->group(function () {
            Route::get('/dashboard', [OwnerController::class, 'dashboard']);
            Route::get('/financial-overview', [OwnerController::class, 'financialOverview']);
            Route::get('/department-overview', [OwnerController::class, 'departmentOverview']);
            Route::get('/system-health', [OwnerController::class, 'systemHealth']);
            Route::get('/audit-logs', [OwnerController::class, 'auditLogs']);
            Route::get('/activity-timeline', [OwnerController::class, 'activityTimeline']);
        });

        // System Settings Administration Module
        Route::prefix('admin/system-settings')->middleware([EnsureRole::class . ':owner'])->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\v1\Admin\SystemSettingController::class, 'index']);
            Route::put('/', [\App\Http\Controllers\Api\v1\Admin\SystemSettingController::class, 'update']);
            Route::post('/test-email', [\App\Http\Controllers\Api\v1\Admin\SystemSettingController::class, 'sendTestEmail']);
        });

        // Website Content Foundation CRUD APIs
        Route::prefix('admin/website')->middleware([EnsureRole::class . ':marketing,owner'])->group(function () {
            // Website Settings
            Route::get('/settings', [WebsiteSettingController::class, 'index']);
            Route::post('/settings', [WebsiteSettingController::class, 'store']);
            Route::get('/settings/{id}', [WebsiteSettingController::class, 'show']);
            Route::put('/settings/{id}', [WebsiteSettingController::class, 'update']);
            Route::delete('/settings/{id}', [WebsiteSettingController::class, 'destroy']);

            // Homepage Sections
            Route::get('/homepage-sections', [HomepageSectionController::class, 'index']);
            Route::post('/homepage-sections', [HomepageSectionController::class, 'store']);
            Route::get('/homepage-sections/{id}', [HomepageSectionController::class, 'show']);
            Route::put('/homepage-sections/{id}', [HomepageSectionController::class, 'update']);
            Route::delete('/homepage-sections/{id}', [HomepageSectionController::class, 'destroy']);

            // Website Menus
            Route::get('/menus', [WebsiteMenuController::class, 'index']);
            Route::post('/menus', [WebsiteMenuController::class, 'store']);
            Route::get('/menus/{id}', [WebsiteMenuController::class, 'show']);
            Route::put('/menus/{id}', [WebsiteMenuController::class, 'update']);
            Route::delete('/menus/{id}', [WebsiteMenuController::class, 'destroy']);

            // Static Pages
            Route::get('/static-pages', [StaticPageController::class, 'index']);
            Route::post('/static-pages', [StaticPageController::class, 'store']);
            Route::get('/static-pages/{id}', [StaticPageController::class, 'show']);
            Route::put('/static-pages/{id}', [StaticPageController::class, 'update']);
            Route::delete('/static-pages/{id}', [StaticPageController::class, 'destroy']);
        });

    });

});
