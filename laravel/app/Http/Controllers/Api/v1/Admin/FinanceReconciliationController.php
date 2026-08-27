<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\BankStatementLine;
use App\Models\GatewayReconciliationItem;
use App\Models\ReconciliationClosing;
use App\Models\ReconciliationIncident;
use App\Services\Finance\Reconciliation\DailyClosingService;
use App\Services\Finance\Reconciliation\FinanceMatchReconciliationService;
use App\Services\Finance\Reconciliation\InternalWalletReconciliationService;
use App\Services\Finance\Reconciliation\MidtransReconciliationService;
use App\Services\Finance\Reconciliation\ProviderDailyReconciliationService;
use App\Services\Finance\Reconciliation\ReconciliationConfig;
use App\Services\Finance\Reconciliation\ReconciliationIncidentService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sprint 7 / SRS 18 + FR-FIN-07 — Finance reconciliation surfaces.
 */
class FinanceReconciliationController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected ReconciliationIncidentService $incidents,
        protected FinanceMatchReconciliationService $matches,
        protected ReconciliationConfig $config,
        protected DailyClosingService $closing
    ) {}

    public function incidents(Request $request): JsonResponse
    {
        $q = ReconciliationIncident::query()->orderByDesc('id');
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($type = $request->query('type')) {
            $q->where('type', $type);
        }

        $paginator = $q->paginate((int) $request->query('per_page', 30));

        return $this->successResponse('Reconciliation incidents.', [
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
            'threshold' => $this->config->threshold(),
        ]);
    }

    public function resolveIncident(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['notes' => 'nullable|string|max:2000']);
        $incident = ReconciliationIncident::query()->findOrFail($id);
        $resolved = $this->incidents->resolve($incident, $request->user(), $data['notes'] ?? null);

        return $this->successResponse('Incident resolved; freeze released if applicable.', $resolved);
    }

    public function gatewayQueue(Request $request): JsonResponse
    {
        $q = GatewayReconciliationItem::query()->orderByDesc('id');
        if ($status = $request->query('status')) {
            $q->where('match_status', $status);
        }
        if ($source = $request->query('source')) {
            $q->where('source', $source);
        }
        $paginator = $q->paginate((int) $request->query('per_page', 30));

        return $this->successResponse('Gateway reconciliation queue.', [
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function matchGateway(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'internal_type' => 'nullable|string|max:64',
            'internal_id' => 'nullable|integer',
            'internal_amount' => 'nullable|numeric',
            'evidence' => 'nullable|string|max:2000',
            'reference' => 'nullable|string|max:500',
        ]);
        $item = GatewayReconciliationItem::query()->findOrFail($id);

        return $this->successResponse('Gateway item matched.', $this->matches->matchGatewayItem($item, $request->user(), $data));
    }

    public function discrepancyGateway(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'internal_amount' => 'nullable|numeric',
            'external_amount' => 'nullable|numeric',
            'evidence' => 'nullable|string|max:2000',
            'reference' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:2000',
        ]);
        $item = GatewayReconciliationItem::query()->findOrFail($id);

        return $this->successResponse('Gateway discrepancy marked.', $this->matches->markGatewayDiscrepancy($item, $request->user(), $data));
    }

    public function bankLines(Request $request): JsonResponse
    {
        $q = BankStatementLine::query()->orderByDesc('id');
        if ($status = $request->query('status')) {
            $q->where('match_status', $status);
        }
        $paginator = $q->paginate((int) $request->query('per_page', 30));

        return $this->successResponse('Bank statement lines.', [
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function importBank(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:4096',
        ]);

        $import = $this->matches->importBankCsv($request->file('file'), $request->user());

        return $this->successResponse('Bank statement imported.', $import, 201);
    }

    public function matchBank(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'internal_type' => 'nullable|string|max:64',
            'internal_id' => 'nullable|integer',
            'internal_amount' => 'nullable|numeric',
            'evidence' => 'nullable|string|max:2000',
            'reference' => 'nullable|string|max:500',
        ]);
        $line = BankStatementLine::query()->findOrFail($id);

        return $this->successResponse('Bank line matched.', $this->matches->matchBankLine($line, $request->user(), $data));
    }

    public function discrepancyBank(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'internal_amount' => 'nullable|numeric',
            'internal_type' => 'nullable|string|max:64',
            'internal_id' => 'nullable|integer',
            'evidence' => 'nullable|string|max:2000',
            'reference' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:2000',
        ]);
        $line = BankStatementLine::query()->findOrFail($id);

        return $this->successResponse('Bank discrepancy marked.', $this->matches->markBankDiscrepancy($line, $request->user(), $data));
    }

    public function closings(Request $request): JsonResponse
    {
        $rows = ReconciliationClosing::query()->orderByDesc('closing_date')->limit(60)->get();

        return $this->successResponse('Daily closing snapshots.', ['data' => $rows]);
    }

    public function runJob(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mode' => 'required|in:internal,provider,midtrans,midtrans-pending,closing',
        ]);

        $result = match ($data['mode']) {
            'internal' => app(InternalWalletReconciliationService::class)->run(),
            'provider' => app(ProviderDailyReconciliationService::class)->run(),
            'midtrans' => app(MidtransReconciliationService::class)->runDailySettlement(),
            'midtrans-pending' => app(MidtransReconciliationService::class)->pollPendingDeposits(),
            'closing' => ['closing' => $this->closing->run()],
        };

        return $this->successResponse('Reconciliation job executed.', $result);
    }
}
