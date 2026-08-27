<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\CommissionLedger;
use App\Services\Referral\ReferralCodeService;
use App\Services\Referral\ReferralCommissionService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** SRS 13.7 / FR-REF-07 — user own referral dashboard. */
class ReferralController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected ReferralCommissionService $commissions,
        protected ReferralCodeService $codes
    ) {}

    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        return $this->successResponse('Referral summary', $this->commissions->userSummary($user));
    }

    public function history(Request $request): JsonResponse
    {
        $user = $request->user();
        $rows = CommissionLedger::query()
            ->where('upline_user_id', $user->id)
            ->orderByDesc('id')
            ->paginate(min(50, max(1, (int) $request->input('per_page', 20))));

        return $this->successResponse('Referral commission history', $rows);
    }

    public function setCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|min:6|max:20',
        ]);

        try {
            $row = $this->codes->setCustomCode($request->user(), (string) $validated['code']);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }

        return $this->successResponse('Kode referral diperbarui', [
            'code' => $row->code,
            'is_custom' => $row->is_custom,
        ]);
    }
}
