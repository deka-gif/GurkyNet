<?php

namespace App\Services\Kyc;

use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * FR-USR07 + FR-KYC-02..04 / SRS Bagian 21 & 28.3 —
 * Withdraw eligibility for future activation. Feature gate remains separate.
 */
class WithdrawEligibilityService
{
    public function __construct(
        protected KycService $kycService,
        protected BankAccountNameMatcher $bankMatcher,
        protected IdentityVerificationGate $tier1
    ) {}

    /**
     * Soft check used by tests and preflight APIs.
     *
     * @return array{eligible: bool, reasons: list<string>, kyc_ok: bool, agent_ok: bool, bank_ok: bool}
     */
    public function evaluate(User $user, ?string $accountHolder = null): array
    {
        $reasons = [];
        $agentOk = strtolower((string) ($user->user_type ?? '')) === 'agent';
        if (! $agentOk) {
            $reasons[] = 'Hanya Agen (user_type=agent) yang dapat withdraw.';
        }

        try {
            $this->tier1->assertTier1($user);
            $tier1Ok = true;
        } catch (ValidationException) {
            $tier1Ok = false;
            $reasons[] = 'KYC Tier 1 belum lengkap.';
        }

        $approved = $this->kycService->approvedTier2($user);
        $kycOk = $approved !== null;
        if (! $kycOk) {
            $reasons[] = 'KYC Tier 2 belum disetujui.';
        }

        $bankOk = false;
        if ($approved) {
            $holder = $accountHolder ?? $approved->bank_account_name;
            $bankOk = $this->bankMatcher->matches($approved->ktp_full_name, (string) $holder);
            if (! $bankOk) {
                $reasons[] = 'Nama rekening tidak cocok dengan nama KTP terverifikasi.';
            }
        }

        return [
            'eligible' => $agentOk && $tier1Ok && $kycOk && $bankOk,
            'reasons' => $reasons,
            'kyc_ok' => $kycOk,
            'agent_ok' => $agentOk,
            'bank_ok' => $bankOk,
        ];
    }

    /**
     * Hard assert used inside WithdrawWalletAction when gate is ON.
     *
     * @throws ValidationException
     */
    public function assertEligible(User $user, ?string $accountHolder = null): void
    {
        $result = $this->evaluate($user, $accountHolder);
        if ($result['eligible']) {
            return;
        }

        throw ValidationException::withMessages([
            'amount' => [$result['reasons'][0] ?? 'Tidak memenuhi syarat withdraw (KYC/Agen).'],
        ]);
    }
}
