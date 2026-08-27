<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Models\Wallet;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RegisterUserAction
{
    protected UserRepositoryInterface $userRepository;

    public function __construct(UserRepositoryInterface $userRepository)
    {
        $this->userRepository = $userRepository;
    }

    public function execute(array $data): User
    {
        return DB::transaction(function () use ($data) {
            // Create user
            $user = $this->userRepository->create($data);

            if (!empty($data['transaction_pin'])) {
                $user->forceFill([
                    'transaction_pin' => Hash::make((string) $data['transaction_pin']),
                    'pin_updated_at' => now(),
                    'email_verified_at' => $data['email_verified_at'] ?? now(),
                ])->save();
            } elseif (!empty($data['email_verified_at'])) {
                $user->forceFill([
                    'email_verified_at' => $data['email_verified_at'],
                ])->save();
            }

            // Generate unique wallet number: 1042 + random numbers
            $walletNumber = '1042' . mt_rand(1000000000, 9999999999);

            // Double check uniqueness of wallet number
            while (Wallet::where('wallet_number', $walletNumber)->exists()) {
                $walletNumber = '1042' . mt_rand(1000000000, 9999999999);
            }

            // Create associated wallet
            Wallet::create([
                'user_id' => $user->id,
                'wallet_number' => $walletNumber,
                'balance' => 0.00,
                'status' => 'active',
            ]);

            // FR-REF-01 — unique referral code at registration
            app(\App\Services\Referral\ReferralCodeService::class)->ensureForUser($user);

            // FR-REF-02 — optional referral code relation (immutable)
            $referralCode = $data['referral_code'] ?? null;
            if (is_string($referralCode) && trim($referralCode) !== '') {
                app(\App\Services\Referral\ReferralRelationService::class)->attachAtRegistration(
                    $user,
                    $referralCode,
                    is_array($data['referral_context'] ?? null) ? $data['referral_context'] : []
                );
            }

            // Sprint 18 — persist policy acceptance when requested (server-side, versioned)
            if (! empty($data['accept_policies'])) {
                app(\App\Services\Website\LegalCenterService::class)->ensureDefaults();
                app(\App\Services\Legal\PolicyAcceptanceService::class)->acceptCurrentPublished($user);
            }

            return $user;
        });
    }
}
