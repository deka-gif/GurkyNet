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
            return $this->successResponse(
                'Data produk berhasil diperbarui.',
                new \App\Http\Resources\ProductResource($product)
            );
        } catch (\Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            return $this->errorResponse($e->getMessage(), $code);
        }
    }

    /**
     * Provider Management Control Center (Digiflazz / VIP / Midtrans).
     * GET /api/v1/admin/operations/providers
     * Params: status, supported_service, search, page, per_page, sort, refresh
     */
    public function providers(ProviderFilterRequest $request, OperationsProvidersAction $action): JsonResponse
    {
        $filters = $request->validated();
        $paginator = $action->list($filters);

        return $this->paginatedResponse(
            'Daftar partner provider berhasil dimuat.',
            $paginator->items(),
            $paginator
        );
    }

    /**
     * Probe live health for all partners (Refresh Status).
     * POST /api/v1/admin/operations/providers/refresh-status
     */
    public function refreshProviderStatuses(OperationsProvidersAction $action): JsonResponse
    {
        $updated = $action->refreshStatuses();

        return $this->successResponse(
            'Status partner provider berhasil di-refresh dari backend.',
            [
                'updated_count' => count($updated),
                'partners' => $updated,
            ]
        );
    }

    /**
     * Update partner status (Online / Maintenance / Offline) / notes.
     * PUT /api/v1/admin/operations/providers/{id}
     */
    public function updateProvider(string|int $id, UpdateProviderRequest $request, OperationsProvidersAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            if (!empty($data['maintenance_flag']) && !isset($data['status']) && !isset($data['partner_status'])) {
                $data['status'] = 'maintenance';
            }
            $provider = $action->update($id, $data);
            return $this->successResponse('Status provider berhasil diperbarui.', $provider);
        } catch (\Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 400;
            return $this->errorResponse($e->getMessage(), $code);
        }
    }

    /**
     * Network Operations Center — service cards (not SKU dumps).
     * GET /api/v1/admin/operations/monitoring?status=&search=&refresh=
     */
    public function monitoring(Request $request, OperationsMonitoringAction $action): JsonResponse
    {
        $filters = $request->only(['status', 'search', 'refresh']);
        $data = $action->execute($filters);

        return $this->successResponse('NOC Service Monitoring berhasil dimuat.', $data);
    }

    /**
     * Probe provider health then return fresh NOC overview.
     * POST /api/v1/admin/operations/monitoring/refresh
     */
    public function refreshMonitoring(Request $request, OperationsMonitoringAction $action): JsonResponse
    {
        $filters = $request->only(['status', 'search']);
        $data = $action->refresh($filters);

        return $this->successResponse('Status layanan berhasil di-refresh dari provider.', $data);
    }

    /**
     * Level 1–2 service detail with provider summaries.
     * GET /api/v1/admin/operations/monitoring/services/{serviceKey}
     */
    public function monitoringServiceDetail(string $serviceKey, OperationsMonitoringAction $action): JsonResponse
    {
        return $this->successResponse(
            'Detail service monitoring berhasil dimuat.',
            $action->serviceDetail($serviceKey)
        );
    }

    /**
     * Level 3 — problematic SKUs only (maintenance + offline).
     * GET /api/v1/admin/operations/monitoring/services/{serviceKey}/issues
     */
    public function monitoringServiceIssues(string $serviceKey, Request $request, OperationsMonitoringAction $action): JsonResponse
    {
        $providerId = $request->filled('product_provider_id')
            ? (int) $request->input('product_provider_id')
            : null;

        return $this->successResponse(
            'Daftar SKU bermasalah berhasil dimuat.',
            $action->problematicSkus(
                $serviceKey,
                $providerId,
                max(1, (int) $request->input('page', 1)),
                max(1, min(100, (int) $request->input('per_page', 50)))
            )
        );
    }

    /**
     * Pricing & Margin Engine — paginated Product Mapping Layer catalog.
     * GET /api/v1/admin/operations/pricing
     * Same filters as Product Management: category, product_provider_id, status, search, page, per_page
     */
    public function pricing(ProductFilterRequest $request, OperationsPricingAction $action): JsonResponse
    {
        $data = $action->get($request->validated());

        return $this->successResponse(
            'Data Pricing & Margin berhasil dimuat.',
            $data,
            200,
            [
                'pagination' => $data['pagination'] ?? null,
                'summary' => $data['summary'] ?? null,
                'level' => $data['level'] ?? null,
            ]
        );
    }

    /**
     * Update SKU sell price / margin / status, or global default margin rules.
     * PUT /api/v1/admin/operations/pricing
     * PUT /api/v1/admin/operations/pricing/{id}
     */
    public function updatePricing(UpdatePricingRequest $request, OperationsPricingAction $action): JsonResponse
    {
        try {
            $data = $request->validated();
            $updated = $action->update($data);

            return $this->successResponse('Skema harga berhasil diperbarui.', $updated);
        } catch (\InvalidArgumentException $e) {
            return $this->errorResponse($e->getMessage(), 422);
        } catch (\Exception $e) {
            $code = $e->getCode() >= 400 && $e->getCode() < 600 ? (int) $e->getCode() : 400;

            return $this->errorResponse($e->getMessage(), $code);
        }
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
