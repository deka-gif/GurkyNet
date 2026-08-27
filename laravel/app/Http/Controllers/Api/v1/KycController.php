<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Http\Resources\KycVerificationResource;
use App\Models\KycVerification;
use App\Services\Kyc\IdentityVerificationGate;
use App\Services\Kyc\KycDocumentStorage;
use App\Services\Kyc\KycService;
use App\Services\Kyc\WithdrawEligibilityService;
use App\Services\Security\OtpService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * FR-KYC-01..05 / SRS Bagian 21 — user KYC Tier 1/2 + private document access.
 */
class KycController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected KycService $kycService,
        protected IdentityVerificationGate $tier1,
        protected OtpService $otpService,
        protected KycDocumentStorage $storage,
        protected WithdrawEligibilityService $withdrawEligibility
    ) {}

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        $payload = $this->kycService->statusPayload($user);
        $latest = $this->kycService->latestForUser($user);

        return $this->successResponse('Status KYC.', [
            ...$payload,
            'verification' => $latest
                ? (new KycVerificationResource($latest))->resolve()
                : null,
            'withdrawEligibility' => $this->withdrawEligibility->evaluate($user),
        ]);
    }

    public function requestPhoneVerification(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->phone_number) {
            return $this->errorResponse('Nomor HP belum terdaftar di profil.', 422);
        }

        $otp = $this->otpService->issue(
            $user->phone_number,
            'kyc_tier1_phone',
            'phone',
            $user,
            [],
            5
        );

        return $this->successResponse('OTP verifikasi HP dikirim.', [
            'identifier' => $user->phone_number,
            'expires_at' => $otp->expires_at?->toIso8601String(),
            'resend_available_at' => $otp->resend_available_at?->toIso8601String(),
            'dummy_sent_code' => app()->environment('local', 'testing') ? $otp->code : null,
        ]);
    }

    public function verifyPhone(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();
        $this->otpService->verify(
            $user->phone_number,
            $data['code'],
            'kyc_tier1_phone',
            'phone',
            $user->id
        );

        $user->forceFill(['phone_verified_at' => now()])->save();

        return $this->successResponse('Nomor HP berhasil diverifikasi (Tier 1).', [
            'phoneVerified' => true,
            'tier1Complete' => $this->tier1->isTier1Complete($user->fresh()),
        ]);
    }

    public function requestEmailVerification(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->email) {
            return $this->errorResponse('Email belum terdaftar di profil.', 422);
        }

        if ($user->email_verified_at) {
            return $this->successResponse('Email sudah terverifikasi.', [
                'emailVerified' => true,
            ]);
        }

        $otp = $this->otpService->issue(
            $user->email,
            'kyc_tier1_email',
            'email',
            $user,
            [],
            5
        );

        return $this->successResponse('OTP verifikasi email dikirim.', [
            'identifier' => $user->email,
            'expires_at' => $otp->expires_at?->toIso8601String(),
            'resend_available_at' => $otp->resend_available_at?->toIso8601String(),
            'dummy_sent_code' => app()->environment('local', 'testing') ? $otp->code : null,
        ]);
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();
        $this->otpService->verify(
            $user->email,
            $data['code'],
            'kyc_tier1_email',
            'email',
            $user->id
        );

        $user->forceFill(['email_verified_at' => now()])->save();

        return $this->successResponse('Email berhasil diverifikasi (Tier 1).', [
            'emailVerified' => true,
            'tier1Complete' => $this->tier1->isTier1Complete($user->fresh()),
        ]);
    }

    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ktp_full_name' => 'required|string|max:255',
            'ktp_number' => 'required|string|min:10|max:32',
            'ktp_photo' => 'required|file|max:5120',
            'selfie_photo' => 'required|file|max:5120',
            'bank_name' => 'nullable|string|max:100',
            'bank_account_name' => 'required|string|max:255',
            'bank_account_number' => 'required|string|max:64',
        ]);

        try {
            $record = $this->kycService->submitTier2(
                $request->user(),
                $data['ktp_full_name'],
                $data['ktp_number'],
                $request->file('ktp_photo'),
                $request->file('selfie_photo'),
                $data['bank_account_name'],
                $data['bank_account_number'],
                $data['bank_name'] ?? null
            );

            return $this->successResponse('Pengajuan KYC Tier 2 berhasil dikirim.', [
                'verification' => (new KycVerificationResource($record))->resolve(),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->errorResponse($e->getMessage(), 422, $e->errors());
        } catch (\Throwable $e) {
            Log::error('KYC submit failed: '.$e->getMessage());

            return $this->errorResponse('Gagal mengirim pengajuan KYC.', 500);
        }
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $record = KycVerification::query()->findOrFail($id);

        if ((int) $record->user_id !== (int) $request->user()->id) {
            return $this->errorResponse('Tidak diizinkan.', 403);
        }

        return $this->successResponse('Detail KYC.', [
            'verification' => (new KycVerificationResource($record))->resolve(),
        ]);
    }

    public function document(Request $request, int $id, string $type): BinaryFileResponse|JsonResponse
    {
        if (! in_array($type, ['ktp', 'selfie'], true)) {
            return $this->errorResponse('Tipe dokumen tidak valid.', 404);
        }

        $record = KycVerification::query()->find($id);
        if (! $record) {
            return $this->errorResponse('Dokumen tidak ditemukan.', 404);
        }

        $access = $this->kycService->canAccessDocument($request->user(), $record);
        if (! $access['allowed']) {
            return $this->errorResponse('Tidak diizinkan.', 403);
        }

        $path = $type === 'ktp' ? $record->ktp_photo_path : $record->selfie_photo_path;
        if (! $this->storage->exists($path)) {
            return $this->errorResponse('Dokumen tidak ditemukan.', 404);
        }

        $absolute = $this->storage->getAbsolutePath($path);
        $mime = mime_content_type($absolute) ?: 'application/octet-stream';

        return response()->file($absolute, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="'.$type.'"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function withdrawEligibility(Request $request): JsonResponse
    {
        return $this->successResponse('Withdraw eligibility (preflight).', [
            'eligibility' => $this->withdrawEligibility->evaluate(
                $request->user(),
                $request->input('account_holder')
            ),
            'withdraw_enabled' => (bool) config('features.withdraw_enabled'),
        ]);
    }
}
