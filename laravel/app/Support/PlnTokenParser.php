<?php

namespace App\Support;

/**
 * Extract 20-digit PLN prepaid token from Digiflazz SN / provider payload.
 */
class PlnTokenParser
{
    public static function extract(?string $serialNumber): ?string
    {
        if ($serialNumber === null) {
            return null;
        }

        $raw = trim($serialNumber);
        if ($raw === '') {
            return null;
        }

        // Slash-delimited Digiflazz SN: meter/name/token/kwh/...
        foreach (preg_split('/[\/|]/', $raw) ?: [] as $part) {
            $digits = preg_replace('/\D/', '', $part) ?? '';
            if (strlen($digits) === 20) {
                return $digits;
            }
        }

        $allDigits = preg_replace('/\D/', '', $raw) ?? '';
        if (strlen($allDigits) === 20) {
            return $allDigits;
        }

        if (preg_match('/\d{20}/', $allDigits, $m)) {
            return $m[0];
        }

        return null;
    }

    public static function formatGrouped(?string $token): ?string
    {
        $token = self::extract($token) ?? (preg_replace('/\D/', '', (string) $token) ?: null);
        if (!$token || strlen($token) !== 20) {
            return null;
        }

        return implode(' - ', str_split($token, 4));
    }
}
