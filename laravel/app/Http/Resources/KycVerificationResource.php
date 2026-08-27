<?php

namespace App\Http\Resources;

use App\Models\KycVerification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * FR-KYC-02 / SRS Bagian 21 — safe KYC payload (no NIK, no private paths/URLs).
 */
class KycVerificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var KycVerification $kyc */
        $kyc = $this->resource;
        $includeSensitive = (bool) ($this->additional['include_reviewer_fields'] ?? false);

        $payload = [
            'id' => $kyc->id,
            'userId' => $kyc->user_id,
            'tier' => $kyc->tier,
            'status' => $kyc->status,
            'ktpFullName' => $kyc->ktp_full_name,
            'bankName' => $kyc->bank_name,
            'bankAccountName' => $kyc->bank_account_name,
            'bankAccountNumberMasked' => $this->maskAccount($kyc->bank_account_number),
            'submittedAt' => $kyc->submitted_at?->toIso8601String(),
            'reviewedAt' => $kyc->reviewed_at?->toIso8601String(),
            'rejectionReason' => $kyc->isRejected() ? $kyc->rejection_reason : null,
            'hasKtpDocument' => filled($kyc->ktp_photo_path),
            'hasSelfieDocument' => filled($kyc->selfie_photo_path),
            // Authorized download endpoints — never public URLs.
            'ktpDocumentUrl' => null,
            'selfieDocumentUrl' => null,
            'documents' => [
                'ktp' => '/api/v1/kyc/verifications/'.$kyc->id.'/documents/ktp',
                'selfie' => '/api/v1/kyc/verifications/'.$kyc->id.'/documents/selfie',
            ],
        ];

        if ($includeSensitive) {
            $payload['ktpNumberMasked'] = $this->maskNik($kyc->ktp_number);
            $payload['reviewedBy'] = $kyc->reviewed_by;
            $payload['user'] = $kyc->relationLoaded('user') ? [
                'id' => $kyc->user?->id,
                'name' => $kyc->user?->name,
                'email' => $kyc->user?->email,
                'phone' => $kyc->user?->phone_number,
                'userType' => $kyc->user?->user_type,
            ] : null;
        }

        return $payload;
    }

    protected function maskAccount(?string $number): ?string
    {
        if (! $number) {
            return null;
        }
        $len = strlen($number);
        if ($len <= 4) {
            return str_repeat('*', $len);
        }

        return str_repeat('*', max(0, $len - 4)).substr($number, -4);
    }

    protected function maskNik(?string $nik): ?string
    {
        if (! $nik) {
            return null;
        }
        $len = strlen($nik);
        if ($len <= 4) {
            return str_repeat('*', $len);
        }

        return str_repeat('*', max(0, $len - 4)).substr($nik, -4);
    }
}
