<?php

namespace App\Http\Controllers\Api\v1\Partner;

use App\Http\Controllers\Controller;
use App\Models\ApiCredential;
use App\Models\ApiPartner;
use App\Models\Product;
use App\Models\Transaction;
use App\Services\AvailabilityService;
use App\Services\PartnerApi\PartnerExecuteService;
use App\Services\PartnerApi\PartnerPricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * SRS Bagian 30 — H2H Mitra endpoints FR-API-04..06.
 */
class PartnerH2hController extends Controller
{
    public function price(Request $request, PartnerPricingService $pricing): JsonResponse
    {
        /** @var ApiPartner $partner */
        $partner = $request->attributes->get('api_partner');
        $sku = $request->query('sku_code') ?: $request->input('sku_code');
        $items = $pricing->inquire($partner, $sku ? (string) $sku : null);

        if ($sku && $items === []) {
            return response()->json(['success' => false, 'message' => 'Product inactive or not found'], 404);
        }

        return response()->json(['success' => true, 'message' => 'OK', 'data' => $items, 'meta' => null, 'errors' => null]);
    }

    public function execute(Request $request, PartnerExecuteService $execute): JsonResponse
    {
        /** @var ApiPartner $partner */
        $partner = $request->attributes->get('api_partner');
        /** @var ApiCredential $credential */
        $credential = $request->attributes->get('api_credential');

        $data = $request->validate([
            'sku_code' => ['required', 'string', 'max:64'],
            'target_number' => ['required', 'string', 'max:64'],
            'partner_ref' => ['required', 'string', 'max:128'],
            'idempotency_key' => ['required', 'string', 'max:128'],
        ]);

        try {
            $result = $execute->execute($partner, $credential, $data);
        } catch (ValidationException $e) {
            throw $e;
        }

        return response()->json([
            'success' => true,
            'message' => $result['replay'] ? 'Idempotent replay.' : 'Transaction accepted.',
            'data' => array_merge($result['data'], ['replay' => $result['replay']]),
            'meta' => ['replay' => $result['replay']],
            'errors' => null,
        ], $result['replay'] ? 200 : 201);
    }

    public function status(Request $request, PartnerExecuteService $execute): JsonResponse
    {
        /** @var ApiPartner $partner */
        $partner = $request->attributes->get('api_partner');
        $ref = (string) ($request->query('partner_ref') ?: $request->input('partner_ref', ''));
        if ($ref === '') {
            return response()->json(['success' => false, 'message' => 'partner_ref required', 'data' => null, 'meta' => null, 'errors' => null], 422);
        }

        $tx = Transaction::query()
            ->where('partner_id', $partner->id)
            ->where('partner_ref', $ref)
            ->where('channel', 'partner_api')
            ->first();

        if (! $tx) {
            return response()->json(['success' => false, 'message' => 'Not found', 'data' => null, 'meta' => null, 'errors' => null], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'OK',
            'data' => $execute->publicTx($tx),
            'meta' => null,
            'errors' => null,
        ]);
    }
}
