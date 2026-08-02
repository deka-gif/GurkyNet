<?php

namespace App\Actions\Auth;

use App\Repositories\Contracts\OtpRepositoryInterface;
use Illuminate\Validation\ValidationException;

class VerifyOtpAction
{
    protected OtpRepositoryInterface $otpRepository;

    public function __construct(OtpRepositoryInterface $otpRepository)
    {
        $this->otpRepository = $otpRepository;
    }

    public function execute(string $phoneNumber, string $code, string $action): bool
    {
        $otp = $this->otpRepository->findLatestActive($phoneNumber, $code, $action);

        if (!$otp) {
            throw ValidationException::withMessages([
                'otp' => ['Kode OTP tidak valid atau sudah kedaluwarsa.'],
            ]);
        }

        return $this->otpRepository->markAsUsed($otp);
    }
}
