<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ChangePinAction
{
    protected UserRepositoryInterface $userRepository;

    public function __construct(UserRepositoryInterface $userRepository)
    {
        $this->userRepository = $userRepository;
    }

    public function execute(User $user, string $newPin, ?string $oldPin = null): bool
    {
        // If they already have a PIN set, they must provide the correct old PIN to change it
        if ($user->transaction_pin !== null) {
            if ($oldPin === null || !Hash::check($oldPin, $user->transaction_pin)) {
                throw ValidationException::withMessages([
                    'old_pin' => ['PIN transaksi lama yang Anda masukkan tidak sesuai.'],
                ]);
            }
        }

        // Validate the PIN is numeric and 6-digits
        if (!preg_match('/^\d{6}$/', $newPin)) {
            throw ValidationException::withMessages([
                'new_pin' => ['PIN transaksi harus berupa 6 digit angka.'],
            ]);
        }

        return $this->userRepository->updatePin($user, $newPin);
    }
}
