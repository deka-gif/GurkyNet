<?php

namespace App\Services\Referral;

use App\Models\ReferralRelation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * FR-REF-02/03 — immutable upline/downline relations, max 2 levels.
 */
class ReferralRelationService
{
    public function __construct(
        protected ReferralCodeService $codes,
        protected ReferralFraudService $fraud
    ) {}

    /**
     * Bind referral at registration. Empty code = no relation.
     */
    public function attachAtRegistration(User $newUser, ?string $referralCode, ?array $context = null): void
    {
        $context = $context ?? [];

        if ($referralCode === null || trim($referralCode) === '') {
            return;
        }

        $normalized = $this->codes->normalizeAndValidate($referralCode);
        $upline = $this->codes->findUserByCode($normalized);
        if (! $upline) {
            throw ValidationException::withMessages([
                'referral_code' => ['Kode referral tidak valid.'],
            ]);
        }

        if ((int) $upline->id === (int) $newUser->id) {
            $this->fraud->flagStructural($newUser, 'self_referral_attempt', [
                'code' => $normalized,
            ], [$newUser->id]);
            throw ValidationException::withMessages([
                'referral_code' => ['Self-referral tidak diizinkan.'],
            ]);
        }

        // Circular: new user must not already be an ancestor of upline (impossible at register for brand-new user),
        // but also reject if upline is somehow already downline of newUser.
        if ($this->wouldCreateCycle($newUser->id, $upline->id)) {
            $this->fraud->flagStructural($newUser, 'circular_referral_attempt', [
                'upline_user_id' => $upline->id,
                'code' => $normalized,
            ], [$newUser->id, $upline->id]);
            throw ValidationException::withMessages([
                'referral_code' => ['Relasi referral circular tidak diizinkan.'],
            ]);
        }

        DB::transaction(function () use ($newUser, $upline, $context) {
            if (ReferralRelation::query()->where('downline_user_id', $newUser->id)->exists()) {
                throw ValidationException::withMessages([
                    'referral_code' => ['Relasi referral sudah ada dan bersifat immutable.'],
                ]);
            }

            ReferralRelation::query()->create([
                'downline_user_id' => $newUser->id,
                'upline_user_id' => $upline->id,
                'level' => 1,
                'created_at' => now(),
            ]);

            // Level 2: upline's L1 parent (max depth 2 — no L3).
            $grand = ReferralRelation::query()
                ->where('downline_user_id', $upline->id)
                ->where('level', 1)
                ->first();

            if ($grand && (int) $grand->upline_user_id !== (int) $newUser->id) {
                ReferralRelation::query()->create([
                    'downline_user_id' => $newUser->id,
                    'upline_user_id' => $grand->upline_user_id,
                    'level' => 2,
                    'created_at' => now(),
                ]);
            }

            if (! empty($context)) {
                $this->fraud->recordRegistrationSignals($newUser, $upline, $context);
            }
        });
    }

    /**
     * @return array{1: ?ReferralRelation, 2: ?ReferralRelation}
     */
    public function uplinesFor(int $downlineUserId): array
    {
        $rows = ReferralRelation::query()
            ->where('downline_user_id', $downlineUserId)
            ->whereIn('level', [1, 2])
            ->get()
            ->keyBy('level');

        return [
            1 => $rows->get(1),
            2 => $rows->get(2),
        ];
    }

    protected function wouldCreateCycle(int $newUserId, int $uplineId): bool
    {
        // Walk upline ancestors; if newUser appears, cycle.
        $current = $uplineId;
        $guard = 0;
        while ($guard < 5) {
            if ($current === $newUserId) {
                return true;
            }
            $parent = ReferralRelation::query()
                ->where('downline_user_id', $current)
                ->where('level', 1)
                ->value('upline_user_id');
            if (! $parent) {
                break;
            }
            $current = (int) $parent;
            $guard++;
        }

        return false;
    }
}
