<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Operations\OperationsDashboardAction;
use App\Actions\Admin\Operations\OperationsProductsAction;
use App\Actions\Admin\Operations\OperationsProvidersAction;
use App\Actions\Admin\Operations\OperationsPricingAction;
use App\Http\Requests\Admin\Operations\ProductFilterRequest;
use App\Http\Requests\Admin\Operations\UpdateProductRequest;
use App\Http\Requests\Admin\Operations\ProviderFilterRequest;
use App\Http\Requests\Admin\Operations\UpdateProviderRequest;
use App\Http\Requests\Admin\Operations\UpdatePricingRequest;
use Illuminate\Http\JsonResponse;

class OperationsController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get Operations Dashboard.
     * GET /api/v1/admin/operations/dashboard
     */
    public function dashboard(OperationsDashboardAction $action): JsonResponse
    {
        $data = $action->execute();
        return $this->successResponse('Data dashboard operasional berhasil dimuat.', $data);
    }

    /**
     * Get Paginated Product List with Filters.
     * GET /api/v1/admin/operations/products
     */
    public function products(ProductFilterRequest $request, OperationsProductsAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar produk operasional berhasil dimuat.',
            $paginator->items(),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Update Product Pricing / Margin / Status / Admin Notes.
     * PUT /api/v1/admin/operations/products/{id}
     */
    public function updateProduct(string|int $id, UpdateProductRequest $request, OperationsProductsAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $product = $action->update($id, $data);
            return $this->successResponse('Data produk berhasil diperbarui.', $product);
        } catch (\Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            return $this->errorResponse($e->getMessage(), $code);
        }
    }

    /**
     * Get Paginated Provider List with Filters.
     * GET /api/v1/admin/operations/providers
     */
    public function providers(ProviderFilterRequest $request, OperationsProvidersAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar penyedia (provider) berhasil dimuat.',
            $paginator->items(),
            [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        );
    }

    /**
     * Update Provider Status / Maintenance Flag / Notes.
     * PUT /api/v1/admin/operations/providers/{id}
     */
    public function updateProvider(string|int $id, UpdateProviderRequest $request, OperationsProvidersAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $provider = $action->update($id, $data);
            return $this->successResponse('Status provider berhasil diperbarui.', $provider);
        } catch (\Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            return $this->errorResponse($e->getMessage(), $code);
        }
    }

    /**
     * Get Pricing Margin Rules.
     * GET /api/v1/admin/operations/pricing
     */
    public function pricing(OperationsPricingAction $action): JsonResponse
    {
        $data = $action->get();
        return $this->successResponse('Aturan harga dan margin berhasil dimuat.', $data);
    }

    /**
     * Update Pricing Margin Rules.
     * PUT /api/v1/admin/operations/pricing
     */
    public function updatePricing(UpdatePricingRequest $request, OperationsPricingAction $action): JsonResponse
    {
        $data = $request->validated();
        $updated = $action->update($data);
        return $this->successResponse('Aturan harga dan margin berhasil diperbarui.', $updated);
    }
}
