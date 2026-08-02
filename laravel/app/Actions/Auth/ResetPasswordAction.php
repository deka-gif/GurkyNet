<?php

namespace App\Actions\Auth;

use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Validation\ValidationException;

class ResetPasswordAction
{
    protected UserRepositoryInterface $userRepository;
    protected VerifyOtpAction $verifyOtpAction;

    public function __construct(UserRepositoryInterface $userRepository, VerifyOtpAction $verifyOtpAction)
    {
        $this->userRepository = $userRepository;
        $this->verifyOtpAction = $verifyOtpAction;
    }

    public function execute(string $phoneNumber, string $otpCode, string $newPassword): bool
    {
        // First verify the OTP code for password_reset action
        $this->verifyOtpAction->execute($phoneNumber, $otpCode, 'password_reset');

        // Find the user by phone number
        $user = $this->userRepository->findByPhone($phoneNumber);

        if (!$user) {
            throw ValidationException::withMessages([
                'phone_number' => ['Nomor handphone tidak terdaftar di sistem kami.'],
            ]);
        }

        // Update password
        return $this->userRepository->update($user, [
            'password' => $newPassword,
        ]);
    }
}
