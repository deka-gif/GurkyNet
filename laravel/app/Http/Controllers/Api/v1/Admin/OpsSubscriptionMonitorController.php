<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\UserSubscription;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** FR-DIFF-02 — Ops monitoring of auto-reorder (read-only). */
class OpsSubscriptionMonitorController extends Controller
{
    use ApiResponseTrait;

    public function __invoke(Request $request): JsonResponse
    {
        $query = UserSubscription::query()
            ->with(['user:id,name,email', 'product:id,name,sku_code'])
            ->orderByDesc('id');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        return $this->successResponse(
            'Auto-reorder monitoring',
            $query->paginate(min(50, max(1, (int) $request->input('per_page', 20))))
        );
    }
}
