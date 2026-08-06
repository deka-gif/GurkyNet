<?php

namespace App\Support;

/**
 * Parse Digiflazz / VIP SN into voucher deliverables (code, URL).
 * Never invents values — only classifies provider SN content.
 */
class VoucherCodeParser
{
    /**
     * @return array{voucher_code:?string,voucher_url:?string,voucher_barcode:?string}
     */
    public static function parse(?string $serialNumber): array
    {
        $sn = trim((string) $serialNumber);
        if ($sn === '') {
            return [
                'voucher_code' => null,
                'voucher_url' => null,
                'voucher_barcode' => null,
            ];
        }

        $url = null;
        if (preg_match('#(https?://[^\s<>"\']+)#i', $sn, $m)) {
            $url = rtrim($m[1], '.,;)');
        }

        $code = $sn;
        if ($url !== null) {
            $remainder = trim(str_ireplace($url, '', $sn), " \t\n\r\0\x0B|/-");
            $code = $remainder !== '' ? $remainder : null;
            // Entire SN is a URL
            if ($code === null && strcasecmp(trim($sn), $url) === 0) {
                return [
                    'voucher_code' => null,
                    'voucher_url' => $url,
                    'voucher_barcode' => null,
                ];
            }
        }

        // Digiflazz sometimes prefixes labels: "PIN:xxxx" / "SN:xxxx"
        if (is_string($code) && preg_match('/^(?:PIN|SN|KODE|CODE|VOUCHER)\s*[:\-]\s*(.+)$/i', $code, $labelMatch)) {
            $code = trim($labelMatch[1]);
        }

        return [
            'voucher_code' => $code !== null && $code !== '' ? $code : null,
            'voucher_url' => $url,
            // Barcode value is provider SN when not a bare URL (UI may render it as barcode text).
            'voucher_barcode' => ($url === null && $code !== null && $code !== '') ? $code : null,
        ];
    }
}
