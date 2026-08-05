<?php

namespace App\Actions\Admin\System;

use App\Repositories\Contracts\SystemSettingRepositoryInterface;

class SystemSettingAction
{
    protected $repository;

    public function __construct(SystemSettingRepositoryInterface $repository)
    {
        $this->repository = $repository;
    }

    /**
     * Get all system settings as a key-value pair.
     */
    public function getAllSettings(): array
    {
        $settings = $this->repository->getAll();

        return [
            'settings' => $settings,
            'system_status' => [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'queue_status' => $this->checkQueueStatus(),
                'redis_status' => $this->checkCacheStatus(),
                'storage_status' => $this->checkStorageStatus(),
                'app_version' => config('app.version', '1.0.0')
            ]
        ];
    }

    /**
     * Real queue backlog check against the jobs table.
     */
    protected function checkQueueStatus(): string
    {
        try {
            if (!\Illuminate\Support\Facades\Schema::hasTable('jobs')) {
                return 'Unavailable (driver: ' . config('queue.default') . ')';
            }

            $pending = \Illuminate\Support\Facades\DB::table('jobs')->count();

            return $pending === 0 ? 'Idle (0 pending)' : "Active ({$pending} pending)";
        } catch (\Throwable) {
            return 'Unavailable';
        }
    }

    /**
     * Real cache round-trip check on the configured store.
     */
    protected function checkCacheStatus(): string
    {
        $driver = config('cache.default');
        try {
            $probe = 'system_settings_probe_' . now()->timestamp;
            \Illuminate\Support\Facades\Cache::put($probe, 'ok', 5);
            $healthy = \Illuminate\Support\Facades\Cache::get($probe) === 'ok';
            \Illuminate\Support\Facades\Cache::forget($probe);

            return $healthy ? "Connected ({$driver})" : "Degraded ({$driver})";
        } catch (\Throwable) {
            return "Disconnected ({$driver})";
        }
    }

    /**
     * Real storage writability/usage check.
     */
    protected function checkStorageStatus(): string
    {
        try {
            if (!is_writable(storage_path())) {
                return 'Read-only';
            }

            $total = disk_total_space(storage_path());
            $free = disk_free_space(storage_path());
            if ($total > 0) {
                $usedPercent = round((($total - $free) / $total) * 100);

                return $usedPercent >= 90 ? "Critical ({$usedPercent}% used)" : "Healthy ({$usedPercent}% used)";
            }

            return 'Healthy';
        } catch (\Throwable) {
            return 'Unavailable';
        }
    }

    /**
     * Update settings.
     */
    public function updateSettings(array $data): array
    {
        $this->repository->update($data);

        return $this->getAllSettings();
    }
}
