<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Finance\CashFlowProjectionService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** FR-DIFF-10 — Owner cash-flow projection (read-only). */
class OwnerCashFlowController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected CashFlowProjectionService $projection
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        return $this->successResponse(
            'Owner 30-day cash-flow projection',
            $this->projection->project()
        );
    }
}
