<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\OpsAlert;
use App\Models\Workflow;
use App\Services\Operations\OpsAlertService;
use App\Services\Operations\OpsCommandCenterService;
use App\Services\Operations\OpsIssueDetailService;
use App\Services\Operations\OpsMonitoringService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OpsCommandCenterController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected OpsCommandCenterService $commandCenter,
        protected OpsMonitoringService $monitoring,
        protected OpsAlertService $alerts,
        protected OpsIssueDetailService $issueDetail
    ) {}

    public function commandCenter(): JsonResponse
    {
        return $this->successResponse('Operations Command Center.', $this->commandCenter->overview());
    }

    public function infra(): JsonResponse
    {
        return $this->successResponse('Infra monitoring.', $this->monitoring->probe());
    }

    public function refreshInfra(): JsonResponse
    {
        $this->monitoring->bumpSchedulerHeartbeat();
        $probe = $this->monitoring->probe();
        $created = $this->alerts->evaluate();

        return $this->successResponse('Infra refreshed.', [
            'infra' => $probe,
            'alertsCreated' => count($created),
        ]);
    }

    public function liveTransactions(Request $request): JsonResponse
    {
        $paginator = $this->commandCenter->liveTransactions($request->query());
        $items = collect($paginator->items())->map(
            fn ($tx) => $this->commandCenter->transactionPayload($tx)
        );

        return $this->successResponse('Live transactions.', [
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function activityTimeline(Request $request): JsonResponse
    {
        return $this->successResponse(
            'Ops activity timeline.',
            ['items' => $this->commandCenter->activityTimeline($request->query())]
        );
    }

    public function alertsIndex(Request $request): JsonResponse
    {
        $paginator = $this->alerts->list($request->query());
        $items = collect($paginator->items())->map(fn (OpsAlert $a) => $this->alerts->payload($a));

        return $this->successResponse('Ops alerts.', [
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function alertsEvaluate(): JsonResponse
    {
        $created = $this->alerts->evaluate();

        return $this->successResponse('Alerts evaluated.', [
            'created' => collect($created)->map(fn (OpsAlert $a) => $this->alerts->payload($a))->all(),
            'count' => count($created),
        ]);
    }

    public function alertAck(int $id, Request $request): JsonResponse
    {
        $alert = OpsAlert::query()->findOrFail($id);

        return $this->successResponse(
            'Alert acknowledged.',
            $this->alerts->payload($this->alerts->transition($alert, $request->user(), 'acknowledged'))
        );
    }

    public function alertInvestigate(int $id, Request $request): JsonResponse
    {
        $alert = OpsAlert::query()->findOrFail($id);

        return $this->successResponse(
            'Alert investigating.',
            $this->alerts->payload($this->alerts->transition($alert, $request->user(), 'investigating'))
        );
    }

    public function alertResolve(int $id, Request $request): JsonResponse
    {
        $alert = OpsAlert::query()->findOrFail($id);

        return $this->successResponse(
            'Alert resolved.',
            $this->alerts->payload($this->alerts->transition($alert, $request->user(), 'resolved'))
        );
    }

    public function alertClose(int $id, Request $request): JsonResponse
    {
        $alert = OpsAlert::query()->findOrFail($id);

        return $this->successResponse(
            'Alert closed.',
            $this->alerts->payload($this->alerts->transition($alert, $request->user(), 'closed'))
        );
    }

    public function issueDetail(int $workflowId): JsonResponse
    {
        $workflow = Workflow::query()->findOrFail($workflowId);

        return $this->successResponse('Ops issue detail.', $this->issueDetail->build($workflow));
    }
}
