<?php

namespace App\Http\Controllers\Api\v1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ApiCredential;
use App\Models\ApiPartner;
use App\Models\PartnerAbuseFlag;
use App\Models\PartnerDepositRequest;
use App\Services\PartnerApi\PartnerApplicationService;
use App\Services\PartnerApi\PartnerCredentialService;
use App\Services\PartnerApi\PartnerPricingService;
use App\Services\PartnerApi\PartnerWalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ops/Owner/Finance administration for Mitra API (SRS 30 / Phase 20 RBAC).
 */
class PartnerApiAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = ApiPartner::query()->orderByDesc('id')->paginate(50);

        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function approve(Request $request, int $id, PartnerApplicationService $apps, PartnerCredentialService $creds): JsonResponse
    {
        $partner = ApiPartner::findOrFail($id);
        $callback = $request->input('callback_url');
        $result = $apps->approve($partner, (int) $request->user()->id, $callback, true);

        // Production credential only when Ops explicitly requests (still gated by PARTNER_API_ENABLED).
        $prodSecret = null;
        $prodKey = null;
        if ($request->boolean('issue_production_key')) {
            $gen = $creds->generate($result['partner'], $callback, false, (int) $request->user()->id);
            $prodSecret = $gen['plain_secret'];
            $prodKey = $gen['credential']->api_key;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'partner' => $result['partner'],
                'sandbox_api_key' => $result['api_key'],
                'sandbox_api_secret' => $result['plain_secret'], // one-time
                'production_api_key' => $prodKey,
                'production_api_secret' => $prodSecret, // one-time
            ],
        ]);
    }

    public function reject(Request $request, int $id, PartnerApplicationService $apps): JsonResponse
    {
        $partner = ApiPartner::findOrFail($id);
        $apps->reject($partner, (int) $request->user()->id, $request->input('note'));

        return response()->json(['success' => true]);
    }

    public function updateRateLimit(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'rate_limit_per_minute' => ['required', 'integer', 'min:1', 'max:6000'],
        ]);
        $partner = ApiPartner::findOrFail($id);
        $partner->update(['rate_limit_per_minute' => $data['rate_limit_per_minute']]);

        return response()->json(['success' => true, 'data' => $partner->fresh()]);
    }

    public function upsertPrice(Request $request, PartnerPricingService $pricing): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer'],
            'partner_tier' => ['required', 'string', 'max:64'],
            'sell_price' => ['required', 'numeric', 'min:0'],
        ]);
        $row = $pricing->upsertPrice(
            (int) $data['product_id'],
            $data['partner_tier'],
            (float) $data['sell_price'],
            (int) $request->user()->id
        );

        return response()->json(['success' => true, 'data' => $row]);
    }

    public function revokeCredential(Request $request, int $credentialId, PartnerCredentialService $creds): JsonResponse
    {
        $cred = ApiCredential::findOrFail($credentialId);
        $creds->revoke($cred, (int) $request->user()->id);

        return response()->json(['success' => true]);
    }

    public function rotateCredential(Request $request, int $credentialId, PartnerCredentialService $creds): JsonResponse
    {
        $cred = ApiCredential::findOrFail($credentialId);
        $result = $creds->rotate($cred, (int) $request->user()->id);

        return response()->json([
            'success' => true,
            'data' => [
                'api_key' => $result['credential']->api_key,
                'api_secret' => $result['plain_secret'], // one-time
                'secret_hint' => $result['credential']->secret_hint,
                'is_sandbox' => $result['credential']->is_sandbox,
            ],
        ]);
    }

    public function approveDeposit(Request $request, int $id, PartnerWalletService $wallets): JsonResponse
    {
        $dep = PartnerDepositRequest::findOrFail($id);
        $row = $wallets->creditDeposit($dep, (int) $request->user()->id);

        return response()->json(['success' => true, 'data' => $row]);
    }

    public function rejectDeposit(Request $request, int $id, PartnerWalletService $wallets): JsonResponse
    {
        $dep = PartnerDepositRequest::findOrFail($id);
        $row = $wallets->rejectDeposit($dep, (int) $request->user()->id, $request->input('note'));

        return response()->json(['success' => true, 'data' => $row]);
    }

    public function deposits(): JsonResponse
    {
        $rows = PartnerDepositRequest::query()->orderByDesc('id')->paginate(50);

        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function abuseFlags(): JsonResponse
    {
        $rows = PartnerAbuseFlag::query()->orderByDesc('id')->paginate(50);

        return response()->json(['success' => true, 'data' => $rows]);
    }
}
