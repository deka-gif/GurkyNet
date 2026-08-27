<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\Pricing\AgentMarginCalculatorService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** FR-DIFF-03 — Ops agent margin calculator (display-only). */
class AgentMarginController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected AgentMarginCalculatorService $calculator
    ) {}

    public function show(int $productId): JsonResponse
    {
        $product = Product::query()->with(['productProvider', 'provider'])->findOrFail($productId);

        return $this->successResponse(
            'Agent margin calculator (display-only)',
            $this->calculator->calculateForProduct($product)
        );
    }

    public function upsertPrice(Request $request, int $productId): JsonResponse
    {
        $validated = $request->validate([
            'agent_level' => 'required|string|in:reguler,gold,platinum,end_user',
            'sell_price' => 'required|numeric|min:0',
        ]);

        $product = Product::query()->findOrFail($productId);

        try {
            $row = $this->calculator->upsertLevelPrice(
                $product,
                (string) $validated['agent_level'],
                (float) $validated['sell_price']
            );
        } catch (ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        }

        return $this->successResponse('product_prices updated (display source)', [
            'id' => $row->id,
            'product_id' => $row->product_id,
            'agent_level' => $row->agent_level,
            'sell_price' => (float) $row->sell_price,
            'calculator' => $this->calculator->calculateForProduct($product->fresh(['productProvider', 'provider'])),
        ]);
    }
}
