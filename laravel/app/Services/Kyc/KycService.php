<?php

namespace App\Services\Kyc;

use App\Models\ActivityLog;
use App\Models\KycVerification;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-KYC-02..05 / SRS Bagian 21 — Tier 2 submit + CS/Finance review.
 */
class KycService
{
    public function __construct(
        protected KycDocumentStorage $storage,
        protected BankAccountNameMatcher $bankMatcher,
        protected IdentityVerificationGate $tier1
    ) {}

    public function latestForUser(User $user): ?KycVerification
    {
        return KycVerification::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->first();
    }

    public function approvedTier2(User $user): ?KycVerification
    {
        return KycVerification::query()
            ->where('user_id', $user->id)
            ->where('tier', KycVerification::TIER_2)
            ->where('status', KycVerification::STATUS_APPROVED)
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Profile-safe status summary (no NIK / no private paths).
     *
     * @return array<string, mixed>
     */
    public function statusPayload(User $user): array
    {
        $latest = $this->latestForUser($user);
        $tier1 = $this->tier1->isTier1Complete($user);
        $approved = $this->approvedTier2($user);

        $kycStatus = 'unverified';
        if ($approved) {
            $kycStatus = 'verified';
        } elseif ($latest?->isPending()) {
            $kycStatus = 'pending';
        } elseif ($latest?->isRejected()) {
            $kycStatus = 'rejected';
        } elseif ($tier1) {
            $kycStatus = 'tier1';
        }

        return [
            'kycStatus' => $kycStatus,
            'tier1' => [
                'complete' => $tier1,
                'phoneVerified' => $this->tier1->isPhoneVerified($user),
                'emailVerified' => $this->tier1->isEmailVerified($user),
            ],
            'tier2' => [
                'status' => $latest?->status,
                'submittedAt' => $latest?->submitted_at?->toIso8601String(),
                'reviewedAt' => $latest?->reviewed_at?->toIso8601String(),
                'rejectionReason' => $latest?->isRejected() ? $latest->rejection_reason : null,
                'verificationId' => $latest?->id,
            ],
        ];
    }

    /**
     * @throws ValidationException
     */
    public function submitTier2(
        User $user,
        string $ktpFullName,
        string $ktpNumber,
        UploadedFile $ktpPhoto,
        UploadedFile $selfiePhoto,
        string $bankAccountName,
        string $bankAccountNumber,
        ?string $bankName = null
    ): KycVerification {
        $this->tier1->assertTier1($user);

        $pending = KycVerification::query()
            ->where('user_id', $user->id)
            ->where('status', KycVerification::STATUS_PENDING)
            ->exists();

        if ($pending) {
            throw ValidationException::withMessages([
                'status' => ['Pengajuan KYC Tier 2 masih menunggu review.'],
            ]);
        }

        if ($this->approvedTier2($user)) {
            throw ValidationException::withMessages([
                'status' => ['KYC Tier 2 sudah disetujui.'],
            ]);
        }

        if (! $this->bankMatcher->matches($ktpFullName, $bankAccountName)) {
            throw ValidationException::withMessages([
                'bank_account_name' => ['Nama rekening harus sama dengan nama di KTP (FR-KYC-03).'],
            ]);
        }

        $ktpPath = $this->storage->store($ktpPhoto, $user->id, 'ktp');
        $selfiePath = $this->storage->store($selfiePhoto, $user->id, 'selfie');

        $record = DB::transaction(function () use ($user, $ktpFullName, $ktpNumber, $ktpPath, $selfiePath, $bankAccountName, $bankAccountNumber, $bankName) {
            return KycVerification::create([
                'user_id' => $user->id,
                'tier' => KycVerification::TIER_2,
                'ktp_full_name' => trim($ktpFullName),
                'ktp_number' => preg_replace('/\s+/', '', $ktpNumber) ?? $ktpNumber,
                'ktp_photo_path' => $ktpPath,
                'selfie_photo_path' => $selfiePath,
                'bank_name' => $bankName,
                'bank_account_name' => trim($bankAccountName),
                'bank_account_number' => preg_replace('/\s+/', '', $bankAccountNumber) ?? $bankAccountNumber,
                'status' => KycVerification::STATUS_PENDING,
                'submitted_at' => now(),
            ]);
        });

        $this->audit($user->id, 'KYC_SUBMIT', [
            'kyc_verification_id' => $record->id,
            'tier' => 2,
            // Never log NIK or document paths that could become public.
        ]);

        return $record;
    }

    /**
     * @throws ValidationException
     */
    public function approve(KycVerification $record, User $reviewer): KycVerification
    {
        if (! $record->isPending()) {
            throw ValidationException::withMessages([
                'status' => ['Hanya pengajuan pending yang dapat disetujui.'],
            ]);
        }

        $record->forceFill([
            'status' => KycVerification::STATUS_APPROVED,
            'rejection_reason' => null,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ])->save();

        $this->audit($reviewer->id, 'KYC_APPROVE', [
            'kyc_verification_id' => $record->id,
            'subject_user_id' => $record->user_id,
        ]);

        return $record->fresh();
    }

    /**
     * @throws ValidationException
     */
    public function reject(KycVerification $record, User $reviewer, string $reason): KycVerification
    {
        $reason = trim($reason);
        if ($reason === '') {
            throw ValidationException::withMessages([
                'rejection_reason' => ['Alasan penolakan wajib diisi.'],
            ]);
        }

        if (! $record->isPending()) {
            throw ValidationException::withMessages([
                'status' => ['Hanya pengajuan pending yang dapat ditolak.'],
            ]);
        }

        $record->forceFill([
            'status' => KycVerification::STATUS_REJECTED,
            'rejection_reason' => $reason,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ])->save();

        $this->audit($reviewer->id, 'KYC_REJECT', [
            'kyc_verification_id' => $record->id,
            'subject_user_id' => $record->user_id,
            // Do not store free-text reason that may include NIK; reason stays on the row.
        ]);

        return $record->fresh();
    }

    /**
     * @return array{allowed: bool, reasons: list<string>}
     */
    public function canAccessDocument(User $actor, KycVerification $record): array
    {
        if ((int) $actor->id === (int) $record->user_id) {
            return ['allowed' => true, 'reasons' => []];
        }

        if ($actor->isCustomerSupport() || $actor->isFinance() || $actor->isOwner() || $actor->isSuperAdmin()) {
            return ['allowed' => true, 'reasons' => []];
        }

        return ['allowed' => false, 'reasons' => ['unauthorized']];
    }

    protected function audit(?int $actorId, string $activity, array $payload): void
    {
        ActivityLog::create([
            'user_id' => $actorId,
            'activity' => $activity,
            'payload' => array_merge($payload, [
                'ip' => request()->ip(),
                'timestamp' => now()->toIso8601String(),
            ]),
        ]);
    }
}
