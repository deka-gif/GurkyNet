<?php

namespace App\Services\PartnerApi;

use App\Models\ApiPartner;
use App\Models\PartnerDepositRequest;
use App\Services\PartnerApi\PartnerCredentialService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** FR-API-01 — partner application → pending → Ops/Owner approval. */
class PartnerApplicationService
{
    public function __construct(protected PartnerCredentialService $credentials) {}

    public function apply(int $userId, array $data): ApiPartner
    {
        $existing = ApiPartner::where('user_id', $userId)
            ->whereIn('status', [ApiPartner::STATUS_PENDING, ApiPartner::STATUS_APPROVED])
            ->first();
        if ($existing) {
            throw ValidationException::withMessages([
                'application' => ['Pengajuan Mitra sudah ada (pending/approved).'],
            ]);
        }

        return ApiPartner::create([
            'user_id' => $userId,
            'nama_usaha' => $data['nama_usaha'],
            'pic_name' => $data['pic_name'],
            'pic_contact' => $data['pic_contact'],
            'tier' => $data['tier'] ?? 'standard',
            'status' => ApiPartner::STATUS_PENDING,
            'rate_limit_per_minute' => (int) config('partner_api.default_rate_limit_per_minute', 60),
            'volume_notes' => $data['volume_notes'] ?? null,
        ]);
    }

    /**
     * @return array{partner: ApiPartner, plain_secret: ?string, api_key: ?string}
     */
    public function approve(ApiPartner $partner, int $reviewedBy, ?string $callbackUrl = null, bool $issueSandbox = true): array
    {
        return DB::transaction(function () use ($partner, $reviewedBy, $callbackUrl, $issueSandbox) {
            /** @var ApiPartner $locked */
            $locked = ApiPartner::where('id', $partner->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === ApiPartner::STATUS_APPROVED) {
                return ['partner' => $locked, 'plain_secret' => null, 'api_key' => null];
            }
            if (! in_array($locked->status, [ApiPartner::STATUS_PENDING, ApiPartner::STATUS_REJECTED], true)) {
                throw ValidationException::withMessages(['status' => ['Partner tidak dapat disetujui.']]);
            }

            $locked->update([
                'status' => ApiPartner::STATUS_APPROVED,
                'reviewed_by' => $reviewedBy,
                'reviewed_at' => now(),
            ]);

            $this->credentials->ensureWallet($locked);

            $plain = null;
            $apiKey = null;
            if ($issueSandbox) {
                $gen = $this->credentials->generate($locked, $callbackUrl, true, $reviewedBy);
                $plain = $gen['plain_secret'];
                $apiKey = $gen['credential']->api_key;
            }

            \App\Models\ActivityLog::create([
                'user_id' => $reviewedBy,
                'activity' => 'partner_api.approved',
                'payload' => [
                    'partner_id' => $locked->id,
                    'action' => 'approved',
                    'at' => now()->toIso8601String(),
                ],
            ]);

            return ['partner' => $locked->fresh(), 'plain_secret' => $plain, 'api_key' => $apiKey];
        });
    }

    public function reject(ApiPartner $partner, int $reviewedBy, ?string $note = null): ApiPartner
    {
        $partner->update([
            'status' => ApiPartner::STATUS_REJECTED,
            'reviewed_by' => $reviewedBy,
            'reviewed_at' => now(),
            'review_note' => $note,
        ]);

        \App\Models\ActivityLog::create([
            'user_id' => $reviewedBy,
            'activity' => 'partner_api.rejected',
            'payload' => [
                'partner_id' => $partner->id,
                'action' => 'rejected',
                'note' => $note,
                'at' => now()->toIso8601String(),
            ],
        ]);

        return $partner->fresh();
    }

    public function requestDeposit(ApiPartner $partner, float $amount, ?string $note, ?string $idempotencyKey): PartnerDepositRequest
    {
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => ['Nominal deposit tidak valid.']]);
        }

        if ($idempotencyKey) {
            $existing = PartnerDepositRequest::where('partner_id', $partner->id)
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($existing) {
                return $existing;
            }
        }

        return PartnerDepositRequest::create([
            'partner_id' => $partner->id,
            'amount' => $amount,
            'status' => PartnerDepositRequest::STATUS_PENDING,
            'note' => $note,
            'idempotency_key' => $idempotencyKey,
        ]);
    }
}
