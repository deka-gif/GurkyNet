<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\v1\GameInquiryRequest;
use App\Services\Game\GameInquiryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class GameController extends Controller
{
    /**
     * Account field schema for a game brand (from product mapping / VIP nickname codes).
     */
    public function accountSchema(Request $request, GameInquiryService $inquiryService): JsonResponse
    {
        $brand = trim((string) $request->query('brand', ''));
        if ($brand === '') {
            return response()->json([
                'success' => false,
                'message' => 'Brand game wajib diisi.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Schema akun game.',
            'data' => $inquiryService->accountSchema($brand),
        ]);
    }

    /**
     * VIP get-nickname — inquiry only, no wallet debit.
     */
    public function inquiry(GameInquiryRequest $request, GameInquiryService $inquiryService): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 401);
        }

        try {
            $account = $request->input('account', []);
            if (!is_array($account)) {
                $account = [];
            }

            $data = $inquiryService->inquire(
                $user,
                (string) $request->input('sku_code'),
                $account
            );

            return response()->json([
                'success' => true,
                'message' => 'Validasi game berhasil.',
                'data' => $data,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?: 'Inquiry gagal.',
                'errors' => $e->errors(),
                'data' => [
                    'found' => false,
                ],
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal melakukan validasi game.',
            ], 500);
        }
    }
}
