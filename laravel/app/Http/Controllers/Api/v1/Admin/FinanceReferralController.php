<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\CommissionLedger;
use App\Models\CommissionRule;
use App\Models\ReferralFraudFlag;
use App\Models\User;
use App\Services\Referral\ReferralCommissionService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** SRS 31.6 / 13.4 — Finance referral program monitoring + rules. */
class FinanceReferralController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected ReferralCommissionService $commissions
    ) {}

    public function overview(Request $request): JsonResponse
    {
        $this->assertView($request);

        $byStatus = CommissionLedger::query()
            ->selectRaw('status, COUNT(*) as cnt, SUM(amount) as total')
            ->groupBy('status')
            ->get();

        return $this->successResponse('Referral finance overview', [
            'by_status' => $byStatus,
            'rules' => CommissionRule::query()->where('is_current', true)->orderBy('level')->get(),
            'fraud_open' => ReferralFraudFlag::query()->where('status', ReferralFraudFlag::STATUS_FLAGGED)->count(),
            'finance_review_open' => CommissionLedger::query()->where('status', CommissionLedger::STATUS_FINANCE_REVIEW)->count(),
            'caps' => [
                'daily_cap' => (float) config('referral.daily_cap'),
                'monthly_cap' => (float) config('referral.monthly_cap'),
            ],
            'fraud_thresholds_configured' => false,
            'fraud_note' => 'Numeric fraud thresholds are NULL/unconfigured — flag-only, no auto-block.',
        ]);
    }

    public function rules(Request $request): JsonResponse
    {
        $this->assertView($request);

        return $this->successResponse('Commission rules', [
            'current' => CommissionRule::query()->where('is_current', true)->orderBy('level')->get(),
            'history' => CommissionRule::query()->orderByDesc('id')->limit(50)->get(),
        ]);
    }

    public function updateRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'level' => 'required|integer|in:1,2',
            'percentage' => 'required|numeric|min:0|max:100',
            'reason' => 'required|string|max:255',
        ]);

        try {
            $rule = $this->commissions->upsertRule(
                $request->user(),
                (int) $validated['level'],
                (float) $validated['percentage'],
                (string) $validated['reason']
            );
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }

        return $this->successResponse('Commission rule updated', $rule);
    }

    public function ledger(Request $request): JsonResponse
    {
        $this->assertView($request);
        $q = CommissionLedger::query()->orderByDesc('id');
        if ($status = $request->input('status')) {
            $q->where('status', $status);
        }

        return $this->successResponse('Commission ledger', $q->paginate(min(100, max(1, (int) $request->input('per_page', 20)))));
    }

    public function fraudFlags(Request $request): JsonResponse
    {
        $this->assertView($request);
        $q = ReferralFraudFlag::query()->orderByDesc('id');
        if ($status = $request->input('status')) {
            $q->where('status', $status);
        }

        return $this->successResponse('Referral fraud flags', $q->paginate(min(100, max(1, (int) $request->input('per_page', 20)))));
    }

    public function reviewFraud(Request $request, int $id): JsonResponse
    {
        if (! $this->commissions->actorMayManageRules($request->user()) && ! $this->isOwner($request->user())) {
            // Finance manages; Owner read-only unless super — review allowed for Finance
            if (! $this->commissions->actorMayManageRules($request->user())) {
                return $this->errorResponse('Forbidden', 403);
            }
        }

        if (! $this->commissions->actorMayManageRules($request->user())) {
            return $this->errorResponse('Hanya Finance yang dapat review fraud flag.', 403);
        }

        $validated = $request->validate([
            'status' => 'required|string|in:reviewed,dismissed',
            'note' => 'nullable|string|max:1000',
        ]);

        $flag = ReferralFraudFlag::query()->findOrFail($id);
        $flag->status = $validated['status'];
        $flag->reviewed_by = $request->user()->id;
        $flag->reviewed_at = now();
        $flag->review_note = $validated['note'] ?? null;
        $flag->save();

        return $this->successResponse('Fraud flag updated', $flag);
    }

    public function reviewFinanceCase(Request $request, int $id): JsonResponse
    {
        if (! $this->commissions->actorMayManageRules($request->user())) {
            return $this->errorResponse('Hanya Finance yang dapat resolve finance_review commission.', 403);
        }

        $validated = $request->validate([
            'note' => 'required|string|max:1000',
        ]);

        $row = CommissionLedger::query()->findOrFail($id);
        if ($row->status !== CommissionLedger::STATUS_FINANCE_REVIEW) {
            return $this->errorResponse('Hanya status finance_review yang dapat di-review.', 422);
        }

        // Manual review acknowledgment — no automatic clawback (locked decision #9).
        $row->finance_review_reason = trim(($row->finance_review_reason ? $row->finance_review_reason.' | ' : '').'Reviewed: '.$validated['note']);
        $row->save();

        return $this->successResponse('Finance review noted (no automatic clawback)', $row);
    }

    public function capUsage(Request $request, int $userId): JsonResponse
    {
        $this->assertView($request);
        $user = User::query()->findOrFail($userId);

        return $this->successResponse('Cap usage', $this->commissions->capUsage($user));
    }

    protected function assertView(Request $request): void
    {
        if (! $this->commissions->actorMayViewFinance($request->user())) {
            abort(403, 'Forbidden');
        }
    }

    protected function isOwner(User $user): bool
    {
        $role = $user->role instanceof \App\Enums\UserRole ? $user->role->value : (string) $user->role;

        return $role === 'owner' || $role === 'super_admin';
    }
}
