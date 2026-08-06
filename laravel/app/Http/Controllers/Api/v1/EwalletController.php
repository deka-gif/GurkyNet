<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\v1\EwalletInquiryRequest;
use App\Services\Tagihan\TagihanInquiryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class EwalletController extends Controller
{
    /**
     * Digiflazz E-Money inquiry (inq-pasca + amount) — inquiry only, no wallet debit.
     */
    public function inquiry(EwalletInquiryRequest $request, TagihanInquiryService $inquiryService): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        try {
            $data = $inquiryService->inquireEwallet(
                $user,
                (string) $request->input('sku_code'),
                (string) $request->input('customer_no')
            );

            return response()->json([
                'success' => true,
                'message' => 'Inquiry top up digital berhasil.',
                'data' => $data,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?: 'Inquiry gagal.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal melakukan inquiry top up digital.',
            ], 500);
        }
    }
}
