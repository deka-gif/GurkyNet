<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Models\Wallet;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Support\Facades\DB;

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

            return $user;
        });
    }
}
