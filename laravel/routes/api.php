<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\v1\AuthController;
use App\Http\Controllers\Api\v1\WalletController;
use App\Http\Controllers\Api\v1\ProductController;
use App\Http\Controllers\Api\v1\CatalogController;
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
use App\Http\Controllers\Api\v1\Admin\MediaController;
use App\Http\Controllers\Api\v1\AccountController;
use App\Http\Controllers\Api\v1\AccountContentController;
use App\Http\Controllers\Api\v1\ComplaintController;
use App\Http\Controllers\Api\v1\AccountSecurityController;
use App\Http\Controllers\Api\v1\ProfileController;
use App\Http\Controllers\Api\v1\Public\PublicWebsiteController;
use App\Http\Controllers\Api\v1\Public\PublicMediaController;
use App\Http\Middleware\EnsureRole;

/*
|--------------------------------------------------------------------------
| API Routes - GurkyPay Core Engine (v1.0.0)
|--------------------------------------------------------------------------
*/

// Root level health routes for general platform observability
Route::middleware([\App\Http\Middleware\StandardizeApiErrors::class, \App\Http\Middleware\TraceRequest::class, \App\Http\Middleware\SecurityHeaders::class])->group(function () {
    Route::get('/health', [HealthCheckController::class, 'health']);
    Route::middleware(\App\Http\Middleware\ProtectHealthMetrics::class)->group(function () {
        Route::get('/status', [HealthCheckController::class, 'status']);
        Route::get('/metrics', [HealthCheckController::class, 'metrics']);
    });
});

