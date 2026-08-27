<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Support\Features\TransactionFeatureGate;
use Illuminate\Http\JsonResponse;

/**
 * Sprint 8 — expose public transaction feature gates to FE (FR-USR02/03/07 safety).
 */
class FeatureFlagController extends Controller
{
    public function __invoke(TransactionFeatureGate $gate): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Feature flags.',
            'data' => $gate->snapshot(),
        ]);
    }
}
