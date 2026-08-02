<?php

namespace App\Repositories\Contracts;

use App\Models\OtpCode;

interface OtpRepositoryInterface
{
    public function create(string $phoneNumber, string $code, string $action, int $expiryMinutes = 5): OtpCode;
    public function findLatestActive(string $phoneNumber, string $code, string $action): ?OtpCode;
    public function markAsUsed(OtpCode $otp): bool;
}