Route::prefix('v1')->middleware([\App\Http\Middleware\StandardizeApiErrors::class, \App\Http\Middleware\TraceRequest::class, \App\Http\Middleware\SecurityHeaders::class])->group(function () {
    
    // Module health routes inside v1
    Route::get('/health', [HealthCheckController::class, 'health']);
    Route::middleware(\App\Http\Middleware\ProtectHealthMetrics::class)->group(function () {
        Route::get('/status', [HealthCheckController::class, 'status']);
        Route::get('/metrics', [HealthCheckController::class, 'metrics']);
    });
    
    // Public Website Content Endpoints (Website / Android / iOS / PWA)
    Route::prefix('public')->middleware('throttle:120,1')->group(function () {
        Route::get('/settings',           [PublicWebsiteController::class, 'settings']);
        Route::get('/menus',              [PublicWebsiteController::class, 'menus']);
        Route::get('/static-pages',       [PublicWebsiteController::class, 'staticPages']);
        Route::get('/static-pages/{slug}', [PublicWebsiteController::class, 'staticPageBySlug']);
        Route::get('/homepage',           [PublicWebsiteController::class, 'homepage']);
        Route::get('/homepage-sections',  [PublicWebsiteController::class, 'homepageSections']);
        Route::get('/banners',            [PublicWebsiteController::class, 'banners']);
        Route::get('/banners/{slug}',     [PublicWebsiteController::class, 'bannerBySlug']);
        Route::get('/promotions',         [PublicWebsiteController::class, 'promotions']);
        Route::get('/vouchers',           [PublicWebsiteController::class, 'vouchers']);
        Route::get('/announcements',      [PublicWebsiteController::class, 'announcements']);
        Route::get('/news',               [PublicWebsiteController::class, 'news']);
        Route::get('/faq',                [PublicWebsiteController::class, 'faq']);
        Route::get('/provider-status',    [PublicWebsiteController::class, 'providerStatus']);
        // Stream public-disk files via API (SPA hosts often swallow /storage/* as index.html)
        Route::get('/media/{path}',       [PublicMediaController::class, 'show'])
            ->where('path', '.*');
    });

    // Platform versioning (shared by all clients)
    Route::prefix('platform')->middleware('throttle:60,1')->group(function () {
        Route::get('/api-version', [\App\Http\Controllers\Api\v1\Platform\PlatformVersionController::class, 'apiVersion']);
        Route::get('/app-version', [\App\Http\Controllers\Api\v1\Platform\PlatformVersionController::class, 'appVersion']);
        Route::get('/minimum-supported-version', [\App\Http\Controllers\Api\v1\Platform\PlatformVersionController::class, 'minimumSupportedVersion']);
        Route::get('/force-update', [\App\Http\Controllers\Api\v1\Platform\PlatformVersionController::class, 'forceUpdate']);
    });

    // Device registration (auth optional — Sanctum token attaches user when present)
    Route::prefix('devices')->middleware('throttle:60,1')->group(function () {
        Route::post('/register', [\App\Http\Controllers\Api\v1\Platform\DeviceController::class, 'register']);
        Route::post('/push-token', [\App\Http\Controllers\Api\v1\Platform\DeviceController::class, 'updatePushToken']);
    });

    // Product and PPOB Module (Public)
    Route::middleware('throttle:120,1')->group(function () {
        Route::get('/categories', [ProductController::class, 'indexCategories']);
        Route::get('/categories/{slug}', [ProductController::class, 'showCategory']);
        Route::get('/providers', [ProductController::class, 'indexProviders']);
        Route::get('/products', [ProductController::class, 'indexProducts']);
        Route::get('/products/{sku_code}', [ProductController::class, 'showProduct']);

        // GurkyNet Information Architecture (mapped catalog — never Digi/VIP trees)
        Route::get('/catalog/taxonomy', [CatalogController::class, 'taxonomy']);
        Route::get('/catalog/search', [CatalogController::class, 'search']);
        Route::get('/catalog/telkomsel-data/taxonomy', [CatalogController::class, 'telkomselDataTaxonomy']);
        Route::get('/catalog/xl-data/taxonomy', [CatalogController::class, 'xlDataTaxonomy']);
        Route::get('/catalog/indosat-data/taxonomy', [CatalogController::class, 'indosatDataTaxonomy']);
        Route::get('/catalog/tri-data/taxonomy', [CatalogController::class, 'triDataTaxonomy']);
        Route::get('/catalog/smartfren-data/taxonomy', [CatalogController::class, 'smartfrenDataTaxonomy']);
        Route::get('/catalog/axis-data/taxonomy', [CatalogController::class, 'axisDataTaxonomy']);
        Route::get('/catalog/byu-data/taxonomy', [CatalogController::class, 'byuDataTaxonomy']);
        Route::get('/catalog/providers/{category}', [CatalogController::class, 'providersByCategory']);
        Route::get('/catalog/pajak-regions/{category}', [CatalogController::class, 'pajakRegions']);
    });

    // Digiflazz Webhook Callback
    Route::post('/webhooks/digiflazz', [TransactionController::class, 'digiflazzCallback'])->middleware('throttle:120,1');

    // VIPayment / VIP Reseller Prepaid Webhook Callback (optional; polling remains active)
    Route::post('/webhooks/vip', [TransactionController::class, 'vipCallback'])->middleware('throttle:120,1');

    // Midtrans Webhook Callback
    Route::post('/webhooks/midtrans', [TransactionController::class, 'midtransCallback'])->middleware('throttle:120,1');

    // Public Authentication Endpoints
    Route::middleware('throttle:20,1')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/login', [AuthController::class, 'login']);
        Route::post('/auth/login/pin', [AuthController::class, 'pinLogin']);
        Route::post('/auth/register/finalize', [AuthController::class, 'finalizeRegistration']);
        Route::post('/auth/password/reset', [AuthController::class, 'resetPassword']);
        Route::post('/auth/password/forgot/request', [AccountSecurityController::class, 'requestForgotPassword']);
        Route::post('/auth/password/forgot/confirm', [AccountSecurityController::class, 'confirmForgotPassword']);
        Route::post('/auth/pin/forgot/request', [AccountSecurityController::class, 'requestForgotPin']);
        Route::post('/auth/pin/forgot/confirm', [AccountSecurityController::class, 'confirmForgotPin']);
    });

    Route::middleware('throttle:5,1')->group(function () {
        Route::post('/auth/otp/request', [AuthController::class, 'requestOtp']);
        Route::post('/auth/otp/verify', [AuthController::class, 'verifyOtp']);
    });

    // Protected API Endpoints (Requires Laravel Sanctum)
    Route::middleware('auth:sanctum')->group(function () {
        
        // Session and Profile Management
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/refresh', [AuthController::class, 'refresh']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/session', [AuthController::class, 'session']);
        
        // Profile & Account Management Module
        Route::prefix('profile')->group(function () {
            Route::get('/', [ProfileController::class, 'show']);
            Route::put('/', [ProfileController::class, 'update']);
            Route::put('/password', [ProfileController::class, 'updatePassword']);
            Route::put('/pin', [ProfileController::class, 'updatePin']);
            Route::post('/avatar', [AccountController::class, 'uploadAvatar']);
            Route::get('/security', [ProfileController::class, 'security']);
            Route::delete('/sessions/{id}', [ProfileController::class, 'revokeSession']);
            Route::delete('/sessions', [ProfileController::class, 'revokeOtherSessions']);
        });

        // Transaction PIN (Account Center)
        Route::post('/pin/create', [AccountController::class, 'createPin']);
        Route::put('/pin/change', [AccountController::class, 'changePin']);
        Route::post('/pin/forgot', [AccountController::class, 'forgotPin']);
        Route::prefix('account-security')->group(function () {
            Route::post('/password/change/request', [AccountSecurityController::class, 'requestPasswordChange']);
            Route::post('/password/change/confirm', [AccountSecurityController::class, 'confirmPasswordChange']);
            Route::post('/pin/change/request', [AccountSecurityController::class, 'requestPinChange']);
            Route::post('/pin/change/confirm', [AccountSecurityController::class, 'confirmPinChange']);
            Route::post('/email/change/request', [AccountSecurityController::class, 'requestEmailChange']);
            Route::post('/email/change/verify-old', [AccountSecurityController::class, 'verifyEmailChangeOld']);
            Route::post('/email/change/verify-new', [AccountSecurityController::class, 'verifyEmailChangeNew']);
            Route::post('/phone/change/request', [AccountSecurityController::class, 'requestPhoneChange']);
            Route::post('/phone/change/confirm', [AccountSecurityController::class, 'confirmPhoneChange']);
        });

        // Complaint Center (end-user)
        Route::get('/complaints', [ComplaintController::class, 'index']);
        Route::post('/complaints', [ComplaintController::class, 'store']);
        Route::get('/complaints/{id}', [ComplaintController::class, 'show']);

        // Help / Legal / About (CMS-backed)
        Route::get('/help', [AccountContentController::class, 'help']);
        Route::get('/privacy', [AccountContentController::class, 'privacy']);
        Route::get('/terms', [AccountContentController::class, 'terms']);
        Route::get('/about', [AccountContentController::class, 'about']);

        // PIN Verification / Settings (legacy alias)
        Route::post('/auth/pin', [AuthController::class, 'changePin']);

        // Device management (authenticated)
        Route::get('/devices', [\App\Http\Controllers\Api\v1\Platform\DeviceController::class, 'index']);
        Route::delete('/devices/{deviceUuid}', [\App\Http\Controllers\Api\v1\Platform\DeviceController::class, 'destroy']);

        // Notification API Module
        Route::prefix('notifications')->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\v1\NotificationController::class, 'index']);
            Route::put('/read-all', [\App\Http\Controllers\Api\v1\NotificationController::class, 'readAll']);
            Route::put('/{id}/read', [\App\Http\Controllers\Api\v1\NotificationController::class, 'read']);
            Route::delete('/{id}', [\App\Http\Controllers\Api\v1\NotificationController::class, 'destroy']);
        });

        // Wallet and Financial Modules
        Route::middleware('throttle:30,1')->group(function () {
            Route::get('/wallet', [WalletController::class, 'show']);
            Route::get('/wallet/history', [WalletController::class, 'history']);
            Route::post('/wallet/topup', [WalletController::class, 'topUp']);
            Route::post('/wallet/transfer', [WalletController::class, 'transfer']);
            Route::post('/wallet/withdraw', [WalletController::class, 'withdraw']);
        });

        // Transaction Engine Module
        Route::middleware('throttle:30,1')->group(function () {
            Route::get('/transactions', [TransactionController::class, 'index']);
            Route::post('/transactions', [TransactionController::class, 'store']);
            Route::get('/transactions/{id_or_invoice}', [TransactionController::class, 'show']);
            Route::post('/transactions/{id_or_invoice}/cancel', [TransactionController::class, 'cancel']);
            Route::get('/transactions/{id_or_invoice}/receipt', [TransactionController::class, 'receipt']);
        });

        // Postpaid bill inquiry (Digiflazz inq-pasca) — no wallet debit
        Route::middleware('throttle:20,1')->group(function () {
            Route::post('/tagihan/inquiry', [\App\Http\Controllers\Api\v1\TagihanController::class, 'inquiry']);
        });

        // E-Wallet / E-Money inquiry (Digiflazz inq-pasca + amount) — no wallet debit
        Route::middleware('throttle:20,1')->group(function () {
            Route::post('/ewallet/inquiry', [\App\Http\Controllers\Api\v1\EwalletController::class, 'inquiry']);
        });

        // Game nickname validation (VIP Payment get-nickname) — no wallet debit
        Route::middleware('throttle:20,1')->group(function () {
            Route::get('/game/account-schema', [\App\Http\Controllers\Api\v1\GameController::class, 'accountSchema']);
            Route::post('/game/inquiry', [\App\Http\Controllers\Api\v1\GameController::class, 'inquiry']);
        });

        // Prepaid PLN meter inquiry (Digiflazz /inquiry-pln) — no wallet debit
        Route::middleware('throttle:20,1')->group(function () {
            Route::post('/pln/inquiry', [\App\Http\Controllers\Api\v1\PlnController::class, 'inquiry']);
        });

        // Finance Administration Module
        Route::prefix('admin/finance')->middleware([EnsureRole::class . ':finance,owner'])->group(function () {
            Route::get('/dashboard', [FinanceController::class, 'dashboard']);
            Route::get('/reports', [FinanceController::class, 'reports']);
            Route::get('/refunds', [FinanceController::class, 'refunds']);
            Route::post('/refunds/{id}/approve', [FinanceController::class, 'approveRefund']);
            Route::post('/refunds/{id}/reject', [FinanceController::class, 'rejectRefund']);
            Route::get('/settlements', [FinanceController::class, 'settlements']);
            Route::post('/wallet/adjust', [FinanceController::class, 'adjustWallet']);
        });

        // Operations Administration Module
        Route::prefix('admin/operations')->middleware([EnsureRole::class . ':operations,owner'])->group(function () {
            Route::get('/dashboard', [OperationsController::class, 'dashboard']);
            Route::get('/products', [OperationsController::class, 'products']);
            Route::put('/products/{id}', [OperationsController::class, 'updateProduct']);
            Route::get('/product-providers', [OperationsController::class, 'productProviders']);
            // Product Provider Control Center (PPOB suppliers only — not payment gateways)
            Route::get('/product-provider-control', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'index']);
            Route::get('/product-provider-control/{id}', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'show']);
            Route::post('/product-provider-control/{id}/enable', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'enable']);
            Route::post('/product-provider-control/{id}/disable', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'disable']);
            Route::post('/product-provider-control/{id}/maintenance', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'maintenance']);
            Route::post('/product-provider-control/{id}/set-primary', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'setPrimary']);
            Route::put('/product-provider-control/{id}/priority', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'setPriority']);
            Route::post('/product-provider-control/{id}/health-check', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'healthCheck']);
            Route::post('/product-provider-control/{id}/sync', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'sync']);
            Route::get('/product-provider-control/{id}/logs', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'logs']);
            Route::get('/payment-gateway-control', [\App\Http\Controllers\Api\v1\Admin\PaymentGatewayControlController::class, 'index']);
            Route::post('/payment-gateway-control/refresh', [\App\Http\Controllers\Api\v1\Admin\PaymentGatewayControlController::class, 'refresh']);
            Route::get('/payment-gateway-control/{code}', [\App\Http\Controllers\Api\v1\Admin\PaymentGatewayControlController::class, 'show']);
            Route::post('/payment-gateway-control/{code}/enable', [\App\Http\Controllers\Api\v1\Admin\PaymentGatewayControlController::class, 'enable']);
            Route::post('/payment-gateway-control/{code}/disable', [\App\Http\Controllers\Api\v1\Admin\PaymentGatewayControlController::class, 'disable']);
            Route::post('/payment-gateway-control/{code}/maintenance', [\App\Http\Controllers\Api\v1\Admin\PaymentGatewayControlController::class, 'maintenance']);
            Route::put('/payment-gateway-control/{code}/priority', [\App\Http\Controllers\Api\v1\Admin\PaymentGatewayControlController::class, 'setPriority']);
            Route::post('/payment-gateway-control/{code}/health-check', [\App\Http\Controllers\Api\v1\Admin\PaymentGatewayControlController::class, 'healthCheck']);
            Route::get('/payment-gateway-control/{code}/logs', [\App\Http\Controllers\Api\v1\Admin\PaymentGatewayControlController::class, 'logs']);
            Route::get('/providers', [OperationsController::class, 'providers']);
            Route::post('/providers/refresh-status', [OperationsController::class, 'refreshProviderStatuses']);
            Route::put('/providers/{id}', [OperationsController::class, 'updateProvider']);
            Route::get('/monitoring', [OperationsController::class, 'monitoring']);
            Route::post('/monitoring/refresh', [OperationsController::class, 'refreshMonitoring']);
            Route::get('/monitoring/services/{serviceKey}', [OperationsController::class, 'monitoringServiceDetail']);
            Route::get('/monitoring/services/{serviceKey}/issues', [OperationsController::class, 'monitoringServiceIssues']);
            Route::get('/pricing', [OperationsController::class, 'pricing']);
            Route::put('/pricing', [OperationsController::class, 'updatePricing']);
            Route::put('/pricing/{id}', [OperationsController::class, 'updatePricing']);
            Route::post('/sync', [OperationsController::class, 'syncCatalog']);
            Route::get('/sync-status', [OperationsController::class, 'syncStatus']);
        });

        // Marketing Administration Module
        Route::prefix('admin/marketing')->middleware([EnsureRole::class . ':marketing,owner'])->group(function () {
            Route::get('/dashboard', [MarketingController::class, 'dashboard']);
            Route::get('/featured-products', [MarketingController::class, 'featuredProducts']);
            Route::post('/featured-products', [MarketingController::class, 'storeFeaturedProduct']);
            Route::put('/featured-products/{id}', [MarketingController::class, 'updateFeaturedProduct']);
            Route::delete('/featured-products/{id}', [MarketingController::class, 'destroyFeaturedProduct']);

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
            Route::get('/stats', [CustomerSupportController::class, 'stats']);
            Route::get('/tickets', [CustomerSupportController::class, 'tickets']);
            Route::post('/tickets', [CustomerSupportController::class, 'createTicket']);
            Route::get('/tickets/{id}', [CustomerSupportController::class, 'showTicket']);
            Route::post('/tickets/{id}/reply', [CustomerSupportController::class, 'replyTicket']);
            Route::put('/tickets/{id}/status', [CustomerSupportController::class, 'updateStatus']);
            Route::get('/customers', [CustomerSupportController::class, 'customers']);
            Route::get('/customers/{id}/transactions', [CustomerSupportController::class, 'customerTransactions']);
            Route::get('/customers/{id}', [CustomerSupportController::class, 'showCustomer']);
            Route::get('/investigation', [CustomerSupportController::class, 'investigationQuery']);
            Route::get('/investigations/{transaction}', [CustomerSupportController::class, 'investigation']);
            Route::get('/refunds', [CustomerSupportController::class, 'refunds']);
            Route::post('/refunds', [CustomerSupportController::class, 'createRefund']);
            Route::get('/refunds/{id}', [CustomerSupportController::class, 'showRefund']);
            Route::put('/refunds/{id}', [CustomerSupportController::class, 'updateRefund']);
            Route::post('/refunds/{id}/escalate', [CustomerSupportController::class, 'escalateRefund']);
            Route::get('/knowledge-base', [CustomerSupportController::class, 'knowledgeBase']);
            Route::get('/knowledge-base/{id}', [CustomerSupportController::class, 'knowledgeBaseArticle']);
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

        // Media Library (admin: marketing, owner)
        Route::prefix('admin/media')->middleware([EnsureRole::class . ':marketing,owner'])->group(function () {
            Route::get('/', [MediaController::class, 'index']);
            Route::post('/', [MediaController::class, 'store']);
            Route::get('/{id}', [MediaController::class, 'show']);
            Route::put('/{id}', [MediaController::class, 'update']);
            Route::delete('/{id}', [MediaController::class, 'destroy']);
        });

    });

});
