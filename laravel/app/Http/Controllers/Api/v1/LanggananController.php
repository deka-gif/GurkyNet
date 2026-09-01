<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Services\Langganan\LanggananAccountResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LanggananController extends Controller
{
    /**
     * Account field schema for a langganan brand (from gurky_langganan config).
     */
    public function accountSchema(Request $request, LanggananAccountResolver $resolver): JsonResponse
    {
        $brand = trim((string) $request->query('brand', ''));
        if ($brand === '') {
            return response()->json([
                'success' => false,
                'message' => 'Brand aplikasi wajib diisi.',
            ], 422);
        }

        $resolved = $resolver->resolve($brand);

        return response()->json([
            'success' => true,
            'message' => 'Schema akun langganan digital.',
            'data' => [
                'brand' => $brand,
                'code' => $resolved['code'],
                'label' => $resolved['label'],
                'delivery' => $resolved['delivery'],
                'fields' => $resolved['fields'],
            ],
        ]);
    }
}
