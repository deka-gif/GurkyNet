<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Finance\FinanceDashboardAction;
use App\Actions\Admin\Finance\FinanceReportAction;
use App\Actions\Admin\Finance\FinanceRefundAction;
use App\Actions\Admin\Finance\FinanceSettlementAction;
use App\Http\Requests\Admin\Finance\FinanceReportRequest;
use App\Http\Requests\Admin\Finance\FinanceRefundFilterRequest;
use App\Http\Requests\Admin\Finance\FinanceRefundActionRequest;
use App\Http\Requests\Admin\Finance\FinanceSettlementFilterRequest;
use Illuminate\Http\JsonResponse;

class FinanceController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get Finance Dashboard Overview.
     * GET /api/v1/admin/finance/dashboard
     */
    public function dashboard(FinanceDashboardAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data dashboard keuangan berhasil dimuat.', $data);
    }

    /**
     * Get Export-Ready Financial Reports.
     * GET /api/v1/admin/finance/reports
     */
    public function reports(FinanceReportRequest $request, FinanceReportAction $action): JsonResponse
    {
        $filters = $request->validated();
        $data = $action->execute($filters);
        return $this->successResponse('Laporan keuangan berhasil ditarik.', $data);
    }

    /**
     * Get Paginated Refund Claims.
     * GET /api/v1/admin/finance/refunds
     */
    public function refunds(FinanceRefundFilterRequest $request, FinanceRefundAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar pengajuan refund berhasil dimuat.',
            $paginator->items(),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Approve Refund Claim.
     * POST /api/v1/admin/finance/refunds/{id}/approve
     */
    public function approveRefund(string|int $id, FinanceRefundActionRequest $request, FinanceRefundAction $action): JsonResponse
    {
        try {
            $notes = $request->input('notes');
            $transaction = $action->approve($id, $notes);
            return $this->successResponse('Pengajuan refund berhasil disetujui dan saldo telah dikembalikan.', $transaction);
        } catch (\Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            return $this->errorResponse($e->getMessage(), $code);
        }
    }

    /**
     * Reject Refund Claim.
     * POST /api/v1/admin/finance/refunds/{id}/reject
     */
    public function rejectRefund(string|int $id, FinanceRefundActionRequest $request, FinanceRefundAction $action): JsonResponse
    {
        try {
            $reason = $request->input('reason');
            $transaction = $action->reject($id, $reason);
            return $this->successResponse('Pengajuan refund telah ditolak.', $transaction);
        } catch (\Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            return $this->errorResponse($e->getMessage(), $code);
        }
    }

    /**
     * Get Settlement Logs and Statuses.
     * GET /api/v1/admin/finance/settlements
     */
    public function settlements(FinanceSettlementFilterRequest $request, FinanceSettlementAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->execute($filters);

        return $this->paginatedResponse(
            'Daftar rekapitulasi settlement berhasil dimuat.',
            $paginator->items(),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }
}
