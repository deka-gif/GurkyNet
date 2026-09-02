<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Repositories\Eloquent\UserRepository;
use App\Repositories\Contracts\OtpRepositoryInterface;
use App\Repositories\Eloquent\OtpRepository;
use App\Repositories\Contracts\WalletRepositoryInterface;
use App\Repositories\Eloquent\WalletRepository;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;
use App\Repositories\Eloquent\WalletHistoryRepository;
use App\Repositories\Contracts\CategoryRepositoryInterface;
use App\Repositories\Eloquent\CategoryRepository;
use App\Repositories\Contracts\ProviderRepositoryInterface;
use App\Repositories\Eloquent\ProviderRepository;
use App\Repositories\Contracts\ProductRepositoryInterface;
use App\Repositories\Eloquent\ProductRepository;
use App\Repositories\Contracts\TransactionRepositoryInterface;
use App\Repositories\Eloquent\TransactionRepository;
use App\Repositories\Contracts\TransactionItemRepositoryInterface;
use App\Repositories\Eloquent\TransactionItemRepository;
use App\Repositories\Contracts\FinanceRepositoryInterface;
use App\Repositories\Eloquent\FinanceRepository;
use App\Repositories\Contracts\OperationsRepositoryInterface;
use App\Repositories\Eloquent\OperationsRepository;
use App\Repositories\Contracts\MarketingRepositoryInterface;
use App\Repositories\Eloquent\MarketingRepository;
use App\Repositories\Contracts\CustomerSupportRepositoryInterface;
use App\Repositories\Eloquent\CustomerSupportRepository;
use App\Repositories\Contracts\OwnerRepositoryInterface;
use App\Repositories\Eloquent\OwnerRepository;
use App\Repositories\Contracts\ProfileRepositoryInterface;
use App\Repositories\Eloquent\ProfileRepository;
use App\Repositories\Contracts\WebsiteSettingRepositoryInterface;
use App\Repositories\Eloquent\WebsiteSettingRepository;
use App\Repositories\Contracts\HomepageSectionRepositoryInterface;
use App\Repositories\Eloquent\HomepageSectionRepository;
use App\Repositories\Contracts\WebsiteMenuRepositoryInterface;
use App\Repositories\Eloquent\WebsiteMenuRepository;
use App\Repositories\Contracts\StaticPageRepositoryInterface;
use App\Repositories\Eloquent\StaticPageRepository;

