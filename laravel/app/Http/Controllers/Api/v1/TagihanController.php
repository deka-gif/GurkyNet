<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\v1\TagihanInquiryRequest;
use App\Services\Tagihan\TagihanInquiryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class TagihanController extends Controller
{
    /**
     * Digiflazz inq-pasca — inquiry only, no wallet debit.
     */
    public function inquiry(TagihanInquiryRequest $request, TagihanInquiryService $inquiryService): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        try {
            $year = $request->input('year');
            $data = $inquiryService->inquire(
                $user,
                (string) $request->input('sku_code'),
                (string) $request->input('customer_no'),
                $year !== null && $year !== '' ? (int) $year : null
            );

            return response()->json([
                'success' => true,
                'message' => 'Inquiry tagihan berhasil.',
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
                'message' => 'Gagal melakukan inquiry tagihan.',
            ], 500);
        }
    }
}
