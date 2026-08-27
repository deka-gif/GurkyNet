<?php

namespace App\Services\Legal;

use App\Models\LegalDocument;
use App\Models\PolicyAcceptance;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Sprint 18 — server-side policy acceptance (Bagian 27/28).
 * Minimal evidence: user_id, document_type, policy_version, accepted_at.
 */
class PolicyAcceptanceService
{
    /**
     * @param  list<string>|null  $types
     * @return list<PolicyAcceptance>
     */
    public function acceptCurrentPublished(User $user, ?array $types = null): array
    {
        $types = $types ?? [
            LegalDocument::TYPE_PRIVACY,
            LegalDocument::TYPE_TERMS,
            LegalDocument::TYPE_REFUND,
        ];

        return DB::transaction(function () use ($user, $types) {
            $out = [];
            foreach ($types as $type) {
                $doc = LegalDocument::query()->where('type', $type)->first();
                if (! $doc || (int) $doc->version_number < 1) {
                    throw ValidationException::withMessages([
                        'policies' => ["Dokumen legal {$type} belum tersedia."],
                    ]);
                }

                $existing = PolicyAcceptance::query()
                    ->where('user_id', $user->id)
                    ->where('document_type', $type)
                    ->where('policy_version', (int) $doc->version_number)
                    ->first();

                if ($existing) {
                    $out[] = $existing;
                    continue;
                }

                $out[] = PolicyAcceptance::create([
                    'user_id' => $user->id,
                    'document_type' => $type,
                    'policy_version' => (int) $doc->version_number,
                    'accepted_at' => now(),
                ]);
            }

            return $out;
        });
    }

    public function hasAcceptedVersion(User $user, string $documentType, int $version): bool
    {
        return PolicyAcceptance::query()
            ->where('user_id', $user->id)
            ->where('document_type', $documentType)
            ->where('policy_version', $version)
            ->exists();
    }

    public function latestAcceptance(User $user, string $documentType): ?PolicyAcceptance
    {
        return PolicyAcceptance::query()
            ->where('user_id', $user->id)
            ->where('document_type', $documentType)
            ->orderByDesc('policy_version')
            ->first();
    }

    public function requiresReacceptance(User $user, string $documentType): bool
    {
        $doc = LegalDocument::query()->where('type', $documentType)->first();
        if (! $doc || (int) $doc->version_number < 1) {
            return true;
        }

        return ! $this->hasAcceptedVersion($user, $documentType, (int) $doc->version_number);
    }
}
