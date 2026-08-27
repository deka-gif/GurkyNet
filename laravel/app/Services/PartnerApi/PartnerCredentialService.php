<?php

namespace App\Services\PartnerApi;

use App\Models\ApiCredential;
use App\Models\ApiPartner;
use App\Models\PartnerWallet;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * FR-API-02 / FR-API-11 — credential generate, revoke, rotate.
 * Secret stored encrypted (needed for HMAC verify); plaintext shown once only.
 */
class PartnerCredentialService
{
    /**
     * @return array{credential: ApiCredential, plain_secret: string}
     */
    public function generate(ApiPartner $partner, ?string $callbackUrl = null, bool $sandbox = false, ?int $createdBy = null): array
    {
        $plainSecret = Str::random(48);
        $apiKey = ($sandbox ? 'pk_test_' : 'pk_live_') . Str::lower(Str::random(32));

        $credential = ApiCredential::create([
            'partner_id' => $partner->id,
            'api_key' => $apiKey,
            'secret_encrypted' => Crypt::encryptString($plainSecret),
            'secret_hint' => substr($plainSecret, -4),
            'callback_url' => $callbackUrl,
            'is_sandbox' => $sandbox,
            'is_active' => true,
            'created_by' => $createdBy,
        ]);

        return ['credential' => $credential, 'plain_secret' => $plainSecret];
    }

    public function revoke(ApiCredential $credential, ?int $actorId = null): ApiCredential
    {
        $credential->update([
            'is_active' => false,
            'revoked_at' => now(),
        ]);

        $this->audit($actorId, $credential->partner_id, $credential->id, 'credential_revoked');

        return $credential->fresh();
    }

    /**
     * Rotate: old credential invalidated; new active. Secret shown once.
     *
     * @return array{credential: ApiCredential, plain_secret: string}
     */
    public function rotate(ApiCredential $old, ?int $actorId = null): array
    {
        return DB::transaction(function () use ($old, $actorId) {
            $this->revoke($old, $actorId);
            $result = $this->generate(
                $old->partner,
                $old->callback_url,
                (bool) $old->is_sandbox,
                $actorId
            );
            $this->audit($actorId, $old->partner_id, $result['credential']->id, 'credential_rotated', [
                'previous_credential_id' => $old->id,
            ]);

            return $result;
        });
    }

    public function ensureWallet(ApiPartner $partner): PartnerWallet
    {
        return PartnerWallet::firstOrCreate(
            ['partner_id' => $partner->id],
            ['balance' => 0, 'status' => 'active']
        );
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    protected function audit(?int $actorId, int $partnerId, int $credentialId, string $action, array $extra = []): void
    {
        try {
            \App\Models\ActivityLog::create([
                'user_id' => $actorId,
                'activity' => 'partner_api.'.$action,
                'payload' => array_merge([
                    'partner_id' => $partnerId,
                    'credential_id' => $credentialId,
                    'action' => $action,
                    'at' => now()->toIso8601String(),
                ], $extra),
            ]);
        } catch (\Throwable) {
            // audit best-effort
        }
    }
}
