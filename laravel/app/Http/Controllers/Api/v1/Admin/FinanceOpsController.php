<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Actions\Finance\ApproveDepositAction;
use App\Actions\Finance\ApproveWithdrawAction;
use App\Actions\Finance\HoldWithdrawAction;
use App\Actions\Finance\RejectDepositAction;
use App\Actions\Finance\RejectWithdrawAction;
use App\Http\Concerns\HandlesIdempotentRequests;
use App\Http\Controllers\Controller;
use App\Models\DepositRequest;
use App\Models\WithdrawRequest;
use App\Services\Finance\FinanceReportService;
use App\Services\Finance\FinanceWalletQueryService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Sprint 4 Finance ops — FR-FIN-01..05, FR-FIN-08 export surfaces.
 */
class FinanceOpsController extends Controller
{
    use ApiResponseTrait;
    use HandlesIdempotentRequests;

    public function __construct(
        protected FinanceWalletQueryService $walletQuery,
        protected FinanceReportService $reportService
    ) {}

    /** FR-FIN-01 */
    public function wallets(Request $request): JsonResponse
    {
        $paginator = $this->walletQuery->listWallets($request->only(['q', 'search', 'status', 'per_page']));

        return $this->paginatedResponse(
            'Daftar saldo pengguna berhasil dimuat.',
            $paginator->items(),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /** FR-FIN-01 */
    public function walletMutations(int $userId, Request $request): JsonResponse
    {
        try {
            $paginator = $this->walletQuery->mutationsForUser($userId, $request->only(['type', 'per_page']));

            return $this->paginatedResponse(
                'Riwayat mutasi saldo berhasil dimuat.',
                $paginator->items(),
                [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                ]
            );
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return $this->errorResponse('Wallet pengguna tidak ditemukan.', 404);
        }
    }

    /** FR-FIN-03 */
    public function deposits(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->input('per_page', 20)));
        $query = DepositRequest::query()->with(['user:id,name,email,phone_number', 'reviewer:id,name,email'])->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        $paginator = $query->paginate($perPage);

        return $this->paginatedResponse('Antrean deposit manual berhasil dimuat.', $paginator->items(), [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }

    public function depositShow(int $id): JsonResponse
    {
        $row = DepositRequest::with(['user', 'reviewer', 'transaction'])->find($id);
        if (!$row) {
            return $this->errorResponse('Deposit tidak ditemukan.', 404);
        }

        return $this->successResponse('Detail deposit manual.', $row);
    }

    public function depositApprove(int $id, Request $request, ApproveDepositAction $action): JsonResponse
    {
        $deposit = DepositRequest::find($id);
        if (!$deposit) {
            return $this->errorResponse('Deposit tidak ditemukan.', 404);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/admin/finance/deposits/'.$id.'/approve',
                ['deposit_request_id' => (string) $id],
                function () use ($deposit, $action, $request) {
                    $result = $action->execute($deposit, $request->user());

                    return $this->idempotentJson('Deposit manual disetujui dan saldo dikreditkan.', $result);
                }
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    public function depositReject(int $id, Request $request, RejectDepositAction $action): JsonResponse
    {
        $data = $request->validate([
            'reason' => 'required|string|max:500',
            'idempotency_key' => 'nullable|string|max:80',
        ]);
        $deposit = DepositRequest::find($id);
        if (!$deposit) {
            return $this->errorResponse('Deposit tidak ditemukan.', 404);
        }

        try {
            if (!empty($data['idempotency_key'])) {
                return $this->withIdempotency(
                    $request,
                    'POST /api/v1/admin/finance/deposits/'.$id.'/reject',
                    ['deposit_request_id' => (string) $id, 'reason' => $data['reason']],
                    function () use ($deposit, $action, $request, $data) {
                        $result = $action->execute($deposit, $request->user(), $data['reason']);

                        return $this->idempotentJson('Deposit manual ditolak.', $result);
                    }
                );
            }

            $result = $action->execute($deposit, $request->user(), $data['reason']);

            return $this->successResponse('Deposit manual ditolak.', $result);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /** FR-FIN-04 — Midtrans auto deposit monitoring only */
    public function automaticDeposits(Request $request): JsonResponse
    {
        $paginator = $this->walletQuery->automaticDeposits($request->only(['status', 'q', 'per_page']));

        return $this->paginatedResponse('Riwayat deposit otomatis Midtrans.', $paginator->items(), [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }

    /** FR-FIN-05 */
    public function withdrawals(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->input('per_page', 20)));
        $query = WithdrawRequest::query()
            ->where('workflow', WithdrawRequest::WORKFLOW_HOLD_QUEUE)
            ->with(['user:id,name,email,phone_number', 'reviewer:id,name,email', 'transaction'])
            ->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        $paginator = $query->paginate($perPage);

        return $this->paginatedResponse('Antrean withdraw berhasil dimuat.', $paginator->items(), [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }

    public function withdrawalShow(int $id): JsonResponse
    {
        $row = WithdrawRequest::with(['user', 'reviewer', 'transaction'])->find($id);
        if (!$row) {
            return $this->errorResponse('Withdraw tidak ditemukan.', 404);
        }

        return $this->successResponse('Detail withdraw.', $row);
    }

    public function withdrawalApprove(int $id, Request $request, ApproveWithdrawAction $action): JsonResponse
    {
        $row = WithdrawRequest::find($id);
        if (!$row) {
            return $this->errorResponse('Withdraw tidak ditemukan.', 404);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/admin/finance/withdrawals/'.$id.'/approve',
                ['withdraw_request_id' => (string) $id, 'notes' => $request->input('notes')],
                function () use ($row, $action, $request) {
                    $result = $action->execute($row, $request->user(), $request->input('notes'));

                    return $this->idempotentJson('Withdraw disetujui.', $result);
                }
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    public function withdrawalReject(int $id, Request $request, RejectWithdrawAction $action): JsonResponse
    {
        $data = $request->validate([
            'reason' => 'required|string|max:500',
            'idempotency_key' => 'required|string|max:80',
        ]);
        $row = WithdrawRequest::find($id);
        if (!$row) {
            return $this->errorResponse('Withdraw tidak ditemukan.', 404);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/admin/finance/withdrawals/'.$id.'/reject',
                ['withdraw_request_id' => (string) $id, 'reason' => $data['reason']],
                function () use ($row, $action, $request, $data) {
                    $result = $action->execute($row, $request->user(), $data['reason']);

                    return $this->idempotentJson('Withdraw ditolak dan saldo di-unhold.', $result);
                }
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    public function withdrawalHold(int $id, Request $request, HoldWithdrawAction $action): JsonResponse
    {
        $data = $request->validate([
            'notes' => 'nullable|string|max:500',
            'idempotency_key' => 'required|string|max:80',
        ]);
        $row = WithdrawRequest::find($id);
        if (!$row) {
            return $this->errorResponse('Withdraw tidak ditemukan.', 404);
        }

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/admin/finance/withdrawals/'.$id.'/hold',
                ['withdraw_request_id' => (string) $id, 'notes' => $data['notes'] ?? null],
                function () use ($row, $action, $request, $data) {
                    $result = $action->execute($row, $request->user(), $data['notes'] ?? null);

                    return $this->idempotentJson('Withdraw ditahan untuk verifikasi.', $result);
                }
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }

    /** FR-FIN-08 */
    public function exportReport(Request $request): StreamedResponse|JsonResponse
    {
        $data = $request->validate([
            'format' => 'required|in:xlsx,pdf,excel',
            'period' => 'nullable|in:daily,weekly,monthly',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $filters = $this->reportService->resolvePeriodFilters(
            $data['period'] ?? null,
            $data['start_date'] ?? null,
            $data['end_date'] ?? null
        );
        $report = $this->reportService->generate($filters);
        $format = $data['format'] === 'excel' ? 'xlsx' : $data['format'];

        if ($format === 'pdf') {
            return $this->reportService->exportPdf($report);
        }

        return $this->reportService->exportExcel($report);
    }
}
