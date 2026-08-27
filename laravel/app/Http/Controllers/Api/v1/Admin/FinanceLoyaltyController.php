<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Concerns\HandlesIdempotentRequests;
use App\Http\Controllers\Controller;
use App\Models\LoyaltyPoint;
use App\Models\LoyaltyPointLedger;
use App\Models\User;
use App\Services\Loyalty\LoyaltyPointService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * FR-DIFF-01 — Finance Program Poin (SRS 13.4). CS read-only via same GETs under CS prefix.
 */
class FinanceLoyaltyController extends Controller
{
    use ApiResponseTrait;
    use HandlesIdempotentRequests;

    public function __construct(
        protected LoyaltyPointService $loyalty
    ) {}

    public function overview(Request $request): JsonResponse
    {
        if (! $this->loyalty->actorMayViewFinance($request->user())) {
            return $this->errorResponse('Forbidden', 403);
        }

        $circulating = (int) LoyaltyPoint::query()->sum('points_balance');
        $held = (int) LoyaltyPoint::query()->sum('points_held_clawback');
        $usersWithPoints = (int) LoyaltyPoint::query()->where('points_balance', '>', 0)->count();

        return $this->successResponse('Loyalty finance overview', [
            'points_in_circulation' => $circulating,
            'points_held_clawback' => $held,
            'users_with_points' => $usersWithPoints,
        ]);
    }

    public function userBalance(Request $request, int $userId): JsonResponse
    {
        if (! $this->loyalty->actorMayViewFinance($request->user())) {
            return $this->errorResponse('Forbidden', 403);
        }

        $user = User::query()->findOrFail($userId);

        return $this->successResponse('User loyalty balance', $this->loyalty->getBalance($user));
    }

    public function userHistory(Request $request, int $userId): JsonResponse
    {
        if (! $this->loyalty->actorMayViewFinance($request->user())) {
            return $this->errorResponse('Forbidden', 403);
        }

        $user = User::query()->findOrFail($userId);
        $perPage = min(50, max(1, (int) $request->input('per_page', 20)));

        return $this->successResponse('User loyalty history', $this->loyalty->getHistory($user, $perPage));
    }

    public function ledger(Request $request): JsonResponse
    {
        if (! $this->loyalty->actorMayViewFinance($request->user())) {
            return $this->errorResponse('Forbidden', 403);
        }

        $query = LoyaltyPointLedger::query()->with('user:id,name,email')->orderByDesc('id');
        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }
        if ($uid = $request->input('user_id')) {
            $query->where('user_id', (int) $uid);
        }

        return $this->successResponse('Loyalty ledger', $query->paginate(min(50, max(1, (int) $request->input('per_page', 20)))));
    }

    public function adjust(Request $request): JsonResponse
    {
        if (! $this->loyalty->actorMayAdjust($request->user())) {
            return $this->errorResponse('Hanya Finance/Owner yang boleh menyesuaikan poin.', 403);
        }

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'points' => 'required|integer|min:1',
            'direction' => 'required|in:credit,debit',
            'reason' => 'required|string|min:3|max:500',
            'idempotency_key' => 'required|string|max:80',
        ]);

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/admin/finance/loyalty/adjust',
                [
                    'user_id' => (int) $validated['user_id'],
                    'points' => (int) $validated['points'],
                    'direction' => $validated['direction'],
                    'reason' => $validated['reason'],
                ],
                function () use ($request, $validated) {
                    $target = User::query()->findOrFail((int) $validated['user_id']);
                    $result = $this->loyalty->adjustPoints(
                        $target,
                        (int) $validated['points'],
                        (string) $validated['direction'],
                        (string) $validated['reason'],
                        $request->user(),
                        (string) $validated['idempotency_key']
                    );

                    return $this->idempotentJson(
                        $result['already_processed']
                            ? 'Penyesuaian poin sudah diproses sebelumnya.'
                            : 'Penyesuaian poin berhasil.',
                        $result
                    );
                },
                (string) $validated['idempotency_key']
            );
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }
    }
}
