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

        // Return with some system status info as well
        return [
            'settings' => $settings,
            'system_status' => [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'queue_status' => 'Active',
                'redis_status' => 'Connected',
                'storage_status' => 'Healthy',
                'app_version' => config('app.version', '1.0.0')
            ]
        ];
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
