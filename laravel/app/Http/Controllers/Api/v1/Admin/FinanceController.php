<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Finance\FinanceDashboardAction;
use App\Actions\Admin\Finance\FinanceReportAction;
use App\Actions\Admin\Finance\FinanceRefundAction;
use App\Actions\Admin\Finance\FinanceSettlementAction;
use App\Actions\Wallet\AdjustWalletAction;
use App\Http\Requests\Admin\Finance\FinanceReportRequest;
use App\Http\Requests\Admin\Finance\FinanceRefundFilterRequest;
use App\Http\Requests\Admin\Finance\FinanceRefundActionRequest;
use App\Http\Requests\Admin\Finance\FinanceSettlementFilterRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            $existing = $action->find($id);
            if (!$existing) {
                return $this->errorResponse('Transaksi tidak ditemukan.', 404);
            }

            $alreadyRefunded = app(\App\Services\WalletRefundService::class)->hasExistingRefund($existing);
            $transaction = $action->approve($id, $notes);

            $message = $alreadyRefunded
                ? 'Refund sudah pernah diproses. Saldo tidak dikreditkan ulang.'
                : 'Pengajuan refund berhasil disetujui dan saldo telah dikembalikan.';

            return $this->successResponse($message, $transaction);
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

    /**
     * Manual wallet adjustment (credit/debit) for Finance/Owner.
     * POST /api/v1/admin/finance/wallet/adjust
     */
    public function adjustWallet(Request $request, AdjustWalletAction $action): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'required_without:email|integer|exists:users,id',
            'email' => 'required_without:user_id|email|exists:users,email',
            'amount' => 'required|numeric|min:1',
            'direction' => 'required|in:credit,debit',
            'reason' => 'required|string|max:255',
        ]);

        try {
            $target = !empty($data['user_id'])
                ? User::findOrFail($data['user_id'])
                : User::where('email', $data['email'])->firstOrFail();

            $transaction = $action->execute(
                $target,
                (float) $data['amount'],
                $data['direction'],
                $data['reason'],
                $request->user()
            );

            return $this->successResponse('Penyesuaian saldo berhasil diproses.', $transaction);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            return $this->errorResponse($e->getMessage(), $code);
        }
    }
}
