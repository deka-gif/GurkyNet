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

        $response = $this->successResponse('Product provider diaktifkan.', $card);

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
            'Product provider dinonaktifkan. Trafik otomatis dialihkan ke provider aktif berikutnya.',
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

    public function setPrimary(int $id, ProductProviderControlService $service): JsonResponse
    {
        $provider = ProductProvider::findOrFail($id);
        $fresh = $service->setPrimary($provider);

        return $this->successResponse('Product provider dijadikan primary.', $service->toCard($fresh));
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

    public function sync(int $id, Request $request, ProductProviderControlService $service): JsonResponse
    {
        $provider = ProductProvider::findOrFail($id);
        $cmds = $request->input('cmd', ['prepaid', 'pasca']);
        if (!is_array($cmds)) {
            $cmds = [$cmds];
        }

        try {
            $result = $service->syncNow($provider, ['cmd' => $cmds]);

            return $this->successResponse($result['message'] ?? 'Sync berhasil.', $result);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return $this->errorResponse($e->getMessage(), 422);
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
