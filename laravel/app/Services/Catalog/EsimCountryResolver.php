<?php

namespace App\Services\Catalog;

/**
 * eSIM (Digiflazz/VIP) tidak punya brand/operator asli — vendor hanya menempelkan
 * nama negara di dalam nama produk (mis. "eSIM Travel 1 GB 7 Hari (Singapore)"),
 * tidak pernah sebagai kolom terpisah. Resolver ini mengekstrak segmen "(Negara)"
 * di akhir nama produk supaya produk eSIM bisa dikelompokkan/diberi logo per
 * negara, sama seperti kategori lain dikelompokkan per Provider (brand).
 */
class EsimCountryResolver
{
    /**
     * Ejaan vendor yang berantakan → satu label baku, supaya "U.S.A" dan "USA"
     * tidak jadi dua Provider berbeda.
     */
    protected const ALIASES = [
        'usa' => 'USA',
        'united states' => 'USA',
        'uk' => 'UK',
        'united kingdom' => 'UK',
        'uae' => 'UAE',
    ];

    /**
     * Ekstrak segmen "(Negara)" di akhir nama produk eSIM.
     * Return null kalau nama tidak punya akhiran dalam kurung — caller wajib
     * fallback ke brand mentah dari vendor, jangan pernah crash.
     */
    public function extractCountry(string $productName): ?string
    {
        if (! preg_match('/\(([^)]+)\)\s*$/', trim($productName), $m)) {
            return null;
        }

        $raw = trim($m[1]);
        if ($raw === '') {
            return null;
        }

        $key = strtolower(trim(str_replace('.', '', $raw)));

        return self::ALIASES[$key] ?? $raw;
    }
}