use App\Repositories\Contracts\SystemSettingRepositoryInterface;
use App\Repositories\Eloquent\SystemSettingRepository;
use App\Contracts\Realtime\RealtimeTransport;
use App\Services\Realtime\SseRealtimeTransport;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
        $this->app->bind(OtpRepositoryInterface::class, OtpRepository::class);
        $this->app->bind(WalletRepositoryInterface::class, WalletRepository::class);
        $this->app->bind(WalletHistoryRepositoryInterface::class, WalletHistoryRepository::class);
        $this->app->bind(CategoryRepositoryInterface::class, CategoryRepository::class);
        $this->app->bind(ProviderRepositoryInterface::class, ProviderRepository::class);
        $this->app->bind(ProductRepositoryInterface::class, ProductRepository::class);
        $this->app->bind(TransactionRepositoryInterface::class, TransactionRepository::class);
        $this->app->bind(TransactionItemRepositoryInterface::class, TransactionItemRepository::class);
        $this->app->bind(FinanceRepositoryInterface::class, FinanceRepository::class);
        $this->app->bind(OperationsRepositoryInterface::class, OperationsRepository::class);
        $this->app->bind(MarketingRepositoryInterface::class, MarketingRepository::class);
        $this->app->bind(CustomerSupportRepositoryInterface::class, CustomerSupportRepository::class);
        $this->app->bind(OwnerRepositoryInterface::class, OwnerRepository::class);
        $this->app->bind(ProfileRepositoryInterface::class, ProfileRepository::class);
        $this->app->bind(WebsiteSettingRepositoryInterface::class, WebsiteSettingRepository::class);
        $this->app->bind(HomepageSectionRepositoryInterface::class, HomepageSectionRepository::class);
        $this->app->bind(WebsiteMenuRepositoryInterface::class, WebsiteMenuRepository::class);
        $this->app->bind(StaticPageRepositoryInterface::class, StaticPageRepository::class);
        $this->app->bind(SystemSettingRepositoryInterface::class, SystemSettingRepository::class);

        // Sprint 8.0 — swap to ReverbRealtimeTransport later without changing services
        $this->app->singleton(RealtimeTransport::class, SseRealtimeTransport::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiters();

        // Runtime audit: every UPDATE touching product_providers
        \Illuminate\Support\Facades\DB::listen(function ($query) {
            $sql = (string) ($query->sql ?? '');
            if (!preg_match('/\bupdate\s+[`"\[]?product_providers[`"\]]?/i', $sql)) {
                return;
            }

            \Illuminate\Support\Facades\Log::info('EXEC TRACE — product_providers SQL UPDATE (DB::listen)', [
                'sql' => $sql,
                'bindings' => $query->bindings ?? [],
                'time_ms' => $query->time ?? null,
            ]);
        });

        // Define Authorization Gates for RBAC
        \Illuminate\Support\Facades\Gate::before(function (\App\Models\User $user, $ability) {
            if ($user->isSuperAdmin()) {
                return true;
            }
        });

        \Illuminate\Support\Facades\Gate::define('access-owner', function (\App\Models\User $user) {
            return $user->isOwner();
        });

        \Illuminate\Support\Facades\Gate::define('access-finance', function (\App\Models\User $user) {
            return $user->isFinance() || $user->isOwner();
        });

        \Illuminate\Support\Facades\Gate::define('access-operations', function (\App\Models\User $user) {
            return $user->isOperations() || $user->isOwner();
        });

        \Illuminate\Support\Facades\Gate::define('access-marketing', function (\App\Models\User $user) {
            return $user->isMarketing() || $user->isOwner();
        });

        \Illuminate\Support\Facades\Gate::define('access-customer-support', function (\App\Models\User $user) {
            return $user->isCustomerSupport() || $user->isOwner();
        });

        // Register Event driven layer mappings
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionCreated::class,
            \App\Listeners\SendNotification::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionCreated::class,
            \App\Listeners\WriteAuditLog::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionCreated::class,
            \App\Listeners\BroadcastEvent::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionCreated::class,
            \App\Listeners\AnalyticsCollector::class
        );

        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionProcessing::class,
            \App\Listeners\SendNotification::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionProcessing::class,
            \App\Listeners\WriteAuditLog::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionProcessing::class,
            \App\Listeners\BroadcastEvent::class
        );

        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionSuccess::class,
            \App\Listeners\SendNotification::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionSuccess::class,
            \App\Listeners\WriteAuditLog::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionSuccess::class,
            \App\Listeners\BroadcastEvent::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionSuccess::class,
            \App\Listeners\AnalyticsCollector::class
        );
        // FR-DIFF-01 — cashback/poin on SUCCESS product purchase
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionSuccess::class,
            \App\Listeners\AwardLoyaltyPoints::class
        );
        // SRS 31 / FR-REF-04 — referral commission (independent of loyalty)
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionSuccess::class,
            \App\Listeners\AwardReferralCommission::class
        );
        // SRS 30 / FR-API-07 — partner outbound webhook
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionSuccess::class,
            [\App\Listeners\DispatchPartnerWebhook::class, 'handleSuccess']
        );

        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionFailed::class,
            \App\Listeners\SendNotification::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionFailed::class,
            \App\Listeners\WriteAuditLog::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionFailed::class,
            \App\Listeners\BroadcastEvent::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionFailed::class,
            \App\Listeners\AnalyticsCollector::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\TransactionFailed::class,
            [\App\Listeners\DispatchPartnerWebhook::class, 'handleFailed']
        );

        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletCredited::class,
            \App\Listeners\PublishWalletBalanceUpdated::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletCredited::class,
            \App\Listeners\SendNotification::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletCredited::class,
            \App\Listeners\WriteAuditLog::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletCredited::class,
            \App\Listeners\BroadcastEvent::class
        );

        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletDebited::class,
            \App\Listeners\SendNotification::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletDebited::class,
            \App\Listeners\WriteAuditLog::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletDebited::class,
            \App\Listeners\BroadcastEvent::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletDebited::class,
            \App\Listeners\PublishWalletBalanceUpdated::class
        );

        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletCredited::class,
            \App\Listeners\RecordFinanceLedger::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\WalletDebited::class,
            \App\Listeners\RecordFinanceLedger::class
        );

        \Illuminate\Support\Facades\Event::listen(
            \App\Events\PaymentSettled::class,
            \App\Listeners\SendNotification::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\PaymentSettled::class,
            \App\Listeners\WriteAuditLog::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\PaymentSettled::class,
            \App\Listeners\BroadcastEvent::class
        );
        \Illuminate\Support\Facades\Event::listen(
            \App\Events\PaymentSettled::class,
            \App\Listeners\AnalyticsCollector::class
        );
    }

    /**
     * SRS Bagian 8.1 / 17 — named rate limiters (reuse existing numeric budgets).
     */
    protected function configureRateLimiters(): void
    {
        \Illuminate\Support\Facades\RateLimiter::for('login', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(20)->by(
                strtolower((string) ($request->input('phone_or_email') ?: $request->ip()))
            );
        });

        \Illuminate\Support\Facades\RateLimiter::for('otp', function (\Illuminate\Http\Request $request) {
            $id = (string) ($request->input('email') ?: $request->input('phone_number') ?: $request->ip());

            return \Illuminate\Cache\RateLimiting\Limit::perMinute(5)->by(strtolower($id));
        });

        \Illuminate\Support\Facades\RateLimiter::for('password-reset', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(10)->by(
                strtolower((string) ($request->input('email') ?: $request->ip()))
            );
        });

        \Illuminate\Support\Facades\RateLimiter::for('financial', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(30)->by(
                (string) ($request->user()?->id ?: $request->ip())
            );
        });

        \Illuminate\Support\Facades\RateLimiter::for('kyc-upload', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute(10)->by(
                (string) ($request->user()?->id ?: $request->ip())
            );
        });

        // Voucher Fisik bulk activation — job-level limiter (not an HTTP route throttle).
        // ProcessVoucherPhysicalBatchItem carries its own per-minute budget (resolved from
        // config('ppob.physical_batch.rate_limit_per_minute') per provider) and this limiter
        // just applies it, keyed by provider so Digiflazz/VIP never share one budget.
        \Illuminate\Support\Facades\RateLimiter::for(
            'voucher_physical_activation',
            function (\App\Jobs\ProcessVoucherPhysicalBatchItem $job) {
                return \Illuminate\Cache\RateLimiting\Limit::perMinute($job->rateLimitPerMinute)
                    ->by($job->providerCode);
            }
        );
    }
}
