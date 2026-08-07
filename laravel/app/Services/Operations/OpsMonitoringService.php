<?php

namespace App\Services\Operations;

use App\Models\ProductProvider;
use App\Services\Payment\PaymentGatewayControlService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Schema;

class OpsMonitoringService
{
    public const HEARTBEAT_KEY = 'ops:scheduler:heartbeat';

    public function __construct(
        protected PaymentGatewayControlService $gateways
    ) {}

    public function bumpSchedulerHeartbeat(): void
    {
        Cache::put(self::HEARTBEAT_KEY, now()->toIso8601String(), now()->addDay());
    }

    /**
     * App-level probes. OS metrics return available=false / na — never invent numbers.
     *
     * @return array<string, mixed>
     */
    public function probe(): array
    {
        return [
            'redis' => $this->probeRedis(),
            'database' => $this->probeDatabase(),
            'cache' => $this->probeCache(),
            'queue' => $this->probeQueue(),
            'failed_jobs' => $this->probeFailedJobs(),
            'jobs_backlog' => $this->probeJobsBacklog(),
            'scheduler' => $this->probeScheduler(),
            'providers' => $this->probeProviders(),
            'payment_gateways' => $this->probeGateways(),
            'os' => [
                'cpu' => $this->na('cpu'),
                'ram' => $this->na('ram'),
                'disk' => $this->na('disk'),
            ],
            'probed_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @return array{available: bool, status: string, value: mixed, message?: string}
     */
    protected function na(string $metric): array
    {
        return [
            'available' => false,
            'status' => 'na',
            'value' => null,
            'message' => 'Metric Not Available — '.$metric.' requires host agent (out of scope)',
        ];
    }

    /**
     * @return array{available: bool, status: string, value: mixed, message?: string}
     */
    protected function probeRedis(): array
    {
        try {
            $pong = Redis::connection()->ping();
            $ok = $pong === true || $pong === 'PONG' || (is_object($pong) && method_exists($pong, '__toString') && (string) $pong === 'PONG');

            return [
                'available' => true,
                'status' => $ok ? 'up' : 'down',
                'value' => $ok ? 'PONG' : (string) $pong,
            ];
        } catch (\Throwable $e) {
            return [
                'available' => true,
                'status' => 'down',
                'value' => null,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * @return array{available: bool, status: string, value: mixed}
     */
    protected function probeDatabase(): array
    {
        try {
            DB::select('select 1 as ok');

            return ['available' => true, 'status' => 'up', 'value' => 1];
        } catch (\Throwable $e) {
            return [
                'available' => true,
                'status' => 'down',
                'value' => null,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * @return array{available: bool, status: string, value: mixed}
     */
    protected function probeCache(): array
    {
        try {
            $key = 'ops:monitor:cache_probe';
            Cache::put($key, '1', 10);
            $ok = Cache::get($key) === '1';

            return [
                'available' => true,
                'status' => $ok ? 'up' : 'degraded',
                'value' => config('cache.default'),
            ];
        } catch (\Throwable $e) {
            return [
                'available' => true,
                'status' => 'down',
                'value' => null,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * @return array{available: bool, status: string, value: mixed}
     */
    protected function probeQueue(): array
    {
        try {
            $connection = config('queue.default');

            return [
                'available' => true,
                'status' => $connection ? 'up' : 'down',
                'value' => $connection,
            ];
        } catch (\Throwable $e) {
            return [
                'available' => true,
                'status' => 'down',
                'value' => null,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * @return array{available: bool, status: string, value: int|null}
     */
    protected function probeFailedJobs(): array
    {
        if (! Schema::hasTable('failed_jobs')) {
            return ['available' => false, 'status' => 'na', 'value' => null, 'message' => 'failed_jobs table missing'];
        }
        try {
            $count = (int) DB::table('failed_jobs')->count();

            return [
                'available' => true,
                'status' => $count >= 10 ? 'warning' : 'up',
                'value' => $count,
            ];
        } catch (\Throwable $e) {
            return ['available' => true, 'status' => 'down', 'value' => null, 'message' => $e->getMessage()];
        }
    }

    /**
     * @return array{available: bool, status: string, value: int|null, message?: string}
     */
    protected function probeJobsBacklog(): array
    {
        if (! Schema::hasTable('jobs')) {
            return [
                'available' => false,
                'status' => 'na',
                'value' => null,
                'message' => 'jobs table not used (driver may be redis/sync)',
            ];
        }
        try {
            $count = (int) DB::table('jobs')->count();

            return [
                'available' => true,
                'status' => $count > 100 ? 'warning' : 'up',
                'value' => $count,
            ];
        } catch (\Throwable $e) {
            return ['available' => true, 'status' => 'down', 'value' => null, 'message' => $e->getMessage()];
        }
    }

    /**
     * @return array{available: bool, status: string, value: mixed, message?: string}
     */
    protected function probeScheduler(): array
    {
        $hb = Cache::get(self::HEARTBEAT_KEY);
        if (! $hb) {
            return [
                'available' => true,
                'status' => 'stale',
                'value' => null,
                'message' => 'No heartbeat yet — run ops:heartbeat or schedule:run',
            ];
        }
        try {
            $at = \Carbon\Carbon::parse((string) $hb);
            $age = $at->diffInMinutes(now());
            $stale = $age > 15;

            return [
                'available' => true,
                'status' => $stale ? 'stale' : 'up',
                'value' => $hb,
                'age_minutes' => $age,
            ];
        } catch (\Throwable $e) {
            return ['available' => true, 'status' => 'stale', 'value' => $hb, 'message' => $e->getMessage()];
        }
    }

    /**
     * @return array{available: bool, status: string, value: list<array<string, mixed>>}
     */
    protected function probeProviders(): array
    {
        $rows = ProductProvider::query()
            ->get(['id', 'code', 'name', 'partner_status', 'health_color', 'avg_response_ms', 'is_active'])
            ->map(fn ($p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'partner_status' => $p->partner_status,
                'health_color' => $p->health_color,
                'avg_response_ms' => $p->avg_response_ms,
                'is_active' => (bool) $p->is_active,
            ])
            ->values()
            ->all();

        $critical = collect($rows)->contains(fn ($r) => in_array(strtolower((string) ($r['partner_status'] ?? '')), ['offline', 'down', 'error'], true)
            || ($r['health_color'] ?? '') === 'red');

        return [
            'available' => true,
            'status' => $critical ? 'warning' : 'up',
            'value' => $rows,
        ];
    }

    /**
     * @return array{available: bool, status: string, value: list<array<string, mixed>>}
     */
    protected function probeGateways(): array
    {
        $list = $this->gateways->listControlCenter();
        $offline = collect($list)->contains(function ($gw) {
            $s = strtolower((string) ($gw['status'] ?? $gw['partner_status'] ?? ''));

            return in_array($s, ['offline', 'error', 'down'], true);
        });

        return [
            'available' => true,
            'status' => $offline ? 'warning' : 'up',
            'value' => $list,
        ];
    }
}
