<?php

namespace App\Services\Catalog;

use Illuminate\Support\Str;

/**
 * Digiflazz dan VIPayment melaporkan brand voucher/gift-card yang SAMA dengan string
 * mentah yang berbeda (kapitalisasi, awalan "Voucher ", akhiran "Code"/"(IDR)", dst).
 * Kalau dibiarkan, ini membuat baris `providers` (brand) TERPISAH per provider, sehingga
 * halaman Voucher Digital menampilkan tile brand duplikat + daftar nominal duplikat.
 *
 * Meniru pola EwalletBrandResolver: resolve ke SATU nama brand kanonik SEBELUM baris
 * Provider dibuat/dicocokkan, supaya offer Digiflazz dan VIP mendarat di baris `providers`
 * yang sama dan otomatis ter-merge lewat LogicalProductKey / mergeDuplicateCatalogProducts
 * (mekanisme yang sudah ada, tidak diubah oleh class ini).
 *
 * SENGAJA berupa whitelist yang dikurasi (BUKAN fuzzy/generic matcher) — supaya brand yang
 * memang berbeda (misal region/currency berbeda dari toko yang sama) tidak pernah ter-merge
 * tanpa sengaja. Tambahkan entry baru HANYA setelah dikonfirmasi lewat command
 * `gurkynet:diagnose-voucher-digital-brands` bahwa dua string brand mentah itu benar-benar
 * produk komersial yang sama.
 */
class VoucherBrandResolver
{
    /**
     * needle (substring huruf kecil, dicek terhadap string brand/nama produk MENTAH) => nama brand kanonik.
     * Needle yang lebih spesifik/panjang dicek lebih dulu.
     *
     * @var array<string, string>
     */
    protected const BRAND_ALIASES = [
        'voucher razer gold' => 'Razer Gold',
        'razer gold' => 'Razer Gold',
        'steam wallet' => 'Steam Wallet',
        'steam' => 'Steam Wallet',
    ];

    /**
     * Resolve nama brand kanonik untuk string brand Voucher Digital mentah, atau null
     * kalau tidak ada alias yang cocok (caller harus tetap pakai brand asli, jangan menebak).
     */
    public function resolve(string $rawBrand, string $productName = ''): ?string
    {
        $needles = self::BRAND_ALIASES;
        uksort($needles, fn (string $a, string $b) => strlen($b) <=> strlen($a));

        $hayBrand = Str::lower(trim($rawBrand));
        foreach ($needles as $needle => $canonical) {
            if ($hayBrand !== '' && str_contains($hayBrand, $needle)) {
                return $canonical;
            }
        }

        // Fallback: sebagian baris VIP hanya menaruh nama brand di dalam nama produk.
        $hayName = Str::lower(trim($productName));
        foreach ($needles as $needle => $canonical) {
            if ($hayName !== '' && str_contains($hayName, $needle)) {
                return $canonical;
            }
        }

        return null;
    }
}
