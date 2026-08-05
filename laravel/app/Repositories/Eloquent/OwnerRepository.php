<?php

namespace App\Repositories\Eloquent;

use App\Repositories\Contracts\OwnerRepositoryInterface;
use App\Models\ActivityLog;
use App\Models\User;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\Provider;
use App\Models\BannerPromotion;
use App\Models\SupportTicket;
use App\Models\DigiflazzTransaction;
use App\Models\MidtransTransaction;
use App\Enums\UserRole;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class OwnerRepository implements OwnerRepositoryInterface
{
    /**
     * Get executive dashboard metrics.
     */
    public function getDashboardMetrics(): array
    {
        $todayStr = now()->toDateString();
        $thisMonth = now()->month;
        $thisYear = now()->year;

        // Today's Revenue (success transactions total payment)
        $todayRevenue = Transaction::where('status', 'success')
            ->whereDate('created_at', $todayStr)
            ->sum('total_payment');

        // Monthly Revenue
        $monthlyRevenue = Transaction::where('status', 'success')
            ->whereMonth('created_at', $thisMonth)
            ->whereYear('created_at', $thisYear)
            ->sum('total_payment');

        // Total Users
        $totalUsers = User::where('role', UserRole::USER)->count();

        // Active Users (at least 1 transaction)
        $activeUsers = User::where('role', UserRole::USER)
            ->whereHas('transactions')
            ->count();

        // Total Transactions
        $totalTransactions = Transaction::count();

        // Success Rate & Failed Rate
        $successCount = Transaction::where('status', 'success')->count();
        $failedCount = Transaction::whereIn('status', ['failed', 'canceled'])->count();

        $successRate = $totalTransactions > 0
            ? round(($successCount / $totalTransactions) * 100, 2)
            : null;

        $failedRate = $totalTransactions > 0
            ? round(($failedCount / $totalTransactions) * 100, 2)
            : null;

        // Wallet Balance
        $walletBalance = Wallet::sum('balance');

        // Provider health derived from real provider activation state
        $totalProviders = Provider::count();
        $inactiveProviders = Provider::where('is_active', false)->count();
        $providerHealth = $totalProviders === 0
            ? 'No Providers'
            : ($inactiveProviders === 0 ? 'Normal' : "Degraded ({$inactiveProviders} inactive)");

        // Queue status from the real jobs table when available
        $pendingJobs = $this->countPendingQueueJobs();
        $queueStatus = $pendingJobs === null ? 'Unavailable' : "{$pendingJobs} Pending";

        // System health from real failed-jobs / pending transaction signals
        $failedJobs = $this->countFailedQueueJobs();
        $systemHealth = ($failedJobs !== null && $failedJobs > 0) ? 'Degraded' : 'Healthy';

        return [
            'today_revenue' => (float) $todayRevenue,
            'monthly_revenue' => (float) $monthlyRevenue,
            'total_users' => $totalUsers,
            'active_users' => $activeUsers,
            'total_transactions' => $totalTransactions,
            'success_rate' => $successRate !== null ? $successRate . '%' : null,
            'failed_rate' => $failedRate !== null ? $failedRate . '%' : null,
            'wallet_balance' => (float) $walletBalance,
            'provider_health' => $providerHealth,
            'queue_status' => $queueStatus,
            'system_health' => $systemHealth,
        ];
    }

    /**
     * Count pending jobs in the queue table, or null when the table is absent.
     */
    protected function countPendingQueueJobs(): ?int
    {
        try {
            if (!\Illuminate\Support\Facades\Schema::hasTable('jobs')) {
                return null;
            }

            return (int) DB::table('jobs')->count();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Count failed jobs, or null when the table is absent.
     */
    protected function countFailedQueueJobs(): ?int
    {
        try {
            if (!\Illuminate\Support\Facades\Schema::hasTable('failed_jobs')) {
                return null;
            }

            return (int) DB::table('failed_jobs')->count();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Get financial overview.
     */
    public function getFinancialOverview(): array
    {
        $days = collect(range(6, 0))->map(fn($day) => now()->subDays($day)->toDateString());

        $revenueTrend = [];
        $transactionTrend = [];
        $refundTrend = [];
        $settlementTrend = [];

        foreach ($days as $date) {
            $dailySuccess = Transaction::where('status', 'success')->whereDate('created_at', $date);
            $dailyFailed = Transaction::whereIn('status', ['failed', 'canceled'])->whereDate('created_at', $date);

            $revenueTrend[] = [
                'date' => $date,
                'revenue' => (float) $dailySuccess->sum('total_payment'),
            ];

            $transactionTrend[] = [
                'date' => $date,
                'total' => (int) Transaction::whereDate('created_at', $date)->count(),
                'success' => (int) $dailySuccess->count(),
                'failed' => (int) $dailyFailed->count(),
            ];

            $refundTrend[] = [
                'date' => $date,
                'amount' => (float) $dailyFailed->sum('total_payment'),
                'count' => (int) $dailyFailed->count(),
            ];

            $settlementTrend[] = [
                'date' => $date,
                'amount' => (float) $dailySuccess->sum('amount'), // Base amount
            ];
        }

        return [
            'revenue_trend' => $revenueTrend,
            'transaction_trend' => $transactionTrend,
            'refund_trend' => $refundTrend,
            'settlement_trend' => $settlementTrend,
        ];
    }

    /**
     * Get department overview KPI.
     */
    public function getDepartmentOverview(): array
    {
        // 1. Finance KPI
        $financeKpi = [
            'outstanding_refunds' => Transaction::whereIn('status', ['failed', 'canceled'])->count(),
            'total_settlement' => (float) Transaction::where('status', 'success')->sum('amount'),
            'wallet_balance' => (float) Wallet::sum('balance'),
        ];

        // 2. Operations KPI — fulfillment time computed from real Digiflazz transaction records
        $avgFulfillmentSeconds = DigiflazzTransaction::whereIn('digiflazz_status', ['success', 'Sukses'])
            ->whereColumn('updated_at', '>', 'created_at')
            ->get(['created_at', 'updated_at'])
            ->map(fn ($row) => $row->updated_at->diffInSeconds($row->created_at, true))
            ->avg();

        $operationsKpi = [
            'active_providers' => Provider::where('is_active', true)->count(),
            'total_products' => \App\Models\Product::count(),
            'provider_latency' => $avgFulfillmentSeconds !== null
                ? round($avgFulfillmentSeconds, 1) . 's'
                : null,
        ];

        // 3. Marketing KPI
        $marketingKpi = [
            'active_promotions' => BannerPromotion::where('is_active', true)->count(),
            'total_vouchers' => BannerPromotion::where('type', 'voucher')->count(),
            'used_vouchers_count' => BannerPromotion::sum('used_count'),
        ];

        // 4. Customer Support KPI
        $customerSupportKpi = [
            'open_tickets' => SupportTicket::whereIn('status', ['Terbuka', 'Open'])->count(),
            'pending_tickets' => SupportTicket::where('status', 'Pending')->count(),
            'resolved_today' => SupportTicket::whereIn('status', ['Selesai', 'Resolved', 'Closed', 'Tertutup'])
                ->whereDate('updated_at', now()->toDateString())
                ->count(),
        ];

        return [
            'finance_kpi' => $financeKpi,
            'operations_kpi' => $operationsKpi,
            'marketing_kpi' => $marketingKpi,
            'customer_support_kpi' => $customerSupportKpi,
        ];
    }

    /**
     * Get system health metrics from live infrastructure and provider checks.
     */
    public function getSystemHealth(): array
    {
        // Database connectivity
        try {
            DB::connection()->getPdo();
            $databaseStatus = 'Connected';
        } catch (\Throwable) {
            $databaseStatus = 'Disconnected';
        }

        // Cache store round-trip using the actually configured driver
        $cacheDriver = config('cache.default');
        try {
            $probe = 'health_probe_' . now()->timestamp;
            \Illuminate\Support\Facades\Cache::put($probe, 'ok', 5);
            $cacheStatus = \Illuminate\Support\Facades\Cache::get($probe) === 'ok'
                ? "Connected ({$cacheDriver})"
                : "Degraded ({$cacheDriver})";
            \Illuminate\Support\Facades\Cache::forget($probe);
        } catch (\Throwable) {
            $cacheStatus = "Disconnected ({$cacheDriver})";
        }

        // Queue backlog from the real jobs table
        $pendingJobs = $this->countPendingQueueJobs();
        $failedJobs = $this->countFailedQueueJobs();
        if ($pendingJobs === null) {
            $queueStatus = 'Unavailable (driver: ' . config('queue.default') . ')';
        } else {
            $queueStatus = ($pendingJobs === 0 ? 'Idle' : 'Active') . " ({$pendingJobs} pending"
                . ($failedJobs ? ", {$failedJobs} failed" : '') . ')';
        }

        // Live Digiflazz deposit balance (cached briefly to avoid hammering the API)
        $digiflazzService = app(\App\Services\DigiflazzService::class);
        if (!$digiflazzService->isConfigured()) {
            $digiflazzStatus = 'Not Configured';
        } else {
            $balance = \Illuminate\Support\Facades\Cache::remember(
                'digiflazz_balance',
                60,
                fn () => $digiflazzService->checkBalance()
            );
            $digiflazzStatus = $balance !== null
                ? 'Connected (Balance: Rp ' . number_format($balance, 0, ',', '.') . ')'
                : 'Unreachable';
        }

        // Midtrans configuration state (no lightweight ping endpoint exists)
        $midtransServerKey = (string) config('services.midtrans.server_key', env('MIDTRANS_SERVER_KEY', ''));
        $midtransStatus = ($midtransServerKey !== '' && $midtransServerKey !== 'dummy_server_key')
            ? 'Configured'
            : 'Not Configured';

        // Real storage usage of the application disk
        try {
            $total = disk_total_space(storage_path());
            $free = disk_free_space(storage_path());
            $usedPercent = ($total > 0) ? round((($total - $free) / $total) * 100) : null;
            $storageStatus = $usedPercent !== null
                ? ($usedPercent >= 90 ? "Critical ({$usedPercent}% used)" : "Normal ({$usedPercent}% used)")
                : 'Unavailable';
        } catch (\Throwable) {
            $storageStatus = 'Unavailable';
        }

        return [
            'application_status' => 'Up',
            'database_status' => $databaseStatus,
            'redis_status' => $cacheStatus,
            'queue_status' => $queueStatus,
            'digiflazz_status' => $digiflazzStatus,
            'midtrans_status' => $midtransStatus,
            'storage_status' => $storageStatus,
        ];
    }

    /**
     * Get paginated audit logs with filters.
     */
    public function getAuditLogs(array $filters): LengthAwarePaginator
    {
        $perPage = $filters['per_page'] ?? 15;
        $query = ActivityLog::with(['user:id,name,email,role']);

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('activity', 'like', "%{$search}%")
                  ->orWhere('payload', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%")
                         ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        if (!empty($filters['module'])) {
            $module = strtoupper($filters['module']);
            $query->where('activity', 'like', "%{$module}%");
        }

        if (!empty($filters['operator'])) {
            $operator = $filters['operator'];
            $query->whereHas('user', function ($uq) use ($operator) {
                $uq->where('id', $operator)
                   ->orWhere('name', 'like', "%{$operator}%")
                   ->orWhere('email', 'like', "%{$operator}%");
            });
        }

        if (!empty($filters['date'])) {
            $query->whereDate('created_at', $filters['date']);
        }

        return $query->latest()->paginate($perPage);
    }

    /**
     * Get recent activity timeline.
     */
    public function getActivityTimeline(): array
    {
        $recentActivities = ActivityLog::with('user:id,name,email,role')
            ->latest()
            ->take(10)
            ->get();

        $systemEvents = ActivityLog::where('activity', 'like', 'SYSTEM_%')
            ->orWhere('activity', 'like', 'QUEUE_%')
            ->latest()
            ->take(10)
            ->get();

        $adminActivities = ActivityLog::whereHas('user', function ($q) {
                $q->where('role', '!=', UserRole::USER);
            })
            ->with('user:id,name,email,role')
            ->latest()
            ->take(10)
            ->get();

        $gatewayEvents = ActivityLog::whereIn('activity', [
                'DIGIFLAZZ_CALLBACK',
                'MIDTRANS_CALLBACK',
                'DIGIFLAZZ_INQUIRY',
                'MIDTRANS_PAYMENT'
            ])
            ->latest()
            ->take(10)
            ->get();

        return [
            'recent_activities' => $recentActivities,
            'system_events' => $systemEvents,
            'admin_activities' => $adminActivities,
            'gateway_events' => $gatewayEvents,
        ];
    }
}
