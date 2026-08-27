<?php

namespace App\Http\Controllers\Api\v1\Partner;

use App\Http\Controllers\Controller;
use App\Models\ApiCredential;
use App\Models\ApiPartner;
use App\Models\ApiRequestLog;
use App\Models\PartnerDepositRequest;
use App\Models\Transaction;
use App\Services\PartnerApi\PartnerApplicationService;
use App\Services\PartnerApi\PartnerCredentialService;
use App\Services\PartnerApi\PartnerExecuteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * FR-API-09 — minimal Partner Portal API (own data only).
 */
class PartnerPortalController extends Controller
{
    protected function partnerOrFail(Request $request): ApiPartner
    {
        $partner = ApiPartner::where('user_id', $request->user()->id)->first();
        abort_unless($partner, 404, 'Partner application not found');

        return $partner;
    }

    public function apply(Request $request, PartnerApplicationService $apps): JsonResponse
    {
        $data = $request->validate([
            'nama_usaha' => ['required', 'string', 'max:255'],
            'pic_name' => ['required', 'string', 'max:255'],
            'pic_contact' => ['required', 'string', 'max:255'],
            'volume_notes' => ['nullable', 'string'],
            'tier' => ['nullable', 'string', 'max:64'],
        ]);
        $partner = $apps->apply((int) $request->user()->id, $data);

        return response()->json(['success' => true, 'data' => $partner], 201);
    }

    public function me(Request $request): JsonResponse
    {
        $partner = $this->partnerOrFail($request);
        $partner->load('wallet');

        return response()->json([
            'success' => true,
            'data' => [
                'status' => $partner->status,
                'nama_usaha' => $partner->nama_usaha,
                'tier' => $partner->tier,
                'rate_limit_per_minute' => $partner->rate_limit_per_minute,
                'wallet_balance' => (float) ($partner->wallet?->balance ?? 0),
            ],
        ]);
    }

    public function credentials(Request $request): JsonResponse
    {
        $partner = $this->partnerOrFail($request);
        $rows = ApiCredential::where('partner_id', $partner->id)
            ->get(['id', 'api_key', 'secret_hint', 'callback_url', 'is_sandbox', 'is_active', 'revoked_at', 'created_at']);

        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function rotate(Request $request, int $credentialId, PartnerCredentialService $creds): JsonResponse
    {
        $partner = $this->partnerOrFail($request);
        $cred = ApiCredential::where('partner_id', $partner->id)->where('id', $credentialId)->firstOrFail();
        $result = $creds->rotate($cred, (int) $request->user()->id);

        return response()->json([
            'success' => true,
            'data' => [
                'api_key' => $result['credential']->api_key,
                'api_secret' => $result['plain_secret'],
                'secret_hint' => $result['credential']->secret_hint,
            ],
        ]);
    }

    public function revoke(Request $request, int $credentialId, PartnerCredentialService $creds): JsonResponse
    {
        $partner = $this->partnerOrFail($request);
        $cred = ApiCredential::where('partner_id', $partner->id)->where('id', $credentialId)->firstOrFail();
        $creds->revoke($cred, (int) $request->user()->id);

        return response()->json(['success' => true]);
    }

    public function logs(Request $request): JsonResponse
    {
        $partner = $this->partnerOrFail($request);
        $rows = ApiRequestLog::where('partner_id', $partner->id)->orderByDesc('id')->limit(100)->get();

        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function transactions(Request $request, PartnerExecuteService $execute): JsonResponse
    {
        $partner = $this->partnerOrFail($request);
        $rows = Transaction::where('partner_id', $partner->id)
            ->where('channel', 'partner_api')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn ($tx) => $execute->publicTx($tx));

        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function requestDeposit(Request $request, PartnerApplicationService $apps): JsonResponse
    {
        $partner = $this->partnerOrFail($request);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1000'],
            'note' => ['nullable', 'string', 'max:255'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);
        $dep = $apps->requestDeposit(
            $partner,
            (float) $data['amount'],
            $data['note'] ?? null,
            $data['idempotency_key'] ?? null
        );

        return response()->json(['success' => true, 'data' => $dep], 201);
    }

    public function deposits(Request $request): JsonResponse
    {
        $partner = $this->partnerOrFail($request);
        $rows = PartnerDepositRequest::where('partner_id', $partner->id)->orderByDesc('id')->limit(50)->get();

        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function docs(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'openapi' => url('/api/v1/partner/openapi.json'),
                'auth' => 'HMAC-SHA256(body, API Secret); headers X-API-Key, X-Signature, X-Timestamp',
            ],
        ]);
    }
}
