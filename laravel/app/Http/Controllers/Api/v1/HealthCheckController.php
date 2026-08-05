<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;

class HealthCheckController extends Controller
{
    /**
     * Standard Liveness & Readiness probe.
     */
    public function health(): JsonResponse
    {
        $dbConnected = false;
        try {
            DB::connection()->getPdo();
            $dbConnected = true;
        } catch (\Exception $e) {
            // DB Down
        }

        $cacheConnected = false;
        try {
            Cache::put('health_check', 'ok', 10);
            if (Cache::get('health_check') === 'ok') {
                $cacheConnected = true;
            }
        } catch (\Exception $e) {
            // Cache Down
        }

        $queueConnected = false;
        try {
            if (Schema::hasTable('jobs')) {
                DB::table('jobs')->count();
                $queueConnected = true;
            } else {
                Queue::size();
                $queueConnected = true;
            }
        } catch (\Exception $e) {
            // Queue backend unreachable
        }

        $overallStatus = ($dbConnected && $cacheConnected) ? 'UP' : 'DEGRADED';

        return response()->json([
            'status' => $overallStatus,
            'timestamp' => now()->toIso8601String(),
            'services' => [
                'database' => $dbConnected ? 'UP' : 'DOWN',
                'cache' => $cacheConnected ? 'UP' : 'DOWN',
                'queue' => $queueConnected ? 'UP' : 'DOWN',
            ],
            'version' => '1.0.0',
        ], $overallStatus === 'UP' ? 200 : 500);
    }

    /**
     * Detailed Application Status and metadata.
     */
    public function status(): JsonResponse
    {
        $payload = [
            'status' => 'healthy',
            'timezone' => config('app.timezone'),
            'request_tracing' => [
                'correlation_enabled' => true,
                'request_id_enabled' => true,
            ],
        ];

        // Sensitive runtime details only for authenticated metrics access path
        // (this method is already behind ProtectHealthMetrics).
        if (!app()->environment('production')) {
            $payload['environment'] = app()->environment();
            $payload['debug_mode'] = (bool) config('app.debug');
            $payload['php_version'] = PHP_VERSION;
            $payload['laravel_version'] = app()->version();
        }

        return response()->json($payload);
    }

    /**
     * Dashboard Metrics & Observability endpoint.
     */
    public function metrics(): JsonResponse
    {
        $date = now()->format('Y-m-d');

        // 1. Queue Length & Failed Jobs
        $queueLength = 0;
        try {
            if (Schema::hasTable('jobs')) {
                $queueLength = DB::table('jobs')->count();
            } else {
                $queueLength = Queue::size();
            }
        } catch (\Exception $e) {
            $queueLength = 0;
        }

        $failedJobs = 0;
        try {
            if (Schema::hasTable('failed_jobs')) {
                $failedJobs = DB::table('failed_jobs')->count();
            }
        } catch (\Exception $e) {
            $failedJobs = 0;
        }

        // 2. Average Queue Time (calculated from actual settlement activity logs).
        // Null when no callback metrics have been recorded yet.
        $avgQueueTime = null;
        try {
            $logs = ActivityLog::where('activity', 'midtrans_callback_metric')->get();
            if ($logs->count() > 0) {
                $totalSecs = 0;
                $count = 0;
                foreach ($logs as $log) {
                    $delay = $log->payload['callback_delay_seconds'] ?? 0;
                    if ($delay > 0) {
                        $totalSecs += $delay;
                        $count++;
                    }
                }
                if ($count > 0) {
                    $avgQueueTime = round($totalSecs / $count, 2);
                }
            }
        } catch (\Exception $e) {
            $avgQueueTime = null;
        }

        // 3. Daily Transactions
        $dailyTransactions = 0;
        try {
            $dailyTransactions = Transaction::whereDate('created_at', $date)->count();
        } catch (\Exception $e) {
            $dailyTransactions = 0;
        }

        // 4. Daily Revenue
        $dailyRevenue = 0;
        try {
            $dailyRevenue = (float) Transaction::whereDate('created_at', $date)
                ->whereIn('status', ['success', 'sukses'])
                ->sum('amount');
        } catch (\Exception $e) {
            $dailyRevenue = 0.00;
        }

        // 5. Digiflazz Success Rate (non-midtrans transactions).
        // Null when there is no transaction volume to measure.
        $digiflazzSuccessRate = null;
        try {
            $digiTotal = Transaction::whereDate('created_at', $date)
                ->where('payment_method', '!=', 'midtrans')
                ->count();
            if ($digiTotal > 0) {
                $digiSuccess = Transaction::whereDate('created_at', $date)
                    ->where('payment_method', '!=', 'midtrans')
                    ->whereIn('status', ['success', 'sukses'])
                    ->count();
                $digiflazzSuccessRate = round(($digiSuccess / $digiTotal) * 100, 2);
            }
        } catch (\Exception $e) {
            $digiflazzSuccessRate = null;
        }

        // 6. Midtrans Success Rate. Null when there is no volume to measure.
        $midtransSuccessRate = null;
        try {
            $midtransTotal = Transaction::whereDate('created_at', $date)
                ->where('payment_method', 'midtrans')
                ->count();
            if ($midtransTotal > 0) {
                $midtransSuccess = Transaction::whereDate('created_at', $date)
                    ->where('payment_method', 'midtrans')
                    ->whereIn('status', ['success', 'sukses'])
                    ->count();
                $midtransSuccessRate = round(($midtransSuccess / $midtransTotal) * 100, 2);
            }
        } catch (\Exception $e) {
            $midtransSuccessRate = null;
        }

        return response()->json([
            'queue_length' => $queueLength,
            'failed_jobs' => $failedJobs,
            'average_queue_time_seconds' => $avgQueueTime,
            'daily_transactions' => $dailyTransactions,
            'daily_revenue' => $dailyRevenue,
            'digiflazz_success_rate_percent' => $digiflazzSuccessRate,
            'midtrans_success_rate_percent' => $midtransSuccessRate,
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
