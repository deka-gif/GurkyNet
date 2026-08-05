<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use App\Actions\Admin\Operations\OperationsDashboardAction;
use App\Actions\Admin\Operations\OperationsProductsAction;
use App\Actions\Admin\Operations\OperationsProvidersAction;
use App\Actions\Admin\Operations\OperationsPricingAction;
use App\Actions\Admin\Operations\OperationsMonitoringAction;
use App\Actions\Admin\Operations\SyncDigiflazzCatalogAction;
use App\Jobs\SyncDigiflazzCatalogJob;
use App\Http\Requests\Admin\Operations\ProductFilterRequest;
use App\Http\Requests\Admin\Operations\UpdateProductRequest;
use App\Http\Requests\Admin\Operations\ProviderFilterRequest;
use App\Http\Requests\Admin\Operations\UpdateProviderRequest;
use App\Http\Requests\Admin\Operations\UpdatePricingRequest;
use App\Http\Resources\ProductResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Repositories\Contracts\OperationsRepositoryInterface;

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
    ProductResource::collection($paginator),
    $paginator
);

    }

    /**
     * Product Providers for Product Management filters (Digiflazz, VIP brand, …).
     * Payment gateways are intentionally excluded.
     * GET /api/v1/admin/operations/product-providers
     */
    public function productProviders(OperationsRepositoryInterface $repository): JsonResponse
    {
        // Strict Product Management contract: id, name, code from product_providers only.
        $items = $repository->getProductProviders()
            ->map(fn ($p) => [
                'id' => (int) $p->id,
                'name' => (string) $p->name,
                'code' => (string) $p->code,
            ])
            ->values()
            ->all();

        return $this->successResponse(
            'Daftar product provider berhasil dimuat.',
            $items
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
     * Get Service Monitoring Data.
     * GET /api/v1/admin/operations/monitoring
     */
    public function monitoring(Request $request, OperationsMonitoringAction $action): JsonResponse
    {
        $filters = $request->only(['status', 'search']);
        $data = $action->execute($filters);

        return $this->successResponse('Data monitoring layanan operasional berhasil dimuat.', $data);
    }

    /**
     * Get Pricing Margin Rules.
     * GET /api/v1/admin/operations/pricing
     */
    public function pricing(Request $request, OperationsPricingAction $action): JsonResponse
    {
        $filters = $request->only([
            'product_provider_id',
            'product_provider_code',
            'provider',
            'search',
            'status',
        ]);
        $data = $action->get($filters);
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

    /**
     * Synchronize Digiflazz product catalog into master products.
     * POST /api/v1/admin/operations/sync
     */
    public function syncCatalog(Request $request, SyncDigiflazzCatalogAction $action): JsonResponse
    {
        $queue = filter_var($request->input('queue', false), FILTER_VALIDATE_BOOLEAN);
        $cmds = $request->input('cmd', ['prepaid', 'pasca']);
        if (!is_array($cmds)) {
            $cmds = [$cmds];
        }

        try {
            if ($queue) {
                SyncDigiflazzCatalogJob::dispatch(['cmd' => $cmds]);
                return $this->successResponse('Sinkronisasi Digiflazz dijadwalkan di antrean.', [
                    'queued' => true,
                    'cmd' => $cmds,
                ]);
            }

            $result = $action->execute(['cmd' => $cmds]);
            return $this->successResponse($result['message'] ?? 'Sinkronisasi Digiflazz berhasil.', $result);
        } catch (\Throwable $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }
    }

    /**
     * Get Digiflazz sync status metadata.
     * GET /api/v1/admin/operations/sync-status
     */
    public function syncStatus(\App\Repositories\Contracts\OperationsRepositoryInterface $repository): JsonResponse
    {
        return $this->successResponse(
            'Status sinkronisasi Digiflazz berhasil dimuat.',
            $repository->getDigiflazzSyncStatus()
        );
    }
}
