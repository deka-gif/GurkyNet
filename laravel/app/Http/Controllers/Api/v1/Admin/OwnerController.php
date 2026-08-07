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
use App\Models\Workflow;
use App\Services\Executive\ExecutiveCommandCenterService;
use App\Services\Workflow\WorkflowEngineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OwnerController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get Executive Owner Dashboard (Sprint 8.5 Command Center).
     * GET /api/v1/admin/executive/dashboard
     */
    public function dashboard(OwnerDashboardAction $action): JsonResponse
    {
        $data = $action->execute();

        return $this->successResponse('Data dashboard eksekutif berhasil dimuat.', $data);
    }

    /**
     * Alias / focused command-center payload.
     * GET /api/v1/admin/executive/command-center
     */
    public function commandCenter(ExecutiveCommandCenterService $service): JsonResponse
    {
        return $this->successResponse('Executive Command Center.', $service->overview());
    }

    public function businessHealth(ExecutiveCommandCenterService $service): JsonResponse
    {
        $cc = $service->overview();

        return $this->successResponse('Business health.', $cc['businessHealth'] ?? []);
    }

    public function executiveAlerts(ExecutiveCommandCenterService $service): JsonResponse
    {
        return $this->successResponse('Executive alerts.', ['data' => $service->executiveAlerts(50)]);
    }

    public function risks(ExecutiveCommandCenterService $service): JsonResponse
    {
        $cc = $service->overview();

        return $this->successResponse('Business risks.', ['data' => $cc['risks'] ?? []]);
    }

    public function goals(ExecutiveCommandCenterService $service): JsonResponse
    {
        $cc = $service->overview();

        return $this->successResponse('Goal tracker.', $cc['goals'] ?? []);
    }

    public function profit(ExecutiveCommandCenterService $service): JsonResponse
    {
        return $this->successResponse('Profit monitor.', $service->profitMonitor());
    }

    public function treasury(ExecutiveCommandCenterService $service): JsonResponse
    {
        $cc = $service->overview();

        return $this->successResponse('Treasury snapshot.', $cc['treasury'] ?? []);
    }

    public function insights(ExecutiveCommandCenterService $service): JsonResponse
    {
        $cc = $service->overview();

        return $this->successResponse('Business insights.', ['data' => $cc['insights'] ?? []]);
    }

    public function workflowMonitor(ExecutiveCommandCenterService $service): JsonResponse
    {
        return $this->successResponse('Workflow monitor.', $service->workflowMonitor());
    }

    public function workflowTimeline(ExecutiveCommandCenterService $service): JsonResponse
    {
        return $this->successResponse('Executive workflow timeline.', ['items' => $service->workflowTimeline(50)]);
    }

    public function approvals(ExecutiveCommandCenterService $service): JsonResponse
    {
        return $this->successResponse('Executive approvals.', ['data' => $service->pendingApprovals()]);
    }

    public function decideApproval(int $workflowId, Request $request, ExecutiveCommandCenterService $service): JsonResponse
    {
        $workflow = Workflow::query()->findOrFail($workflowId);
        $fresh = $service->decideApproval($workflow, $request->user(), $request->all());

        return $this->successResponse(
            'Executive decision recorded.',
            app(WorkflowEngineService::class)->payload($fresh)
        );
    }

    public function financialOverview(FinancialOverviewAction $action): JsonResponse
    {
        $data = $action->execute();

        return $this->successResponse('Data ringkasan keuangan berhasil dimuat.', $data);
    }

    public function departmentOverview(DepartmentOverviewAction $action): JsonResponse
    {
        $data = $action->execute();

        return $this->successResponse('Data ringkasan departemen berhasil dimuat.', $data);
    }

    public function systemHealth(SystemHealthAction $action): JsonResponse
    {
        $data = $action->execute();

        return $this->successResponse('Data status kesehatan sistem berhasil dimuat.', $data);
    }

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

    public function activityTimeline(ActivityTimelineAction $action): JsonResponse
    {
        $data = $action->execute();

        return $this->successResponse('Data lini masa aktivitas berhasil dimuat.', $data);
    }
}
