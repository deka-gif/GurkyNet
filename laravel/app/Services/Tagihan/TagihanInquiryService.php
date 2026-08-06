<?php

namespace App\Services\Tagihan;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\User;
use App\Services\AvailabilityService;
use App\Services\DigiflazzService;
use App\Services\ProductProviders\ProductProviderSelectionService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Real Digiflazz postpaid inquiry (inq-pasca) with short-lived session for pay-pasca.
 */
class TagihanInquiryService
{
    public const CACHE_TTL_MINUTES = 15;

    public function __construct(
        protected DigiflazzService $digiflazz,
        protected ProductProviderSelectionService $selection,
        protected AvailabilityService $availability,
    ) {}

    /**
     * Inquire bill from Digiflazz. Does not debit wallet.
     *
     * @return array<string, mixed>
     */
    public function inquire(
        User $user,
        string $skuCode,
        string $customerNo,
        ?int $year = null,
        ?int $amount = null
    ): array {
        if (!$this->digiflazz->isConfigured()) {
            throw ValidationException::withMessages([
                'provider' => ['Layanan inquiry provider belum dikonfigurasi.'],
            ]);
        }

        $customerNo = trim($customerNo);
        if ($customerNo === '') {
            throw ValidationException::withMessages([
                'customer_no' => ['Nomor / ID pelanggan wajib diisi.'],
            ]);
        }

        $product = $this->selection->findProductByInternalSku($skuCode);
        if (!$product) {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk tidak ditemukan.'],
            ]);
        }
        $product->loadMissing(['provider', 'category']);

        if (!$this->availability->isAvailable($product)) {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk sedang tidak tersedia.'],
            ]);
        }

        $providerSku = $this->resolveDigiflazzSku($product);
        if ($providerSku === null || $providerSku === '') {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk belum terhubung ke Digiflazz.'],
            ]);
        }

        $refId = 'GNQ' . Str::upper(Str::random(18));

        try {
            $response = $this->digiflazz->inquiryPasca($providerSku, $customerNo, $refId, $year, $amount);
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'inquiry' => ['Gagal menghubungi provider. Silakan coba lagi.'],
            ]);
        }

        $data = $response['data'] ?? null;
        if (!is_array($data)) {
            throw ValidationException::withMessages([
                'inquiry' => ['Respons inquiry provider tidak valid.'],
            ]);
        }

        $status = strtolower((string) ($data['status'] ?? ''));
        if (!in_array($status, ['sukses', 'success'], true)) {
            $message = trim((string) ($data['message'] ?? $data['rc'] ?? 'Inquiry gagal.'));
            throw ValidationException::withMessages([
                'inquiry' => [$message !== '' ? $message : 'Inquiry gagal.'],
            ]);
        }

        $normalized = $this->normalizeInquiryData(
            $data,
            $product,
            $providerSku,
            $customerNo,
            $refId,
            $amount
        );

        if ($normalized['selling_price'] <= 0) {
            throw ValidationException::withMessages([
                'inquiry' => ['Nominal dari provider tidak valid.'],
            ]);
        }

        if ($amount !== null && $amount > 0) {
            $normalized['is_ewallet'] = true;
            $normalized['nominal_amount'] = (float) $amount;
        }

        $this->storeSession($user->id, $normalized);

        return [
            'inquiry_ref_id' => $normalized['inquiry_ref_id'],
            'sku_code' => $normalized['sku_code'],
            'product_name' => $normalized['product_name'],
            'provider_name' => $normalized['provider_name'],
            'customer_no' => $normalized['customer_no'],
            'customer_name' => $normalized['customer_name'],
            'periode' => $normalized['periode_label'] ?: $normalized['periode'],
            'lembar_tagihan' => $normalized['lembar_tagihan'],
            'bill_amount' => $normalized['bill_amount'],
            'nominal_amount' => $normalized['nominal_amount'] ?? $normalized['bill_amount'],
            'admin_fee' => $normalized['admin_fee'],
            'denda' => $normalized['denda'],
            'selling_price' => $normalized['selling_price'],
            'tax_details' => $normalized['tax_details'],
            'is_ewallet' => !empty($normalized['is_ewallet']),
            'expires_in_seconds' => self::CACHE_TTL_MINUTES * 60,
        ];
    }

    /**
     * Digiflazz E-Money inquiry (inq-pasca + amount). Denomination resolved server-side from product.
     *
     * @return array<string, mixed>
     */
    public function inquireEwallet(User $user, string $skuCode, string $customerNo): array
    {
        $customerNo = preg_replace('/\D/', '', $customerNo) ?? '';
        if (strlen($customerNo) < 10 || strlen($customerNo) > 15) {
            throw ValidationException::withMessages([
                'customer_no' => ['Nomor HP e-wallet harus 10–15 digit.'],
            ]);
        }

        $product = $this->selection->findProductByInternalSku($skuCode);
        if (!$product) {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk tidak ditemukan.'],
            ]);
        }

        $amount = $this->resolveEwalletDenomination($product);
        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'sku_code' => ['Denominasi produk tidak valid.'],
            ]);
        }

        return $this->inquire($user, $skuCode, $customerNo, null, $amount);
    }

    protected function resolveEwalletDenomination(Product $product): int
    {
        $base = (int) round((float) $product->base_price);
        if ($base > 0) {
            return $base;
        }

        $sell = (int) round((float) $product->sell_price);
        if ($sell > 0) {
            return $sell;
        }

        if (preg_match('/(\d{1,3}(?:[.\s]?\d{3})+|\d+)\s*(ribu|rb|k)?/iu', (string) $product->name, $m)) {
            $n = (int) preg_replace('/\D/', '', $m[1]);
            $suffix = strtolower((string) ($m[2] ?? ''));
            if (in_array($suffix, ['ribu', 'rb', 'k'], true) && $n < 1000) {
                $n *= 1000;
            }

            return $n;
        }

        return 0;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getSession(int $userId, string $inquiryRefId): ?array
    {
        $payload = Cache::get($this->cacheKey($userId, $inquiryRefId));

        return is_array($payload) ? $payload : null;
    }

    public function forgetSession(int $userId, string $inquiryRefId): void
    {
        Cache::forget($this->cacheKey($userId, $inquiryRefId));
    }

    protected function cacheKey(int $userId, string $inquiryRefId): string
    {
        return "tagihan_inquiry:{$userId}:{$inquiryRefId}";
    }

    /**
     * @param  array<string, mixed>  $session
     */
    protected function storeSession(int $userId, array $session): void
    {
        Cache::put(
            $this->cacheKey($userId, $session['inquiry_ref_id']),
            $session,
            now()->addMinutes(self::CACHE_TTL_MINUTES)
        );
    }

    protected function resolveDigiflazzSku(Product $product): ?string
    {
        $candidates = $this->selection->candidatesForProduct($product);
        foreach ($candidates as $offer) {
            if ($offer->productProvider?->code === ProductProvider::CODE_DIGIFLAZZ) {
                $sku = trim((string) $offer->provider_sku);

                return $sku !== '' ? $sku : null;
            }
        }

        $fallback = trim((string) $product->sku_code);

        return $fallback !== '' ? $fallback : null;
    }

    /**
     * Map Digiflazz inquiry payload — values come only from provider response.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function normalizeInquiryData(
        array $data,
        Product $product,
        string $providerSku,
        string $customerNo,
        string $refId,
        ?int $requestedAmount = null
    ): array {
        $admin = (float) ($data['admin'] ?? 0);
        $sellingPrice = (float) ($data['selling_price'] ?? 0);
        $providerPrice = (float) ($data['price'] ?? 0);

        $billFromDetail = 0.0;
        $periods = [];
        $desc = $data['desc'] ?? null;
        $detail = is_array($desc) ? ($desc['detail'] ?? null) : null;
        if (is_array($detail)) {
            foreach ($detail as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $billFromDetail += (float) ($row['nilai_tagihan'] ?? 0);
                if (!empty($row['periode'])) {
                    $periods[] = (string) $row['periode'];
                }
            }
        }

        $descArr = is_array($desc) ? $desc : [];
        $denda = $this->extractDenda($data, $descArr, $detail);

        // E-Money: Digiflazz amount = face denomination (Nominal); selling_price = Harga.
        if ($requestedAmount !== null && $requestedAmount > 0) {
            $billAmount = (float) $requestedAmount;
        } else {
            $billAmount = $billFromDetail > 0
                ? $billFromDetail
                : max(0.0, $sellingPrice - $admin - $denda);
            if ($billAmount <= 0 && $sellingPrice > 0) {
                $billAmount = max(0.0, $sellingPrice - $admin);
            }
        }

        $lembarRaw = $descArr['lembar_tagihan'] ?? ($data['lembar_tagihan'] ?? null);
        $lembar = (int) ($lembarRaw !== null && $lembarRaw !== '' ? $lembarRaw : count($periods));

        $periodeRaw = (string) ($data['periode'] ?? '');
        if ($periodeRaw === '' && $periods !== []) {
            $periodeRaw = implode(', ', array_unique($periods));
        }

        $customerName = trim((string) ($data['customer_name'] ?? ''));
        if ($customerName === '') {
            throw ValidationException::withMessages([
                'inquiry' => ['Nama pelanggan tidak tersedia dari provider.'],
            ]);
        }

        $taxDetails = $this->extractTaxDetails($data, $descArr, $customerNo);

        return [
            'inquiry_ref_id' => (string) ($data['ref_id'] ?? $refId),
            'sku_code' => $product->sku_code,
            'provider_sku' => (string) ($data['buyer_sku_code'] ?? $providerSku),
            'product_name' => $product->name,
            'provider_name' => $product->provider?->name ?? '',
            'category_slug' => (string) ($product->category?->slug ?? ''),
            'customer_no' => (string) ($data['customer_no'] ?? $customerNo),
            'customer_name' => $customerName,
            'periode' => $periodeRaw,
            'periode_label' => $this->formatPeriodeLabel($periodeRaw, $lembar),
            'lembar_tagihan' => $lembar,
            'bill_amount' => round($billAmount, 2),
            'admin_fee' => round($admin, 2),
            'denda' => round($denda, 2),
            'selling_price' => round($sellingPrice, 2),
            'provider_price' => round($providerPrice, 2),
            'tax_details' => $taxDetails,
            'raw' => $data,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $desc
     * @param  mixed  $detail
     */
    protected function extractDenda(array $data, array $desc, mixed $detail): float
    {
        $denda = (float) ($desc['denda'] ?? $data['denda'] ?? 0);
        if ($denda > 0) {
            return $denda;
        }

        $sum = 0.0;
        foreach (['biaya_denda_swd', 'biaya_denda_bbn', 'biaya_denda_pkb'] as $key) {
            $sum += (float) ($desc[$key] ?? 0);
        }
        if ($sum > 0) {
            return $sum;
        }

        if (is_array($detail)) {
            foreach ($detail as $row) {
                if (is_array($row)) {
                    $sum += (float) ($row['denda'] ?? 0);
                }
            }
        }

        return $sum;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $desc
     * @return array<string, string>
     */
    protected function extractTaxDetails(array $data, array $desc, string $customerNo): array
    {
        $pick = static function (array $sources, string $key): string {
            foreach ($sources as $src) {
                if (!is_array($src)) {
                    continue;
                }
                $val = trim((string) ($src[$key] ?? ''));
                if ($val !== '') {
                    return $val;
                }
            }

            return '';
        };

        $merek = $pick([$desc, $data], 'merek_kb');
        $model = $pick([$desc, $data], 'model_kb');
        $vehicle = trim($merek . ($merek && $model ? ' ' : '') . $model);

        $nop = $pick([$desc, $data], 'nop');
        if ($nop === '' && !str_contains($customerNo, ',')) {
            $nop = $customerNo;
        }

        $details = [
            'tahun_pajak' => $pick([$desc, $data], 'tahun_pajak') ?: (string) ($data['periode'] ?? ''),
            'alamat' => $pick([$desc, $data], 'alamat'),
            'kelurahan' => $pick([$desc, $data], 'kelurahan'),
            'kecamatan' => $pick([$desc, $data], 'kecamatan'),
            'kab_kota' => $pick([$desc, $data], 'kab_kota'),
            'nop' => $nop,
            'nomor_polisi' => $pick([$desc, $data], 'nomor_polisi'),
            'nomor_rangka' => $pick([$desc, $data], 'nomor_rangka'),
            'nomor_mesin' => $pick([$desc, $data], 'nomor_mesin'),
            'nomor_identitas' => $pick([$desc, $data], 'nomor_identitas'),
            'merek_kb' => $merek,
            'model_kb' => $model,
            'vehicle_label' => $vehicle,
            'tahun_buatan' => $pick([$desc, $data], 'tahun_buatan'),
            'warna' => $pick([$desc, $data], 'warna'),
            'tahun_warna' => '',
            'luas_tanah' => $pick([$desc, $data], 'luas_tanah'),
            'luas_gedung' => $pick([$desc, $data], 'luas_gedung'),
            'tgl_akhir_pajak_baru' => $pick([$desc, $data], 'tgl_akhir_pajak_baru'),
            'ntpn' => $pick([$desc, $data], 'ntpn'),
            'nomor_pengesahan' => $pick([$desc, $data], 'nomor_pengesahan'),
        ];

        $tahun = $details['tahun_buatan'];
        $warna = $details['warna'];
        if ($tahun !== '' || $warna !== '') {
            $details['tahun_warna'] = trim($tahun . ($tahun && $warna ? ' / ' : '') . $warna);
        }

        return array_filter($details, static fn ($v) => is_string($v) && $v !== '');
    }

    protected function formatPeriodeLabel(string $periode, int $lembar): string
    {
        $periode = trim($periode);
        if ($periode === '') {
            return $lembar > 0 ? "{$lembar} Bulan" : '-';
        }

        $parts = preg_split('/\s*,\s*/', $periode) ?: [$periode];
        $labels = [];
        foreach ($parts as $part) {
            $labels[] = $this->formatSinglePeriode(trim($part));
        }
        $joined = implode(', ', array_filter($labels));
        if ($lembar > 0) {
            return $joined . " ({$lembar} Bulan)";
        }

        return $joined !== '' ? $joined : '-';
    }

    protected function formatSinglePeriode(string $value): string
    {
        if (preg_match('/^(\d{4})(\d{2})$/', $value, $m)) {
            $months = [
                1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
                5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
                9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
            ];
            $month = (int) $m[2];
            $name = $months[$month] ?? $m[2];

            return "{$name} {$m[1]}";
        }

        return $value;
    }
}
