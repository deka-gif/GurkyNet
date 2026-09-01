<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\v1\AuthController;
use App\Http\Controllers\Api\v1\WalletController;
use App\Http\Controllers\Api\v1\ProductController;
use App\Http\Controllers\Api\v1\CatalogController;
use App\Http\Controllers\Api\v1\TransactionController;
use App\Http\Controllers\Api\v1\VoucherPhysicalBatchController;
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
use App\Http\Controllers\Api\v1\KycController;
use App\Http\Controllers\Api\v1\Public\PublicWebsiteController;
use App\Http\Controllers\Api\v1\Public\PublicMediaController;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureOwnerReadOnly;
use App\Http\Middleware\RenewTokenExpiration;

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
        Route::get('/legal',              [PublicWebsiteController::class, 'legalIndex']);
        Route::get('/legal/{slug}',       [PublicWebsiteController::class, 'legalBySlug']);
        Route::get('/cms-sync',           [PublicWebsiteController::class, 'cmsSync']);
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
        Route::get('/products/providers', [ProductController::class, 'indexCategoryProviders']);
        Route::get('/products/{sku_code}', [ProductController::class, 'showProduct']);

        // GurkyNet Information Architecture (mapped catalog — never Digi/VIP trees)
        Route::get('/catalog/taxonomy', [CatalogController::class, 'taxonomy']);
        Route::get('/catalog/category-icons', [CatalogController::class, 'categoryIcons']);
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
        Route::get('/catalog/telkomsel-voucher-zones', [CatalogController::class, 'telkomselVoucherZones']);
    });

    // Sprint 8 — public feature gates (purchase/withdraw/auto-topup)
    Route::get('/features', \App\Http\Controllers\Api\v1\FeatureFlagController::class)->middleware('throttle:60,1');

    // SRS 30 / FR-API-10 — OpenAPI (public read)
    Route::get('/partner/openapi.json', \App\Http\Controllers\Api\v1\Partner\PartnerOpenApiController::class)
        ->middleware('throttle:60,1');

    // SRS 30 — Partner H2H API (HMAC; PARTNER_API_ENABLED / sandbox gates)
    Route::prefix('partner')->middleware(['partner.api', 'partner.api.rate'])->group(function () {
        Route::get('/price', [\App\Http\Controllers\Api\v1\Partner\PartnerH2hController::class, 'price']);
        Route::post('/execute', [\App\Http\Controllers\Api\v1\Partner\PartnerH2hController::class, 'execute']);
        Route::get('/status', [\App\Http\Controllers\Api\v1\Partner\PartnerH2hController::class, 'status']);
        Route::post('/status', [\App\Http\Controllers\Api\v1\Partner\PartnerH2hController::class, 'status']);
    });

    // Digiflazz Webhook Callback
    Route::post('/webhooks/digiflazz', [TransactionController::class, 'digiflazzCallback'])->middleware('throttle:120,1');

    // VIPayment / VIP Reseller Prepaid Webhook Callback (optional; polling remains active)
    Route::post('/webhooks/vip', [TransactionController::class, 'vipCallback'])->middleware('throttle:120,1');

    // Midtrans Webhook Callback
    Route::post('/webhooks/midtrans', [TransactionController::class, 'midtransCallback'])->middleware('throttle:120,1');

    // Public Authentication Endpoints
    // SRS Bagian 8.1 / 17 — named limiters (login / password-reset).
    Route::middleware('throttle:login')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::get('/auth/google/redirect', [\App\Http\Controllers\Api\v1\GoogleAuthController::class, 'redirect']);
        Route::get('/auth/google/callback', [\App\Http\Controllers\Api\v1\GoogleAuthController::class, 'callback']);
        Route::post('/auth/google/complete', [\App\Http\Controllers\Api\v1\GoogleAuthController::class, 'complete']);
        Route::post('/auth/login', [AuthController::class, 'login']);
        Route::post('/auth/login/pin', [AuthController::class, 'pinLogin']);
        // SRS Bagian 8.1 — Sprint 2 keputusan #2: kelanjutan login untuk role
        // yang wajib 2FA (Finance/Owner). Tetap di grup throttle login (#7).
        Route::post('/auth/login/2fa/verify', [AuthController::class, 'verifyLogin2fa']);
        Route::post('/auth/register/finalize', [AuthController::class, 'finalizeRegistration']);
        Route::post('/auth/password/reset', [AuthController::class, 'resetPassword']);
    });

    Route::middleware('throttle:password-reset')->group(function () {
        Route::post('/auth/password/forgot/request', [AccountSecurityController::class, 'requestForgotPassword']);
        Route::post('/auth/password/forgot/confirm', [AccountSecurityController::class, 'confirmForgotPassword']);
        Route::post('/auth/pin/forgot/request', [AccountSecurityController::class, 'requestForgotPin']);
        Route::post('/auth/pin/forgot/confirm', [AccountSecurityController::class, 'confirmForgotPin']);
    });

    Route::middleware('throttle:otp')->group(function () {
        Route::post('/auth/otp/request', [AuthController::class, 'requestOtp']);
        Route::post('/auth/otp/verify', [AuthController::class, 'verifyOtp']);
        Route::post('/auth/otp/resend-whatsapp', [AuthController::class, 'resendOnboardingOtpWhatsapp']);
    });

    // Protected API Endpoints (Requires Laravel Sanctum)
    // RenewTokenExpiration: SRS Bagian 8.1 — Sprint 2 keputusan #3. Memperpanjang
    // expires_at token pada setiap request aktif (idle timeout staf 30 menit;
    // refresh otomatis token customer 30 hari).
    Route::middleware(['auth:sanctum', RenewTokenExpiration::class])->group(function () {
        
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
            Route::put('/notification-preference', [ProfileController::class, 'updateNotificationPreference']);
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

        // Live Chat + Help Center (Sprint 8.0)
        Route::prefix('chat')->group(function () {
            Route::get('/conversation', [\App\Http\Controllers\Api\v1\ChatController::class, 'conversation']);
            Route::post('/conversation', [\App\Http\Controllers\Api\v1\ChatController::class, 'conversation']);
            Route::get('/conversations/{id}/messages', [\App\Http\Controllers\Api\v1\ChatController::class, 'messages']);
            Route::post('/conversations/{id}/messages', [\App\Http\Controllers\Api\v1\ChatController::class, 'send']);
            Route::post('/conversations/{id}/read', [\App\Http\Controllers\Api\v1\ChatController::class, 'read']);
            Route::get('/refund-statuses', [\App\Http\Controllers\Api\v1\ChatController::class, 'refundStatuses']);
        });

        // Realtime SSE / poll (transport abstraction)
        Route::get('/realtime/stream', [\App\Http\Controllers\Api\v1\RealtimeController::class, 'stream']);
        Route::get('/realtime/poll', [\App\Http\Controllers\Api\v1\RealtimeController::class, 'poll']);

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
        // SRS Bagian 8.1 / 17 — financial-sensitive throttle.
        Route::middleware('throttle:financial')->group(function () {
            Route::get('/wallet', [WalletController::class, 'show']);
            Route::get('/wallet/history', [WalletController::class, 'history']);
            Route::get('/wallet/payment-config', [WalletController::class, 'paymentConfig']);
            Route::post('/wallet/topup', [WalletController::class, 'topUp']);
            Route::post('/wallet/deposit-manual', [WalletController::class, 'depositManual']); // FR-FIN-03
            Route::post('/wallet/transfer', [WalletController::class, 'transfer']);
            Route::post('/wallet/withdraw', [WalletController::class, 'withdraw']);

            // FR-DIFF-01 / FR-DIFF-08 — Poin & Loyalitas (own data only)
            Route::get('/loyalty', [\App\Http\Controllers\Api\v1\LoyaltyController::class, 'summary']);
            Route::get('/loyalty/history', [\App\Http\Controllers\Api\v1\LoyaltyController::class, 'history']);
            Route::post('/loyalty/redeem', [\App\Http\Controllers\Api\v1\LoyaltyController::class, 'redeem']);

            // SRS 31 / FR-REF-07 — Referral (own data only)
            Route::get('/referral', [\App\Http\Controllers\Api\v1\ReferralController::class, 'summary']);
            Route::get('/referral/history', [\App\Http\Controllers\Api\v1\ReferralController::class, 'history']);
            Route::get('/referral/downlines', [\App\Http\Controllers\Api\v1\ReferralController::class, 'downlines']);
            Route::put('/referral/code', [\App\Http\Controllers\Api\v1\ReferralController::class, 'setCode']);

            // FR-DIFF-02 — Auto-Reorder subscriptions (own only)
            Route::get('/subscriptions', [\App\Http\Controllers\Api\v1\SubscriptionController::class, 'index']);
            Route::post('/subscriptions', [\App\Http\Controllers\Api\v1\SubscriptionController::class, 'store']);
            Route::put('/subscriptions/{id}', [\App\Http\Controllers\Api\v1\SubscriptionController::class, 'update'])->whereNumber('id');
            Route::post('/subscriptions/{id}/pause', [\App\Http\Controllers\Api\v1\SubscriptionController::class, 'pause'])->whereNumber('id');
            Route::post('/subscriptions/{id}/resume', [\App\Http\Controllers\Api\v1\SubscriptionController::class, 'resume'])->whereNumber('id');
            Route::post('/subscriptions/{id}/cancel', [\App\Http\Controllers\Api\v1\SubscriptionController::class, 'cancel'])->whereNumber('id');
        });

        // SRS 30 / FR-API-09 — Partner Portal (own data only)
        Route::prefix('partner-portal')->group(function () {
            Route::post('/apply', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'apply']);
            Route::get('/me', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'me']);
            Route::get('/credentials', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'credentials']);
            Route::post('/credentials/{credentialId}/rotate', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'rotate'])->whereNumber('credentialId');
            Route::post('/credentials/{credentialId}/revoke', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'revoke'])->whereNumber('credentialId');
            Route::get('/logs', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'logs']);
            Route::get('/transactions', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'transactions']);
            Route::post('/deposits', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'requestDeposit']);
            Route::get('/deposits', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'deposits']);
            Route::get('/docs', [\App\Http\Controllers\Api\v1\Partner\PartnerPortalController::class, 'docs']);
        });

        // FR-KYC-01..05 / SRS Bagian 21 — KYC Tier 1/2 (user)
        Route::prefix('kyc')->group(function () {
            Route::get('/status', [KycController::class, 'status']);
            Route::get('/withdraw-eligibility', [KycController::class, 'withdrawEligibility']);
            Route::post('/tier1/phone/request', [KycController::class, 'requestPhoneVerification'])->middleware('throttle:otp');
            Route::post('/tier1/phone/verify', [KycController::class, 'verifyPhone'])->middleware('throttle:otp');
            Route::post('/tier1/email/request', [KycController::class, 'requestEmailVerification'])->middleware('throttle:otp');
            Route::post('/tier1/email/verify', [KycController::class, 'verifyEmail'])->middleware('throttle:otp');
            Route::post('/tier2/submit', [KycController::class, 'submit'])->middleware('throttle:kyc-upload');
            Route::get('/verifications/{id}', [KycController::class, 'show'])->whereNumber('id');
            Route::get('/verifications/{id}/documents/{type}', [KycController::class, 'document'])
                ->whereNumber('id')
                ->where('type', 'ktp|selfie');
        });

        // Transaction Engine Module
        // SRS Bagian 24 #7 — purchase attempts must hit rate limiting within a 20/min attack window.
        // Prior group limit (30/min) allowed all 20 attempts; POST store tightened to 15/min.
        Route::middleware('throttle:30,1')->group(function () {
            Route::get('/transactions', [TransactionController::class, 'index']);
            Route::get('/transactions/{id_or_invoice}', [TransactionController::class, 'show']);
            Route::post('/transactions/{id_or_invoice}/cancel', [TransactionController::class, 'cancel']);
            Route::get('/transactions/{id_or_invoice}/receipt', [TransactionController::class, 'receipt']);
            Route::get('/transactions/{id_or_invoice}/receipt.pdf', [TransactionController::class, 'receiptPdf']);
        });
        Route::post('/transactions', [TransactionController::class, 'store'])
            ->middleware('throttle:15,1');

        // Voucher Fisik bulk activation — batch header is a Transaction row (see above),
        // but scan/validate/retry state lives on its own resource.
        Route::middleware('throttle:30,1')->group(function () {
            Route::get('/voucher-internet/physical-batches/{id}', [VoucherPhysicalBatchController::class, 'show'])
                ->whereNumber('id');
            Route::post('/voucher-internet/physical-batches/{id}/items/{item}/retry', [VoucherPhysicalBatchController::class, 'retryItem'])
                ->whereNumber('id')
                ->whereNumber('item');
        });
        Route::post('/voucher-internet/physical-batches', [VoucherPhysicalBatchController::class, 'store'])
            ->middleware('throttle:10,1');

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
            Route::get('/langganan/account-schema', [\App\Http\Controllers\Api\v1\LanggananController::class, 'accountSchema']);
        });

        // Prepaid PLN meter inquiry (Digiflazz /inquiry-pln) — no wallet debit
        Route::middleware('throttle:20,1')->group(function () {
            Route::post('/pln/inquiry', [\App\Http\Controllers\Api\v1\PlnController::class, 'inquiry']);
        });

        // Finance Administration Module
        // EnsureOwnerReadOnly: SRS Bagian 5 — Sprint 2 keputusan #1. Owner hanya "Lihat" di modul Finance.
        Route::prefix('admin/finance')->middleware([EnsureRole::class . ':finance,owner', EnsureOwnerReadOnly::class])->group(function () {
            Route::get('/dashboard', [FinanceController::class, 'dashboard']);
            Route::get('/command-center', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'commandCenter']);
            Route::get('/treasury', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'treasury']);
            Route::get('/provider-deposits', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'providerDeposits']);
            Route::post('/provider-deposits/refresh', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'refreshProviderDeposits']);
            Route::get('/payment-gateways', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'paymentGateways']);
            Route::get('/wallets/monitor', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'walletMonitor']);
            // FR-FIN-01
            Route::get('/wallets', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'wallets']);
            Route::get('/wallets/{userId}/mutations', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'walletMutations'])->whereNumber('userId');
            Route::get('/ledger', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'ledgerIndex']);
            Route::get('/ledger/{id}', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'ledgerShow'])->whereNumber('id');
            Route::get('/reports', [FinanceController::class, 'reports']);
            Route::get('/reports/structured', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'structuredReports']);
            Route::get('/reports/export', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'exportReport']); // FR-FIN-08
            // FR-FIN-03 / FR-FIN-04
            Route::get('/deposits/automatic', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'automaticDeposits']);
            Route::get('/deposits', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'deposits']);
            Route::get('/deposits/{id}', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'depositShow'])->whereNumber('id');
            Route::post('/deposits/{id}/approve', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'depositApprove'])->whereNumber('id');
            Route::post('/deposits/{id}/reject', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'depositReject'])->whereNumber('id');
            // FR-FIN-05
            Route::get('/withdrawals', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'withdrawals']);
            Route::get('/withdrawals/{id}', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'withdrawalShow'])->whereNumber('id');
            Route::post('/withdrawals/{id}/approve', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'withdrawalApprove'])->whereNumber('id');
            Route::post('/withdrawals/{id}/reject', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'withdrawalReject'])->whereNumber('id');
            Route::post('/withdrawals/{id}/hold', [\App\Http\Controllers\Api\v1\Admin\FinanceOpsController::class, 'withdrawalHold'])->whereNumber('id');
            Route::get('/refunds', [FinanceController::class, 'refunds']);
            Route::post('/refunds/{id}/approve', [FinanceController::class, 'approveRefund']);
            Route::post('/refunds/{id}/reject', [FinanceController::class, 'rejectRefund']);
            Route::get('/settlements', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'settlementIndex']);
            Route::post('/settlements', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'settlementStore']);
            Route::get('/settlements/{id}', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'settlementShow'])->whereNumber('id');
            Route::patch('/settlements/{id}', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'settlementUpdate'])->whereNumber('id');
            Route::get('/alerts', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'alertsIndex']);
            Route::post('/alerts/evaluate', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'alertsEvaluate']);
            Route::post('/alerts/{id}/ack', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'alertAck'])->whereNumber('id');
            Route::post('/alerts/{id}/resolve', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'alertResolve'])->whereNumber('id');
            Route::post('/wallet/adjust', [FinanceController::class, 'adjustWallet']); // FR-FIN-02

            // FR-DIFF-01 / 13.4 — Program Poin & Komisi (poin only this sprint)
            Route::get('/loyalty/overview', [\App\Http\Controllers\Api\v1\Admin\FinanceLoyaltyController::class, 'overview']);
            Route::get('/loyalty/ledger', [\App\Http\Controllers\Api\v1\Admin\FinanceLoyaltyController::class, 'ledger']);
            Route::get('/loyalty/users/{userId}', [\App\Http\Controllers\Api\v1\Admin\FinanceLoyaltyController::class, 'userBalance'])->whereNumber('userId');
            Route::get('/loyalty/users/{userId}/history', [\App\Http\Controllers\Api\v1\Admin\FinanceLoyaltyController::class, 'userHistory'])->whereNumber('userId');
            Route::post('/loyalty/adjust', [\App\Http\Controllers\Api\v1\Admin\FinanceLoyaltyController::class, 'adjust']);

            // SRS 31 — Referral commission (Finance)
            Route::get('/referral/overview', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'overview']);
            Route::get('/referral/rules', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'rules']);
            Route::put('/referral/rules', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'updateRule']);
            Route::get('/referral/ledger', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'ledger']);
            Route::get('/referral/fraud-flags', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'fraudFlags']);
            Route::post('/referral/fraud-flags/{id}/review', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'reviewFraud'])->whereNumber('id');
            Route::post('/referral/ledger/{id}/finance-review', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'reviewFinanceCase'])->whereNumber('id');
            Route::get('/referral/users/{userId}/caps', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'capUsage'])->whereNumber('userId');

            // FR-KYC-05 — Finance KYC review queue
            Route::get('/kyc', [\App\Http\Controllers\Api\v1\Admin\KycReviewController::class, 'index']);
            Route::get('/kyc/{id}', [\App\Http\Controllers\Api\v1\Admin\KycReviewController::class, 'show'])->whereNumber('id');
            Route::post('/kyc/{id}/approve', [\App\Http\Controllers\Api\v1\Admin\KycReviewController::class, 'approve'])->whereNumber('id');
            Route::post('/kyc/{id}/reject', [\App\Http\Controllers\Api\v1\Admin\KycReviewController::class, 'reject'])->whereNumber('id');

            // Sprint 7 / SRS 18 + FR-FIN-07 — zero-loss reconciliation
            Route::get('/reconciliation/incidents', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'incidents']);
            Route::post('/reconciliation/incidents/{id}/resolve', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'resolveIncident'])->whereNumber('id');
            Route::get('/reconciliation/gateway', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'gatewayQueue']);
            Route::post('/reconciliation/gateway/{id}/match', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'matchGateway'])->whereNumber('id');
            Route::post('/reconciliation/gateway/{id}/discrepancy', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'discrepancyGateway'])->whereNumber('id');
            Route::get('/reconciliation/bank-lines', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'bankLines']);
            Route::post('/reconciliation/bank-import', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'importBank']);
            Route::post('/reconciliation/bank-lines/{id}/match', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'matchBank'])->whereNumber('id');
            Route::post('/reconciliation/bank-lines/{id}/discrepancy', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'discrepancyBank'])->whereNumber('id');
            Route::get('/reconciliation/closings', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'closings']);
            Route::post('/reconciliation/run', [\App\Http\Controllers\Api\v1\Admin\FinanceReconciliationController::class, 'runJob']);
        });

        // Cross-division finance widgets (read-only)
        Route::get('/admin/finance/widgets/{audience}', [\App\Http\Controllers\Api\v1\Admin\FinanceCommandCenterController::class, 'widgets'])
            ->middleware([EnsureRole::class . ':finance,customer_support,operations,marketing,owner'])
            ->where('audience', 'customer_support|cs|operations|marketing');

        // Operations Administration Module
        // EnsureOwnerReadOnly: SRS Bagian 5 — Sprint 2 keputusan #1. Owner hanya "Lihat" di modul Operations.
        Route::prefix('admin/operations')->middleware([EnsureRole::class . ':operations,owner', EnsureOwnerReadOnly::class])->group(function () {
            Route::get('/dashboard', [OperationsController::class, 'dashboard']);
            Route::get('/command-center', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'commandCenter']);
            Route::get('/monitoring/infra', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'infra']);
            Route::post('/monitoring/infra/refresh', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'refreshInfra']);
            Route::get('/live-transactions', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'liveTransactions']);
            Route::get('/activity-timeline', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'activityTimeline']);
            Route::get('/alerts', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'alertsIndex']);
            Route::post('/alerts/evaluate', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'alertsEvaluate']);
            Route::post('/alerts/{id}/ack', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'alertAck'])->whereNumber('id');
            Route::post('/alerts/{id}/investigate', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'alertInvestigate'])->whereNumber('id');
            Route::post('/alerts/{id}/resolve', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'alertResolve'])->whereNumber('id');
            Route::post('/alerts/{id}/close', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'alertClose'])->whereNumber('id');
            Route::get('/issues/{workflowId}', [\App\Http\Controllers\Api\v1\Admin\OpsCommandCenterController::class, 'issueDetail'])->whereNumber('workflowId');
            Route::get('/products', [OperationsController::class, 'products']);
            Route::put('/products/{id}', [OperationsController::class, 'updateProduct']);
            Route::get('/product-providers', [OperationsController::class, 'productProviders']);
            // Product Provider Control Center (PPOB suppliers only — not payment gateways)
            Route::get('/product-provider-control', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'index']);
            Route::post('/product-provider-control/refresh', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'refreshAll']);
            Route::get('/product-provider-control/auto-sync', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'autoSyncStatus']);
            Route::get('/product-provider-control/{id}', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'show']);
            Route::post('/product-provider-control/{id}/enable', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'enable']);
            Route::post('/product-provider-control/{id}/disable', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'disable']);
            Route::post('/product-provider-control/{id}/maintenance', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'maintenance']);
            Route::post('/product-provider-control/{id}/set-primary', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'setPrimary']);
            Route::put('/product-provider-control/{id}/logo', [\App\Http\Controllers\Api\v1\Admin\ProductProviderControlController::class, 'setLogo']);
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
            // FR-DIFF-03 — agent margin calculator (display-only)
            Route::get('/agent-margin/{productId}', [\App\Http\Controllers\Api\v1\Admin\AgentMarginController::class, 'show'])->whereNumber('productId');
            Route::put('/agent-margin/{productId}/prices', [\App\Http\Controllers\Api\v1\Admin\AgentMarginController::class, 'upsertPrice'])->whereNumber('productId');
            // FR-DIFF-02 — Ops monitoring (read-only)
            Route::get('/auto-reorder', \App\Http\Controllers\Api\v1\Admin\OpsSubscriptionMonitorController::class);
            Route::post('/sync', [OperationsController::class, 'syncCatalog']);
            Route::get('/sync-status', [OperationsController::class, 'syncStatus']);
            // Phase 15 — dedicated sync-run history (started/completed, counts, errors).
            Route::get('/sync-runs', [OperationsController::class, 'syncRuns']);

            // SRS 30 — Partner H2H admin (Ops approve/pricing/rate/credentials)
            Route::get('/partners', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'index']);
            Route::post('/partners/{id}/approve', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'approve'])->whereNumber('id');
            Route::post('/partners/{id}/reject', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'reject'])->whereNumber('id');
            Route::put('/partners/{id}/rate-limit', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'updateRateLimit'])->whereNumber('id');
            Route::put('/partner-prices', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'upsertPrice']);
            Route::post('/partner-credentials/{credentialId}/revoke', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'revokeCredential'])->whereNumber('credentialId');
            Route::post('/partner-credentials/{credentialId}/rotate', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'rotateCredential'])->whereNumber('credentialId');
            Route::get('/partner-abuse-flags', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'abuseFlags']);
        });

        // Finance — partner deposit approval (SRS 30 MVP manual)
        Route::prefix('admin/finance')->middleware([EnsureRole::class . ':finance,owner', EnsureOwnerReadOnly::class])->group(function () {
            Route::get('/partner-deposits', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'deposits']);
            Route::post('/partner-deposits/{id}/approve', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'approveDeposit'])->whereNumber('id');
            Route::post('/partner-deposits/{id}/reject', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'rejectDeposit'])->whereNumber('id');
        });

        // Marketing Administration Module
        // EnsureOwnerReadOnly: SRS Bagian 5 — Sprint 2 keputusan #1. Owner hanya "Lihat" di modul Marketing.
        Route::prefix('admin/marketing')->middleware([EnsureRole::class . ':marketing,owner', EnsureOwnerReadOnly::class])->group(function () {
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

            Route::get('/brand-logos', [MarketingController::class, 'brandLogos']);
            Route::put('/brand-logos/{id}', [MarketingController::class, 'updateBrandLogo']);
            Route::get('/category-icons', [MarketingController::class, 'categoryIcons']);
            Route::put('/category-icons/{key}', [MarketingController::class, 'updateCategoryIcon'])->where('key', '.+');
        });

        // Customer Support Administration Module
        // EnsureOwnerReadOnly: SRS Bagian 5 — Sprint 2 keputusan #1. Owner hanya "Lihat" di modul Customer Support.
        Route::prefix('admin/customer-support')->middleware([EnsureRole::class . ':customer_support,owner', EnsureOwnerReadOnly::class])->group(function () {
            Route::get('/dashboard', [CustomerSupportController::class, 'dashboard']);
            Route::get('/stats', [CustomerSupportController::class, 'stats']);
            Route::get('/staff', [CustomerSupportController::class, 'staffOptions']);
            Route::get('/hub-stats', [\App\Http\Controllers\Api\v1\Admin\SupportInboxController::class, 'hubStats']);
            Route::get('/inbox', [\App\Http\Controllers\Api\v1\Admin\SupportInboxController::class, 'index']);
            Route::get('/inbox/{id}', [\App\Http\Controllers\Api\v1\Admin\SupportInboxController::class, 'show']);
            Route::post('/inbox/{id}/messages', [\App\Http\Controllers\Api\v1\Admin\SupportInboxController::class, 'send']);
            Route::post('/inbox/{id}/assign', [\App\Http\Controllers\Api\v1\Admin\SupportInboxController::class, 'assign']);
            Route::post('/inbox/{id}/close', [\App\Http\Controllers\Api\v1\Admin\SupportInboxController::class, 'close']);
            Route::post('/inbox/{id}/read', [\App\Http\Controllers\Api\v1\Admin\SupportInboxController::class, 'read']);
            Route::post('/inbox/{id}/convert-ticket', [\App\Http\Controllers\Api\v1\Admin\SupportInboxController::class, 'convertTicket']);
            Route::post('/inbox/{id}/escalate', [\App\Http\Controllers\Api\v1\Admin\SupportInboxController::class, 'escalate']);
            Route::get('/tickets', [CustomerSupportController::class, 'tickets']);
            Route::post('/tickets', [CustomerSupportController::class, 'createTicket']);
            Route::get('/tickets/{id}', [CustomerSupportController::class, 'showTicket']);
            Route::post('/tickets/{id}/reply', [CustomerSupportController::class, 'replyTicket']);
            Route::put('/tickets/{id}/status', [CustomerSupportController::class, 'updateStatus']);
            Route::get('/customers', [CustomerSupportController::class, 'customers']);
            Route::get('/customers/{id}/transactions', [CustomerSupportController::class, 'customerTransactions']);
            Route::get('/customers/{id}', [CustomerSupportController::class, 'showCustomer']);
            // FR-DIFF-01 — CS read-only poin/tier (no adjust)
            Route::get('/loyalty/overview', [\App\Http\Controllers\Api\v1\Admin\FinanceLoyaltyController::class, 'overview']);
            Route::get('/loyalty/users/{userId}', [\App\Http\Controllers\Api\v1\Admin\FinanceLoyaltyController::class, 'userBalance'])->whereNumber('userId');

            // SRS 31 — CS read-only referral monitoring
            Route::get('/referral/overview', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'overview']);
            Route::get('/referral/fraud-flags', [\App\Http\Controllers\Api\v1\Admin\FinanceReferralController::class, 'fraudFlags']);
            Route::get('/loyalty/users/{userId}/history', [\App\Http\Controllers\Api\v1\Admin\FinanceLoyaltyController::class, 'userHistory'])->whereNumber('userId');
            Route::get('/investigation', [CustomerSupportController::class, 'investigationQuery']);
            Route::get('/investigations/{transaction}', [CustomerSupportController::class, 'investigation']);
            Route::get('/refunds', [CustomerSupportController::class, 'refunds']);
            Route::post('/refunds', [CustomerSupportController::class, 'createRefund']);
            Route::get('/refunds/{id}', [CustomerSupportController::class, 'showRefund']);
            Route::put('/refunds/{id}', [CustomerSupportController::class, 'updateRefund']);
            Route::post('/refunds/{id}/escalate', [CustomerSupportController::class, 'escalateRefund']);
            Route::get('/knowledge-base', [CustomerSupportController::class, 'knowledgeBase']);
            Route::get('/knowledge-base/{id}', [CustomerSupportController::class, 'knowledgeBaseArticle']);
            // FR-KYC-05 — CS KYC review queue
            Route::get('/kyc', [\App\Http\Controllers\Api\v1\Admin\KycReviewController::class, 'index']);
            Route::get('/kyc/{id}', [\App\Http\Controllers\Api\v1\Admin\KycReviewController::class, 'show'])->whereNumber('id');
            Route::post('/kyc/{id}/approve', [\App\Http\Controllers\Api\v1\Admin\KycReviewController::class, 'approve'])->whereNumber('id');
            Route::post('/kyc/{id}/reject', [\App\Http\Controllers\Api\v1\Admin\KycReviewController::class, 'reject'])->whereNumber('id');
        });

        // Division escalation queues + notifications (Sprint 8.0) — now Workflow-backed (8.2)
        Route::prefix('admin/escalations')->middleware([EnsureRole::class . ':customer_support,operations,finance,marketing,owner'])->group(function () {
            Route::get('/notifications', [\App\Http\Controllers\Api\v1\Admin\EscalationController::class, 'notifications']);
            Route::put('/notifications/read-all', [\App\Http\Controllers\Api\v1\Admin\EscalationController::class, 'markAllNotificationsRead']);
            Route::put('/notifications/{id}/read', [\App\Http\Controllers\Api\v1\Admin\EscalationController::class, 'markNotificationRead']);
            Route::get('/{division}', [\App\Http\Controllers\Api\v1\Admin\EscalationController::class, 'index'])
                ->where('division', 'operations|finance|marketing|customer_support');

            // Sprint 2 Revision — Finding 1: `update` adalah transisi status
            // operasional (assign/resolve/reject/close) milik divisi, BUKAN
            // approval/override khusus Owner (FR-OWN04). Owner harus tetap
            // read-only di sini; role divisi pemilik tidak terdampak.
            Route::middleware([EnsureOwnerReadOnly::class])->group(function () {
                Route::patch('/items/{id}', [\App\Http\Controllers\Api\v1\Admin\EscalationController::class, 'update']);
            });
        });

        // Workflow Engine (Sprint 8.2)
        Route::prefix('admin/workflows')->middleware([EnsureRole::class . ':customer_support,operations,finance,marketing,owner'])->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'store']);
            Route::get('/stats/{division}', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'stats'])
                ->where('division', 'customer-support|customer_support|operations|finance|marketing|admin|owner');
            Route::get('/{id}', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'show'])->whereNumber('id');

            // Sprint 2 Revision — Finding 1 (Owner Read-Only Bypass):
            // escalate/actions/close/assign/reassign adalah operasi workflow
            // OPERASIONAL harian milik divisi (Finance/Operations/Marketing/
            // CS), bukan mekanisme "Approval Pengecualian/Override" FR-OWN04.
            // Owner wajib read-only di sini; role divisi (finance/operations/
            // marketing/customer_support) dan Super Admin tidak terdampak.
            Route::middleware([EnsureOwnerReadOnly::class])->group(function () {
                Route::post('/{id}/escalate', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'escalate'])->whereNumber('id');
                Route::post('/{id}/actions', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'action'])->whereNumber('id');
                Route::post('/{id}/close', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'close'])->whereNumber('id');
                Route::post('/{id}/assign', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'assign'])->whereNumber('id');
                Route::post('/{id}/reassign', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'reassign'])->whereNumber('id');
            });

            // override & force-resolve TETAP TANPA EnsureOwnerReadOnly — ini
            // adalah mekanisme approval/override khusus Owner (SRS FR-OWN04 /
            // Bagian 5 baris "Approval Pengecualian/Override" = Penuh untuk
            // Owner). Sudah dibatasi assertOwner() di controller (hanya
            // owner/super_admin yang boleh memanggilnya).
            Route::post('/{id}/override', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'override'])->whereNumber('id');
            Route::post('/{id}/force-resolve', [\App\Http\Controllers\Api\v1\Admin\WorkflowController::class, 'forceResolve'])->whereNumber('id');
        });

        // Executive Owner Administration Module
        Route::prefix('admin/executive')->middleware([EnsureRole::class . ':owner'])->group(function () {
            Route::get('/dashboard', [OwnerController::class, 'dashboard']);
            Route::get('/command-center', [OwnerController::class, 'commandCenter']);
            Route::get('/business-health', [OwnerController::class, 'businessHealth']);
            Route::get('/alerts', [OwnerController::class, 'executiveAlerts']);
            Route::get('/risks', [OwnerController::class, 'risks']);
            Route::get('/goals', [OwnerController::class, 'goals']);
            Route::get('/profit', [OwnerController::class, 'profit']);
            Route::get('/treasury', [OwnerController::class, 'treasury']);
            // FR-DIFF-10 — 30-day cash-flow projection (read-only)
            Route::get('/cash-flow-projection', \App\Http\Controllers\Api\v1\Admin\OwnerCashFlowController::class);
            Route::get('/insights', [OwnerController::class, 'insights']);
            Route::get('/workflow-monitor', [OwnerController::class, 'workflowMonitor']);
            Route::get('/workflow-timeline', [OwnerController::class, 'workflowTimeline']);
            Route::get('/approvals', [OwnerController::class, 'approvals']);
            Route::post('/approvals/{workflowId}/decide', [OwnerController::class, 'decideApproval'])->whereNumber('workflowId');
            // SRS 30 — Owner may approve/reject Mitra (separate from Ops read-only policy)
            Route::get('/partners', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'index']);
            Route::post('/partners/{id}/approve', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'approve'])->whereNumber('id');
            Route::post('/partners/{id}/reject', [\App\Http\Controllers\Api\v1\Admin\PartnerApiAdminController::class, 'reject'])->whereNumber('id');
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
        // EnsureOwnerReadOnly: SRS Bagian 5 — Sprint 2 keputusan #1. Owner hanya "Lihat" (Marketing/Operations tidak terpengaruh).
        Route::prefix('admin/website')->middleware([EnsureRole::class . ':marketing,owner,operations', EnsureOwnerReadOnly::class])->group(function () {
            Route::get('/homepage-builder', [\App\Http\Controllers\Api\v1\Admin\HomepageBuilderController::class, 'show']);
            Route::get('/homepage-builder/permissions', [\App\Http\Controllers\Api\v1\Admin\HomepageBuilderController::class, 'permissions']);
            Route::get('/homepage-builder/preview', [\App\Http\Controllers\Api\v1\Admin\HomepageBuilderController::class, 'preview']);
            Route::put('/homepage-builder/draft', [\App\Http\Controllers\Api\v1\Admin\HomepageBuilderController::class, 'saveDraft']);
            Route::post('/homepage-builder/reorder', [\App\Http\Controllers\Api\v1\Admin\HomepageBuilderController::class, 'reorder']);
            Route::post('/homepage-builder/discard', [\App\Http\Controllers\Api\v1\Admin\HomepageBuilderController::class, 'discard']);
            Route::post('/homepage-builder/publish', [\App\Http\Controllers\Api\v1\Admin\HomepageBuilderController::class, 'publish']);
            Route::post('/homepage-builder/rollback/{versionId}', [\App\Http\Controllers\Api\v1\Admin\HomepageBuilderController::class, 'rollback']);

            // Legal Center (Sprint 7.3)
            Route::get('/legal-center', [\App\Http\Controllers\Api\v1\Admin\LegalCenterController::class, 'index']);
            Route::get('/legal-center/permissions', [\App\Http\Controllers\Api\v1\Admin\LegalCenterController::class, 'permissions']);
            Route::get('/legal-center/{slug}', [\App\Http\Controllers\Api\v1\Admin\LegalCenterController::class, 'show']);
            Route::get('/legal-center/{slug}/preview', [\App\Http\Controllers\Api\v1\Admin\LegalCenterController::class, 'preview']);
            Route::put('/legal-center/{slug}/draft', [\App\Http\Controllers\Api\v1\Admin\LegalCenterController::class, 'saveDraft']);
            Route::post('/legal-center/{slug}/discard', [\App\Http\Controllers\Api\v1\Admin\LegalCenterController::class, 'discard']);
            Route::post('/legal-center/{slug}/publish', [\App\Http\Controllers\Api\v1\Admin\LegalCenterController::class, 'publish']);
            Route::post('/legal-center/{slug}/rollback/{versionId}', [\App\Http\Controllers\Api\v1\Admin\LegalCenterController::class, 'rollback']);
        });

        // EnsureOwnerReadOnly: SRS Bagian 5 — Sprint 2 keputusan #1. Owner hanya "Lihat" di modul Marketing (Banner & Konten Promosi).
        Route::prefix('admin/website')->middleware([EnsureRole::class . ':marketing,owner', EnsureOwnerReadOnly::class])->group(function () {
            // Website Settings
            Route::get('/settings', [WebsiteSettingController::class, 'index']);
            Route::post('/settings', [WebsiteSettingController::class, 'store']);
            Route::get('/settings/{id}', [WebsiteSettingController::class, 'show']);
            Route::put('/settings/{id}', [WebsiteSettingController::class, 'update']);
            Route::patch('/settings/{id}', [WebsiteSettingController::class, 'patch']);
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
        // EnsureOwnerReadOnly: SRS Bagian 5 — Sprint 2 keputusan #1. Owner hanya "Lihat" (Banner & Konten Promosi).
        Route::prefix('admin/media')->middleware([EnsureRole::class . ':marketing,owner', EnsureOwnerReadOnly::class])->group(function () {
            Route::get('/', [MediaController::class, 'index']);
            Route::post('/', [MediaController::class, 'store']);
            Route::get('/{id}', [MediaController::class, 'show']);
            Route::put('/{id}', [MediaController::class, 'update']);
            Route::delete('/{id}', [MediaController::class, 'destroy']);
        });

    });

});
