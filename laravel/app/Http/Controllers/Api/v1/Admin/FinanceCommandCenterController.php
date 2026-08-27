<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\FinanceAlert;
use App\Models\FinanceLedgerEntry;
use App\Models\FinanceSettlement;
use App\Services\Finance\FinanceAlertService;
use App\Services\Finance\FinanceCommandCenterService;
use App\Services\Finance\FinanceLedgerService;
use App\Services\Finance\FinanceReportService;
use App\Services\Finance\FinanceSettlementService;
use App\Services\Finance\FinanceTreasuryService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceCommandCenterController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected FinanceCommandCenterService $commandCenter,
        protected FinanceTreasuryService $treasury,
        protected FinanceLedgerService $ledger,
        protected FinanceSettlementService $settlements,
        protected FinanceAlertService $alerts,
        protected FinanceReportService $reports
    ) {}

    public function commandCenter(): JsonResponse
    {
        return $this->successResponse('Finance Command Center.', $this->commandCenter->overview());
    }

    public function treasury(): JsonResponse
    {
        return $this->successResponse('Treasury snapshot.', $this->treasury->snapshot());
    }

    public function providerDeposits(): JsonResponse
    {
        $snap = $this->treasury->snapshot();

        return $this->successResponse('Provider deposits.', [
            'deposits' => $snap['providerDeposits'] ?? [],
            'total' => $snap['providerDepositTotal'] ?? 0,
        ]);
    }

    public function refreshProviderDeposits(): JsonResponse
    {
        $rows = $this->treasury->refreshProviderDeposits();
        app(FinanceAlertService::class)->evaluate();

        return $this->successResponse('Provider deposits refreshed.', ['deposits' => $rows]);
    }

    public function paymentGateways(): JsonResponse
    {
        $overview = $this->commandCenter->overview();

        return $this->successResponse('Payment gateway monitoring.', [
            'gateways' => $overview['paymentGatewayHealth'] ?? [],
        ]);
    }

    public function walletMonitor(): JsonResponse
    {
        return $this->successResponse('Wallet monitoring.', $this->commandCenter->walletMonitor());
    }

    public function ledgerIndex(Request $request): JsonResponse
    {
        $paginator = $this->ledger->list($request->query());
        $items = collect($paginator->items())->map(fn (FinanceLedgerEntry $e) => $this->ledger->payload($e));

        return $this->successResponse('Finance ledger.', [
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function ledgerShow(int $id): JsonResponse
    {
        $entry = FinanceLedgerEntry::query()->with(['user:id,name,email', 'creator:id,name', 'transaction'])->findOrFail($id);

        return $this->successResponse('Ledger entry.', $this->ledger->payload($entry));
    }

    public function settlementIndex(Request $request): JsonResponse
    {
        $paginator = $this->settlements->list($request->query());
        $items = collect($paginator->items())->map(fn (FinanceSettlement $s) => $this->settlements->payload($s));

        return $this->successResponse('Settlement queue.', [
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function settlementStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'gateway' => 'required|string|max:64',
            'provider' => 'nullable|string|max:64',
            'amount' => 'required|numeric|min:1',
            'currency' => 'nullable|string|max:8',
            'batchNumber' => 'nullable|string|max:128',
            'batch_number' => 'nullable|string|max:128',
            'settlementReference' => 'nullable|string|max:191',
            'settlement_reference' => 'nullable|string|max:191',
            'notes' => 'nullable|string|max:5000',
            'evidence' => 'nullable|array',
        ]);

        $row = $this->settlements->create($request->user(), $data);

        return $this->successResponse('Settlement dibuat.', $this->settlements->payload($row), 201);
    }

    public function settlementShow(int $id): JsonResponse
    {
        $row = FinanceSettlement::query()->with(['creator', 'reviewer', 'workflow'])->findOrFail($id);

        return $this->successResponse('Settlement detail.', $this->settlements->payload($row));
    }

    public function settlementUpdate(Request $request, int $id): JsonResponse
    {
        $row = FinanceSettlement::query()->findOrFail($id);
        $data = $request->validate([
            'status' => 'nullable|in:pending,processing,completed,cancelled,failed',
            'notes' => 'nullable|string|max:5000',
            'evidence' => 'nullable|array',
            'batchNumber' => 'nullable|string|max:128',
            'batch_number' => 'nullable|string|max:128',
            'settlementReference' => 'nullable|string|max:191',
            'settlement_reference' => 'nullable|string|max:191',
        ]);

        $row = $this->settlements->update($row, $request->user(), $data);

        return $this->successResponse('Settlement diperbarui.', $this->settlements->payload($row));
    }

    public function alertsIndex(Request $request): JsonResponse
    {
        $paginator = $this->alerts->list($request->query());
        $items = collect($paginator->items())->map(fn (FinanceAlert $a) => $this->alerts->payload($a));

        return $this->successResponse('Finance alerts.', [
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function alertsEvaluate(): JsonResponse
    {
        $created = $this->alerts->evaluate();

        return $this->successResponse('Alerts evaluated.', [
            'created' => count($created),
            'items' => collect($created)->map(fn ($a) => $this->alerts->payload($a))->all(),
        ]);
    }

    public function alertAck(int $id): JsonResponse
    {
        $alert = FinanceAlert::query()->findOrFail($id);

        return $this->successResponse('Alert acknowledged.', $this->alerts->payload($this->alerts->acknowledge($alert)));
    }

    public function alertResolve(int $id): JsonResponse
    {
        $alert = FinanceAlert::query()->findOrFail($id);

        return $this->successResponse('Alert resolved.', $this->alerts->payload($this->alerts->resolve($alert)));
    }

    public function structuredReports(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'startDate' => 'nullable|date',
            'endDate' => 'nullable|date',
            'period' => 'nullable|in:daily,weekly,monthly',
        ]);

        $normalized = $this->reports->resolvePeriodFilters(
            $filters['period'] ?? null,
            $filters['start_date'] ?? $filters['startDate'] ?? null,
            $filters['end_date'] ?? $filters['endDate'] ?? null
        );

        return $this->successResponse('Structured financial report.', $this->reports->generate($normalized));
    }

    public function widgets(Request $request, string $audience): JsonResponse
    {
        $allowed = ['customer_support', 'cs', 'operations', 'marketing'];
        if (! in_array($audience, $allowed, true)) {
            return $this->errorResponse('Audience tidak valid.', 422);
        }

        $role = $request->user()->role instanceof \App\Enums\UserRole
            ? $request->user()->role->value
            : (string) $request->user()->role;

        $map = [
            'customer_support' => ['customer_support', 'owner', 'super_admin'],
            'cs' => ['customer_support', 'owner', 'super_admin'],
            'operations' => ['operations', 'owner', 'super_admin'],
            'marketing' => ['marketing', 'owner', 'super_admin'],
        ];
        // Finance may also read widgets
        if (! in_array($role, array_merge($map[$audience] ?? [], ['finance']), true)) {
            abort(403, 'Tidak berwenang.');
        }

        return $this->successResponse('Finance widgets.', $this->commandCenter->widgetsFor($audience));
    }
}
