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
use Carbon\Carbon;

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

        $yesterdayRevenue = Transaction::where('status', 'success')
            ->whereDate('created_at', now()->subDay()->toDateString())
            ->sum('total_payment');

        // Monthly Revenue
        $monthlyRevenue = Transaction::where('status', 'success')
            ->whereMonth('created_at', $thisMonth)
            ->whereYear('created_at', $thisYear)
            ->sum('total_payment');

        $lastMonth = now()->subMonth();
        $lastMonthRevenue = Transaction::where('status', 'success')
            ->whereMonth('created_at', $lastMonth->month)
            ->whereYear('created_at', $lastMonth->year)
            ->sum('total_payment');

        // Total Users
        $totalUsers = User::where('role', UserRole::USER)->count();
        $usersYesterday = User::where('role', UserRole::USER)
            ->whereDate('created_at', '<=', now()->subDay()->toDateString())
            ->count();

        // Active Users (at least 1 transaction)
        $activeUsers = User::where('role', UserRole::USER)
            ->whereHas('transactions')
            ->count();

        // Total Transactions
        $totalTransactions = Transaction::count();
        $todayTransactions = Transaction::whereDate('created_at', $todayStr)->count();

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

        $todayRevenueChange = $yesterdayRevenue > 0
            ? (($todayRevenue - $yesterdayRevenue) >= 0 ? '+' : '')
                . round((($todayRevenue - $yesterdayRevenue) / $yesterdayRevenue) * 100, 1) . '% vs kemarin'
            : ($todayRevenue > 0 ? '+100% vs kemarin' : null);

        $monthlyRevenueChange = $lastMonthRevenue > 0
            ? (($monthlyRevenue - $lastMonthRevenue) >= 0 ? '+' : '')
                . round((($monthlyRevenue - $lastMonthRevenue) / $lastMonthRevenue) * 100, 1) . '% vs bulan lalu'
            : ($monthlyRevenue > 0 ? '+100% vs bulan lalu' : null);

        $usersChange = $usersYesterday > 0
            ? (($totalUsers - $usersYesterday) >= 0 ? '+' : '')
                . ($totalUsers - $usersYesterday) . ' pengguna baru'
            : ($totalUsers . ' pengguna terdaftar');

        // Provider health derived from Digiflazz live connectivity + brand activation
        $digiflazzService = app(\App\Services\DigiflazzService::class);
        $digiflazzBalance = null;
        if ($digiflazzService->isConfigured()) {
            $digiflazzBalance = \Illuminate\Support\Facades\Cache::remember(
                'digiflazz_balance',
                60,
                fn () => $digiflazzService->checkBalance()
            );
        }

        $totalProviders = Provider::count();
        $inactiveProviders = Provider::where('is_active', false)->count();
        if (!$digiflazzService->isConfigured()) {
            $providerHealth = 'Digiflazz Not Configured';
        } elseif ($digiflazzBalance === null) {
            $providerHealth = 'Digiflazz Unreachable';
        } elseif ($totalProviders === 0) {
            $providerHealth = 'No Providers Synced';
        } else {
            $providerHealth = $inactiveProviders === 0
                ? 'Normal'
                : "Degraded ({$inactiveProviders} inactive)";
        }

        // Queue status from the real jobs table when available
        $pendingJobs = $this->countPendingQueueJobs();
        $queueStatus = $pendingJobs === null ? 'Unavailable' : "{$pendingJobs} Pending";

        // System health from real failed-jobs / pending transaction signals
        $failedJobs = $this->countFailedQueueJobs();
        $systemHealth = ($failedJobs !== null && $failedJobs > 0) ? 'Degraded' : 'Healthy';

        $syncStatus = \App\Models\Setting::where('key', 'digiflazz_last_sync_status')->value('value');
        $lastSyncAt = \App\Models\Setting::where('key', 'digiflazz_last_sync_at')->value('value');

        return [
            'today_revenue' => (float) $todayRevenue,
            'monthly_revenue' => (float) $monthlyRevenue,
            'total_users' => $totalUsers,
            'active_users' => $activeUsers,
            'total_transactions' => $totalTransactions,
            'today_transactions' => $todayTransactions,
            'success_rate' => $successRate !== null ? $successRate . '%' : null,
            'failed_rate' => $failedRate !== null ? $failedRate . '%' : null,
            'wallet_balance' => (float) $walletBalance,
            'today_revenue_change' => $todayRevenueChange,
            'monthly_revenue_change' => $monthlyRevenueChange,
            'users_change' => $usersChange,
            'provider_health' => $providerHealth,
            'provider_balance' => $digiflazzBalance,
            'provider_balance_formatted' => $digiflazzBalance !== null
                ? 'Rp ' . number_format($digiflazzBalance, 0, ',', '.')
                : null,
            'digiflazz_balance' => $digiflazzBalance,
            'digiflazz_sync_status' => $syncStatus,
            'digiflazz_last_sync_at' => $lastSyncAt,
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
        $days = collect(range(29, 0))->map(fn ($day) => now()->subDays($day)->toDateString());

        $revenueTrend = [];
        $transactionTrend = [];
        $refundTrend = [];
        $settlementTrend = [];
        $revenue30Days = [];
        $transaction30Days = [];

        foreach ($days as $date) {
            $dailySuccessQuery = Transaction::where('status', 'success')->whereDate('created_at', $date);
            $dailyFailedQuery = Transaction::whereIn('status', ['failed', 'canceled'])->whereDate('created_at', $date);

            $revenue = (float) (clone $dailySuccessQuery)->sum('total_payment');
            $successCount = (int) (clone $dailySuccessQuery)->count();
            $failedCount = (int) (clone $dailyFailedQuery)->count();
            $totalCount = (int) Transaction::whereDate('created_at', $date)->count();
            $refundAmount = (float) (clone $dailyFailedQuery)->sum('total_payment');
            $settlementAmount = (float) (clone $dailySuccessQuery)->sum('amount');

            $revenueTrend[] = [
                'date' => $date,
                'revenue' => $revenue,
            ];

            $transactionTrend[] = [
                'date' => $date,
                'total' => $totalCount,
                'success' => $successCount,
                'failed' => $failedCount,
            ];

            $refundTrend[] = [
                'date' => $date,
                'amount' => $refundAmount,
                'count' => $failedCount,
            ];

            $settlementTrend[] = [
                'date' => $date,
                'amount' => $settlementAmount,
            ];

            $revenue30Days[] = [
                'date' => Carbon::parse($date)->format('d M'),
                'day' => $date,
                'revenue' => $revenue,
                'amount' => $revenue,
            ];

            $transaction30Days[] = [
                'date' => Carbon::parse($date)->format('d M'),
                'day' => $date,
                'total' => $totalCount,
                'success' => $successCount,
                'failed' => $failedCount,
            ];
        }

        return [
            'revenue_trend' => $revenueTrend,
            'transaction_trend' => $transactionTrend,
            'refund_trend' => $refundTrend,
            'settlement_trend' => $settlementTrend,
            'revenue_30_days' => $revenue30Days,
            'transaction_30_days' => $transaction30Days,
            'revenueChart' => $revenue30Days,
            'transactionChart' => $transaction30Days,
            'wallet_balance' => (float) Wallet::sum('balance'),
            'total_profit_estimate' => (float) Transaction::where('status', 'success')->sum('admin_fee'),
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
     * Get system health metrics as a list for the Owner dashboard UI.
     * Digiflazz status/balance are live provider values — never hardcoded.
     */
    public function getSystemHealth(): array
    {
        // Database connectivity
        try {
            DB::connection()->getPdo();
            $databaseStatus = 'Online';
            $databaseNotes = 'Connected';
        } catch (\Throwable) {
            $databaseStatus = 'Offline';
            $databaseNotes = 'Disconnected';
        }

        // Cache store round-trip using the actually configured driver
        $cacheDriver = config('cache.default');
        try {
            $probe = 'health_probe_' . now()->timestamp;
            \Illuminate\Support\Facades\Cache::put($probe, 'ok', 5);
            $cacheOk = \Illuminate\Support\Facades\Cache::get($probe) === 'ok';
            \Illuminate\Support\Facades\Cache::forget($probe);
            $cacheStatus = $cacheOk ? 'Online' : 'Warning';
            $cacheNotes = ($cacheOk ? 'Connected' : 'Degraded') . " ({$cacheDriver})";
        } catch (\Throwable) {
            $cacheStatus = 'Offline';
            $cacheNotes = "Disconnected ({$cacheDriver})";
        }

        // Queue backlog from the real jobs table
        $pendingJobs = $this->countPendingQueueJobs();
        $failedJobs = $this->countFailedQueueJobs();
        if ($pendingJobs === null) {
            $queueStatus = 'Warning';
            $queueNotes = 'Unavailable (driver: ' . config('queue.default') . ')';
        } else {
            $queueStatus = ($failedJobs && $failedJobs > 0) ? 'Warning' : 'Online';
            $queueNotes = ($pendingJobs === 0 ? 'Idle' : 'Active') . " ({$pendingJobs} pending"
                . ($failedJobs ? ", {$failedJobs} failed" : '') . ')';
        }

        // Live Digiflazz deposit balance
        $digiflazzService = app(\App\Services\DigiflazzService::class);
        $digiflazzBalance = null;
        if (!$digiflazzService->isConfigured()) {
            $digiflazzStatus = 'Offline';
            $digiflazzNotes = 'Not Configured';
        } else {
            $digiflazzBalance = \Illuminate\Support\Facades\Cache::remember(
                'digiflazz_balance',
                60,
                fn () => $digiflazzService->checkBalance()
            );
            if ($digiflazzBalance !== null) {
                $digiflazzStatus = 'Online';
                $digiflazzNotes = 'Balance: Rp ' . number_format($digiflazzBalance, 0, ',', '.');
            } else {
                $digiflazzStatus = 'Warning';
                $digiflazzNotes = 'Unreachable';
            }
        }

        $lastSyncAt = \App\Models\Setting::where('key', 'digiflazz_last_sync_at')->value('value');
        $lastSyncStatus = \App\Models\Setting::where('key', 'digiflazz_last_sync_status')->value('value') ?? 'never';

        // Midtrans configuration state
        $midtransServerKey = (string) config('services.midtrans.server_key', env('MIDTRANS_SERVER_KEY', ''));
        $midtransConfigured = ($midtransServerKey !== '' && $midtransServerKey !== 'dummy_server_key');
        $midtransStatus = $midtransConfigured ? 'Online' : 'Offline';
        $midtransNotes = $midtransConfigured ? 'Configured' : 'Not Configured';

        // Real storage usage of the application disk
        try {
            $total = disk_total_space(storage_path());
            $free = disk_free_space(storage_path());
            $usedPercent = ($total > 0) ? round((($total - $free) / $total) * 100) : null;
            if ($usedPercent === null) {
                $storageStatus = 'Warning';
                $storageNotes = 'Unavailable';
            } elseif ($usedPercent >= 90) {
                $storageStatus = 'Warning';
                $storageNotes = "Critical ({$usedPercent}% used)";
            } else {
                $storageStatus = 'Online';
                $storageNotes = "Normal ({$usedPercent}% used)";
            }
        } catch (\Throwable) {
            $storageStatus = 'Warning';
            $storageNotes = 'Unavailable';
        }

        return [
            [
                'service' => 'Application',
                'type' => 'Core',
                'status' => 'Online',
                'notes' => 'Up',
                'latency' => '-',
            ],
            [
                'service' => 'Database',
                'type' => 'Infrastructure',
                'status' => $databaseStatus,
                'notes' => $databaseNotes,
                'latency' => '-',
            ],
            [
                'service' => 'Cache',
                'type' => 'Infrastructure',
                'status' => $cacheStatus,
                'notes' => $cacheNotes,
                'latency' => '-',
            ],
            [
                'service' => 'Queue',
                'type' => 'Infrastructure',
                'status' => $queueStatus,
                'notes' => $queueNotes,
                'latency' => '-',
            ],
            [
                'service' => 'Digiflazz',
                'type' => 'Provider',
                'status' => $digiflazzStatus,
                'notes' => $digiflazzNotes,
                'latency' => '-',
                'provider_balance' => $digiflazzBalance,
                'provider_health' => $digiflazzStatus,
                'last_sync' => $lastSyncAt,
                'sync_status' => $lastSyncStatus,
            ],
            [
                'service' => 'Midtrans',
                'type' => 'Payment Gateway',
                'status' => $midtransStatus,
                'notes' => $midtransNotes,
                'latency' => '-',
            ],
            [
                'service' => 'Storage',
                'type' => 'Infrastructure',
                'status' => $storageStatus,
                'notes' => $storageNotes,
                'latency' => '-',
            ],
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
