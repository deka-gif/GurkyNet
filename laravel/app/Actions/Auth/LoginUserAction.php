<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUserAction
{
    protected UserRepositoryInterface $userRepository;

    public function __construct(UserRepositoryInterface $userRepository)
    {
        $this->userRepository = $userRepository;
    }

    public function execute(string $phoneOrEmail, string $password, string $deviceIdentifier = 'default'): array
    {
        // Try finding user by email or phone number
        $user = filter_var($phoneOrEmail, FILTER_VALIDATE_EMAIL)
            ? $this->userRepository->findByEmail($phoneOrEmail)
            : $this->userRepository->findByPhone($phoneOrEmail);

        if (!$user || !Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'credentials' => ['Email/Nomor Handphone atau kata sandi Anda salah.'],
            ]);
        }

        // Generate sanctum token
        $token = $user->createToken($deviceIdentifier)->plainTextToken;

        return [
            'user' => $user->load('wallet'),
            'token' => $token,
        ];
    }
}
