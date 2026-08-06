<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\v1\PlnInquiryRequest;
use App\Services\Pln\PlnInquiryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class PlnController extends Controller
{
    /**
     * Digiflazz /inquiry-pln — meter validation only, no wallet debit.
     */
    public function inquiry(PlnInquiryRequest $request, PlnInquiryService $inquiryService): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        try {
            $data = $inquiryService->inquire(
                $user,
                (string) $request->input('customer_no')
            );

            return response()->json([
                'success' => true,
                'message' => 'Inquiry meter PLN berhasil.',
                'data' => $data,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?: 'Inquiry meter gagal.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal melakukan inquiry meter PLN.',
            ], 500);
        }
    }
}
