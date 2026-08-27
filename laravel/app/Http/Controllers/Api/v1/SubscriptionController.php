<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\UserSubscription;
use App\Services\Subscriptions\AutoReorderService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** FR-DIFF-02 — user auto-reorder subscriptions (own data only). */
class SubscriptionController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected AutoReorderService $subscriptions
    ) {}

    public function index(Request $request): JsonResponse
    {
        $rows = UserSubscription::query()
            ->with('product:id,name,sku_code,sell_price,base_price')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate(min(50, max(1, (int) $request->input('per_page', 20))));

        return $this->successResponse('Subscriptions', $rows);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => 'required|integer|exists:products,id',
            'target_number' => 'required|string|max:64',
            'schedule_day' => 'required|integer|min:1|max:28',
            'pin' => 'required|string',
        ]);

        try {
            $sub = $this->subscriptions->create(
                $request->user(),
                (int) $validated['product_id'],
                (string) $validated['target_number'],
                (int) $validated['schedule_day'],
                (string) $validated['pin']
            );
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }

        return $this->successResponse('Subscription dibuat', $sub, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $sub = UserSubscription::query()->findOrFail($id);
        $validated = $request->validate([
            'product_id' => 'sometimes|integer|exists:products,id',
            'target_number' => 'sometimes|string|max:64',
            'schedule_day' => 'sometimes|integer|min:1|max:28',
        ]);

        try {
            $sub = $this->subscriptions->update($request->user(), $sub, $validated);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }

        return $this->successResponse('Subscription diperbarui', $sub);
    }

    public function pause(Request $request, int $id): JsonResponse
    {
        $sub = UserSubscription::query()->findOrFail($id);
        try {
            $sub = $this->subscriptions->pause($request->user(), $sub, $request->input('reason'));
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }

        return $this->successResponse('Subscription dijeda', $sub);
    }

    public function resume(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(['pin' => 'required|string']);
        $sub = UserSubscription::query()->findOrFail($id);
        try {
            $sub = $this->subscriptions->resume($request->user(), $sub, (string) $validated['pin']);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }

        return $this->successResponse('Subscription dilanjutkan', $sub);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $sub = UserSubscription::query()->findOrFail($id);
        try {
            $sub = $this->subscriptions->cancel($request->user(), $sub);
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }

        return $this->successResponse('Subscription dibatalkan', $sub);
    }
}
