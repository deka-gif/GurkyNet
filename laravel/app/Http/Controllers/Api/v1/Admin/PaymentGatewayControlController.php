<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Payment\PaymentGatewayControlService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Payment Gateway Control Center — Operations.
 * Product providers (Digiflazz / VIP) must never appear here.
 */
class PaymentGatewayControlController extends Controller
{
    use ApiResponseTrait;

    public function index(PaymentGatewayControlService $service): JsonResponse
    {
        return $this->successResponse(
            'Payment Gateway Control Center berhasil dimuat.',
            $service->listControlCenter()
        );
    }

    public function show(string $code, PaymentGatewayControlService $service): JsonResponse
    {
        return $this->successResponse(
            'Detail payment gateway berhasil dimuat.',
            $service->show($code)
        );
    }

    public function enable(string $code, PaymentGatewayControlService $service): JsonResponse
    {
        return $this->successResponse(
            'Payment gateway diaktifkan.',
            $service->enable($code)
        );
    }

    public function disable(string $code, PaymentGatewayControlService $service): JsonResponse
    {
        return $this->successResponse(
            'Payment gateway dimatikan.',
            $service->disable($code)
        );
    }

    public function maintenance(string $code, PaymentGatewayControlService $service): JsonResponse
    {
        return $this->successResponse(
            'Payment gateway masuk mode maintenance.',
            $service->setMaintenance($code)
        );
    }

    public function setPriority(string $code, Request $request, PaymentGatewayControlService $service): JsonResponse
    {
        $priority = (int) $request->input('priority', 1);

        return $this->successResponse(
            'Prioritas payment gateway diperbarui.',
            $service->setPriority($code, $priority)
        );
    }

    public function healthCheck(string $code, PaymentGatewayControlService $service): JsonResponse
    {
        return $this->successResponse(
            'Health check payment gateway selesai.',
            $service->healthCheck($code)
        );
    }

    public function refresh(PaymentGatewayControlService $service): JsonResponse
    {
        return $this->successResponse(
            'Status payment gateway di-refresh dari konfigurasi backend.',
            $service->refreshAll()
        );
    }

    public function logs(string $code, Request $request, PaymentGatewayControlService $service): JsonResponse
    {
        $limit = (int) $request->input('limit', 50);

        return $this->successResponse(
            'Log payment gateway berhasil dimuat.',
            $service->logs($code, $limit)
        );
    }
}
