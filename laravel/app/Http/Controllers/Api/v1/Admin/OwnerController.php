<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Owner\OwnerDashboardAction;
use App\Actions\Admin\Owner\FinancialOverviewAction;
use App\Actions\Admin\Owner\DepartmentOverviewAction;
use App\Actions\Admin\Owner\SystemHealthAction;
use App\Actions\Admin\Owner\AuditLogAction;
use App\Actions\Admin\Owner\ActivityTimelineAction;
use App\Http\Requests\Admin\Owner\AuditLogFilterRequest;
use App\Http\Resources\AuditLogResource;
use Illuminate\Http\JsonResponse;

class OwnerController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get Executive Owner Dashboard.
     * GET /api/v1/admin/executive/dashboard
     */
    public function dashboard(OwnerDashboardAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data dashboard eksekutif berhasil dimuat.', $data);
    }

    /**
     * Get Financial Overview.
     * GET /api/v1/admin/executive/financial-overview
     */
    public function financialOverview(FinancialOverviewAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data ringkasan keuangan berhasil dimuat.', $data);
    }

    /**
     * Get Department Overview.
     * GET /api/v1/admin/executive/department-overview
     */
    public function departmentOverview(DepartmentOverviewAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data ringkasan departemen berhasil dimuat.', $data);
    }

    /**
     * Get System Health Status.
     * GET /api/v1/admin/executive/system-health
     */
    public function systemHealth(SystemHealthAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data status kesehatan sistem berhasil dimuat.', $data);
    }

    /**
     * Get Paginated Audit Logs.
     * GET /api/v1/admin/executive/audit-logs
     */
    public function auditLogs(AuditLogFilterRequest $request, AuditLogAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->execute($filters);

        return $this->paginatedResponse(
            'Daftar log audit berhasil dimuat.',
            AuditLogResource::collection($paginator->items()),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Get Activity Timeline.
     * GET /api/v1/admin/executive/activity-timeline
     */
    public function activityTimeline(ActivityTimelineAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data lini masa aktivitas berhasil dimuat.', $data);
    }
}
