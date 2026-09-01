<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Services\Langganan\LanggananAccountResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LanggananController extends Controller
{
    /**
     * Account field schema for a langganan product (SKU → Digiflazz desc → brand config).
     */
    public function accountSchema(Request $request, LanggananAccountResolver $resolver): JsonResponse
    {
        $brand = trim((string) $request->query('brand', ''));
        $sku = trim((string) $request->query('sku', ''));

        if ($brand === '') {
            return response()->json([
                'success' => false,
                'message' => 'Brand aplikasi wajib diisi.',
            ], 422);
        }

        if ($sku === '') {
            return response()->json([
                'success' => false,
                'message' => 'SKU produk wajib diisi.',
            ], 422);
        }

        $resolved = $resolver->resolveForProduct($brand, $sku);

        return response()->json([
            'success' => true,
            'message' => 'Schema akun langganan digital.',
            'data' => [
                'brand' => $brand,
                'sku' => $sku,
                'code' => $resolved['code'],
                'label' => $resolved['label'],
                'delivery' => $resolved['delivery'],
                'fields' => $resolved['fields'],
            ],
        ]);
    }
}
