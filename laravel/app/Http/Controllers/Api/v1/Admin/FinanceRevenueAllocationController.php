<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Finance\RevenueAllocationService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * FR-FIN-10 — Finance revenue allocation (admin_fee + margin → kategori %).
 * Writes: Finance / Super Admin only (EnsureOwnerReadOnly + service gate).
 * Reads: Finance, Owner, Super Admin.
 */
class FinanceRevenueAllocationController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected RevenueAllocationService $allocations
    ) {}

    public function overview(Request $request): JsonResponse
    {
        if (! $this->allocations->actorMayView($request->user())) {
            return $this->errorResponse('Forbidden', 403);
        }

        return $this->successResponse('Revenue allocation overview', $this->allocations->currentRuleSetPayload());
    }

    public function accumulation(Request $request): JsonResponse
    {
        if (! $this->allocations->actorMayView($request->user())) {
            return $this->errorResponse('Forbidden', 403);
        }

        $data = $this->allocations->accumulation(
            $request->input('from'),
            $request->input('to')
        );

        return $this->successResponse('Revenue allocation accumulation', $data);
    }

    public function history(Request $request): JsonResponse
    {
        if (! $this->allocations->actorMayView($request->user())) {
            return $this->errorResponse('Forbidden', 403);
        }

        return $this->successResponse(
            'Revenue allocation rule history',
            $this->allocations->historyPayload((int) $request->input('limit', 30))
        );
    }

    public function saveRules(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:255',
            'lines' => 'required|array|min:1',
            'lines.*.category_id' => 'required|integer',
            'lines.*.percentage' => 'required|numeric',
        ]);

        try {
            $set = $this->allocations->saveRuleSet(
                $request->user(),
                $validated['lines'],
                (string) $validated['reason']
            );
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage() ?: 'Validasi gagal', 422, $e->errors());
        }

        return $this->successResponse(
            'Rule set alokasi pendapatan disimpan',
            $this->allocations->currentRuleSetPayload()['current']
                ?? ['id' => $set->id]
        );
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'code' => 'nullable|string|max:64',
        ]);

        try {
            $cat = $this->allocations->createCategory($request->user(), $validated);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage() ?: 'Validasi gagal', 422, $e->errors());
        }

        return $this->successResponse('Kategori ditambahkan', [
            'id' => $cat->id,
            'code' => $cat->code,
            'name' => $cat->name,
            'sortOrder' => $cat->sort_order,
            'isActive' => $cat->is_active,
        ], 201);
    }

    public function renameCategory(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
        ]);

        try {
            $cat = $this->allocations->renameCategory($request->user(), $id, (string) $validated['name']);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage() ?: 'Validasi gagal', 422, $e->errors());
        }

        return $this->successResponse('Kategori diperbarui', [
            'id' => $cat->id,
            'code' => $cat->code,
            'name' => $cat->name,
            'sortOrder' => $cat->sort_order,
            'isActive' => $cat->is_active,
        ]);
    }

    public function deactivateCategory(Request $request, int $id): JsonResponse
    {
        try {
            $cat = $this->allocations->deactivateCategory($request->user(), $id);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage() ?: 'Validasi gagal', 422, $e->errors());
        }

        return $this->successResponse('Kategori dinonaktifkan', [
            'id' => $cat->id,
            'code' => $cat->code,
            'name' => $cat->name,
            'isActive' => $cat->is_active,
        ]);
    }
}
