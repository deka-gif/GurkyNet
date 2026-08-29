<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductProvider;
use App\Services\ProductProviders\ProductProviderControlService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Product Provider Control Center — Operations only.
 * Payment gateways must never appear here.
 */
class ProductProviderControlController extends Controller
{
    use ApiResponseTrait;

    public function index(ProductProviderControlService $service): JsonResponse
    {
        return $this->successResponse(
            'Product Provider Control Center berhasil dimuat.',
            $service->listControlCenter()
        );
    }

    public function show(int $id, ProductProviderControlService $service): JsonResponse
    {
        $provider = ProductProvider::findOrFail($id);

        return $this->successResponse(
            'Detail product provider berhasil dimuat.',
            $service->toCard($provider)
        );
    }

    public function enable(int $id, ProductProviderControlService $service): JsonResponse
    {
        $dbBefore = DB::table('product_providers')->where('id', $id)->first(['id', 'is_active', 'api_status', 'code']);

        Log::info('EXEC TRACE — ENTER Controller Enable', [
            'Provider ID' => $id,
            'Current DB is_active' => $dbBefore->is_active ?? null,
            'Current DB api_status' => $dbBefore->api_status ?? null,
            'code' => $dbBefore->code ?? null,
            'path' => request()->path(),
        ]);

        $provider = ProductProvider::findOrFail($id);
        $fresh = $service->enable($provider);
        $card = $service->toCard($fresh);

        $response = $this->successResponse('Product provider diaktifkan. Siap menerima routing transaksi sesuai prioritas.', $card);

        Log::info('EXEC TRACE — RETURN JSON Enable', [
            'Provider ID' => $fresh->id,
            'JSON enabled' => $card['enabled'] ?? null,
            'JSON status' => $card['status'] ?? null,
            'JSON apiStatus' => $card['apiStatus'] ?? null,
            'Fresh DB is_active' => $fresh->is_active,
            'Fresh DB api_status' => $fresh->api_status,
            'response_status' => $response->getStatusCode(),
        ]);

        return $response;
    }

    public function disable(int $id, ProductProviderControlService $service): JsonResponse
    {
        $dbBefore = DB::table('product_providers')->where('id', $id)->first(['id', 'is_active', 'api_status', 'code']);

        Log::info('EXEC TRACE — ENTER Controller Disable', [
            'Provider ID' => $id,
            'Current DB is_active' => $dbBefore->is_active ?? null,
            'Current DB api_status' => $dbBefore->api_status ?? null,
            'code' => $dbBefore->code ?? null,
            'path' => request()->path(),
            'request_payload' => request()->all(),
        ]);

        $provider = ProductProvider::findOrFail($id);
        $fresh = $service->disable($provider);
        $card = $service->toCard($fresh);

        $response = $this->successResponse(
            'Product provider dimatikan. Transaksi baru tidak dikirim ke provider ini; produk tetap di database dan dialihkan ke provider cadangan bila tersedia.',
            $card
        );

        Log::info('EXEC TRACE — RETURN JSON Disable', [
            'Provider ID' => $fresh->id,
            'JSON enabled' => $card['enabled'] ?? null,
            'JSON status' => $card['status'] ?? null,
            'JSON apiStatus' => $card['apiStatus'] ?? null,
            'Fresh DB is_active' => $fresh->is_active,
            'Fresh DB api_status' => $fresh->api_status,
            'db_is_active_raw' => DB::table('product_providers')->where('id', $fresh->id)->value('is_active'),
            'response_status' => $response->getStatusCode(),
        ]);

        return $response;
    }

    public function maintenance(int $id, ProductProviderControlService $service): JsonResponse
    {
        $provider = ProductProvider::findOrFail($id);
        $fresh = $service->setMaintenance($provider);

        return $this->successResponse(
            'Product provider masuk mode maintenance. Transaksi akan dialihkan ke provider cadangan jika tersedia.',
            $service->toCard($fresh)
        );
    }

    public function setPrimary(int $id, ProductProviderControlService $service): JsonResponse
    {
        $provider = ProductProvider::findOrFail($id);
        $fresh = $service->setPrimary($provider);

        return $this->successResponse('Product provider dijadikan primary.', $service->toCard($fresh));
    }

    public function setLogo(int $id, Request $request, ProductProviderControlService $service): JsonResponse
    {
        $data = $request->validate([
            'logo' => 'required|string|max:500',
        ]);

        $provider = ProductProvider::findOrFail($id);
        $fresh = $service->setLogo($provider, (string) $data['logo']);

        return $this->successResponse('Logo product provider diperbarui.', $service->toCard($fresh));
    }

    public function setPriority(int $id, Request $request, ProductProviderControlService $service): JsonResponse
    {
        $data = $request->validate([
            'priority' => 'required|integer|min:1|max:999',
        ]);

        $provider = ProductProvider::findOrFail($id);
        $fresh = $service->setPriority($provider, (int) $data['priority']);

        return $this->successResponse('Priority product provider diperbarui.', $service->toCard($fresh));
    }

    public function healthCheck(int $id, ProductProviderControlService $service): JsonResponse
    {
        Log::info('EXEC TRACE — ENTER health controller', [
            'provider_id' => $id,
        ]);

        $provider = ProductProvider::findOrFail($id);
        $card = $service->healthCheck($provider);

        return $this->successResponse('Health check selesai.', $card);
    }

    /**
     * Global Operations Refresh — health + balances + SKU counts for all product providers.
     * Never reloads the browser; AJAX only.
     */
    public function refreshAll(ProductProviderControlService $service): JsonResponse
    {
        $started = microtime(true);
        $result = $service->refreshAll();

        return $this->successResponse('Product Provider Control Center diperbarui.', array_merge($result, [
            'duration_ms' => (int) round((microtime(true) - $started) * 1000),
            'refreshed_at' => now()->toIso8601String(),
        ]));
    }

    /**
     * Automatic Synchronization panel status (Sprint 6.3).
     */
    public function autoSyncStatus(ProductProviderControlService $service): JsonResponse
    {
        return $this->successResponse(
            'Automatic Synchronization status berhasil dimuat.',
            $service->autoSyncStatus()
        );
    }

    public function sync(int $id, Request $request, ProductProviderControlService $service): JsonResponse
    {
        $provider = ProductProvider::findOrFail($id);
        $cmds = $request->input('cmd', ['prepaid']);
        if (!is_array($cmds)) {
            $cmds = [$cmds];
        }

        try {
            $result = $service->syncNow($provider, ['cmd' => $cmds]);

            return $this->successResponse($result['message'] ?? 'Sync berhasil.', $result);
        } catch (\App\Exceptions\ProviderCatalogException $e) {
            // Provider RC (e.g. Digiflazz RC83) — NOT Laravel validation 422.
            return response()->json(array_merge($e->toArray(), [
                'meta' => null,
                'errors' => null,
            ]), 200);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Keep true validation (priority etc.) as 422 — not provider RC.
            throw $e;
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'provider' => $provider->name,
                'provider_code' => null,
                'message' => $e->getMessage(),
                'retryable' => true,
                'data' => null,
                'meta' => null,
                'errors' => null,
            ], 200);
        }
    }

    public function logs(int $id, Request $request, ProductProviderControlService $service): JsonResponse
    {
        $provider = ProductProvider::findOrFail($id);
        $limit = min(200, max(1, (int) $request->input('limit', 50)));

        return $this->successResponse(
            'Log product provider berhasil dimuat.',
            $service->logs($provider, $limit)
        );
    }
}
