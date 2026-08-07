<?php

namespace App\Actions\Admin\Operations;

use App\Services\Monitoring\ServiceMonitoringService;

class OperationsMonitoringAction
{
    public function __construct(
        protected ServiceMonitoringService $monitoring
    ) {}

    public function execute(array $filters = []): array
    {
        return $this->monitoring->overview($filters);
    }

    public function refresh(array $filters = []): array
    {
        return $this->monitoring->refreshAndOverview($filters);
    }

    public function serviceDetail(string $serviceKey): array
    {
        return $this->monitoring->serviceDetail($serviceKey);
    }

    public function problematicSkus(string $serviceKey, ?int $productProviderId, int $page, int $perPage): array
    {
        return $this->monitoring->problematicSkus($serviceKey, $productProviderId, $page, $perPage);
    }
}
