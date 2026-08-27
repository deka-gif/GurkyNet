<?php

namespace App\Services\Kyc;

/**
 * FR-KYC-03 / SRS Bagian 21 — rekening withdraw harus atas nama sama dengan KTP.
 * Local string comparison only (no external bank verification API).
 */
class BankAccountNameMatcher
{
    public function normalize(string $name): string
    {
        $name = mb_strtolower(trim($name), 'UTF-8');
        $name = preg_replace('/\s+/u', ' ', $name) ?? $name;

        return $name;
    }

    public function matches(string $ktpFullName, string $bankAccountName): bool
    {
        if ($ktpFullName === '' || $bankAccountName === '') {
            return false;
        }

        return $this->normalize($ktpFullName) === $this->normalize($bankAccountName);
    }
}
