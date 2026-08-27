<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Concerns\HandlesIdempotentRequests;
use App\Http\Controllers\Controller;
use App\Services\Loyalty\LoyaltyPointService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * FR-DIFF-01 / FR-DIFF-08 — user/agent own loyalty surface (SRS 13.7).
 */
class LoyaltyController extends Controller
{
    use ApiResponseTrait;
    use HandlesIdempotentRequests;

    public function __construct(
        protected LoyaltyPointService $loyalty
    ) {}

    public function summary(Request $request): JsonResponse
    {
        $data = $this->loyalty->getBalance($request->user());

        return $this->successResponse('Loyalty summary', $data);
    }

    public function history(Request $request): JsonResponse
    {
        $perPage = min(50, max(1, (int) $request->input('per_page', 20)));
        $history = $this->loyalty->getHistory($request->user(), $perPage);

        return $this->successResponse('Loyalty history', $history);
    }

    public function redeem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'points' => 'required|integer|min:100',
            'idempotency_key' => 'required|string|max:80',
        ]);

        try {
            return $this->withIdempotency(
                $request,
                'POST /api/v1/loyalty/redeem',
                ['points' => (int) $validated['points']],
                function () use ($request, $validated) {
                    $result = $this->loyalty->redeemPoints(
                        $request->user(),
                        (int) $validated['points'],
                        (string) $validated['idempotency_key']
                    );

                    return $this->idempotentJson(
                        $result['already_processed']
                            ? 'Redeem sudah diproses sebelumnya.'
                            : 'Poin berhasil ditukar ke saldo wallet.',
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
