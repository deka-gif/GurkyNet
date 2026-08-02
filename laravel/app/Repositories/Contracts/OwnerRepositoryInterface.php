<?php

namespace App\Repositories\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface OwnerRepositoryInterface
{
    /**
     * Get executive dashboard metrics.
     */
    public function getDashboardMetrics(): array;

    /**
     * Get financial overview.
     */
    public function getFinancialOverview(): array;

    /**
     * Get department overview KPI.
     */
    public function getDepartmentOverview(): array;

    /**
     * Get system health metrics.
     */
    public function getSystemHealth(): array;

    /**
     * Get paginated audit logs with filters.
     */
    public function getAuditLogs(array $filters): LengthAwarePaginator;

    /**
     * Get recent activity timeline.
     */
    public function getActivityTimeline(): array;
}
