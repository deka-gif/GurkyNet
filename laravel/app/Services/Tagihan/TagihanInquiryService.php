<?php

namespace App\Services\Tagihan;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\User;
use App\Services\AvailabilityService;
use App\Services\DigiflazzService;
use App\Services\ProductProviders\DigiflazzResponseCodeClassifier;
use App\Services\ProductProviders\ProductProviderSelectionService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Real Digiflazz postpaid inquiry (inq-pasca) with short-lived session for pay-pasca.
 *
 * Status is the primary success/failure indicator; Digiflazz RC classifies the outcome
 * when present (DigiflazzResponseCodeClassifier).
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

        // Soft-retry once on provider/network flakes (inquiry never debits wallet).
        // Evidence 2026-09-12 OVO: Digi RC 02 "Transaksi Gagal" then success on next attempt.
        [$data, $refId] = $this->runInquiryPascaWithOptionalRetry(
            $providerSku,
            $customerNo,
            $year,
            $amount
        );

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
     * Call Digiflazz inq-pasca; soft-retry once when RC is provider/network flake (not validation).
     * Inquiry never debits — retry is safe and uses a fresh ref_id (no double-charge risk).
     *
     * @return array{0: array<string, mixed>, 1: string} [data, ref_id]
     */
    protected function runInquiryPascaWithOptionalRetry(
        string $providerSku,
        string $customerNo,
        ?int $year,
        ?int $amount
    ): array {
        $attempt = 0;
        $maxAttempts = 2;
        $lastData = null;
        $lastClassifier = null;

        while ($attempt < $maxAttempts) {
            $attempt++;
            $refId = 'GNQ'.Str::upper(Str::random(18));

            try {
                $response = $this->digiflazz->inquiryPasca($providerSku, $customerNo, $refId, $year, $amount);
            } catch (\Throwable $e) {
                if ($attempt < $maxAttempts) {
                    Log::warning('Digiflazz tagihan inquiry transport error — soft-retry', [
                        'sku' => $providerSku,
                        'customer_no' => $customerNo,
                        'attempt' => $attempt,
                        'error' => $e->getMessage(),
                    ]);
                    usleep(400_000);

                    continue;
                }

                throw ValidationException::withMessages([
                    'inquiry' => ['Gagal menghubungi provider. Silakan coba lagi.'],
                ]);
            }

            $data = $response['data'] ?? null;
            if (! is_array($data)) {
                throw ValidationException::withMessages([
                    'inquiry' => ['Respons inquiry provider tidak valid.'],
                ]);
            }

            $status = strtolower(trim((string) ($data['status'] ?? '')));
            $rc = DigiflazzResponseCodeClassifier::normalize($data['rc'] ?? null);
            $classifier = $rc !== null
                ? DigiflazzResponseCodeClassifier::classify($rc)
                : null;

            Log::info('Digiflazz tagihan inquiry classified', array_merge(
                [
                    'sku' => $providerSku,
                    'customer_no' => $customerNo,
                    'ref_id' => $refId,
                    'attempt' => $attempt,
                    'status' => $status !== '' ? $status : null,
                ],
                $classifier?->toLogContext() ?? [
                    'rc' => null,
                    'category' => null,
                ]
            ));

            if (in_array($status, ['sukses', 'success'], true)) {
                return [$data, $refId];
            }

            $lastData = $data;
            $lastClassifier = $classifier;

            if ($attempt < $maxAttempts && $this->shouldSoftRetryInquiry($classifier)) {
                Log::info('Digiflazz tagihan inquiry soft-retry scheduled', [
                    'sku' => $providerSku,
                    'customer_no' => $customerNo,
                    'ref_id' => $refId,
                    'rc' => $classifier?->code,
                    'category' => $classifier?->category,
                ]);
                usleep(400_000);

                continue;
            }

            break;
        }

        throw ValidationException::withMessages([
            'inquiry' => [$this->resolveFailureUserMessage(
                is_array($lastData) ? $lastData : [],
                $lastClassifier
            )],
        ]);
    }

    /**
     * Soft-retry only for provider/network flakes — never for invalid-number validation RCs.
     */
    protected function shouldSoftRetryInquiry(?DigiflazzResponseCodeClassifier $classifier): bool
    {
        if ($classifier === null) {
            return true;
        }

        if ($classifier->isValidationFailure() || $classifier->isAuthenticationFailure()) {
            return false;
        }

        if ($classifier->isProviderFailure() || $classifier->isRetryable() || $classifier->category === DigiflazzResponseCodeClassifier::NETWORK) {
            return true;
        }

        return false;
    }

    /**
     * User-facing failure message: prefer Digiflazz `message`, then RC Message column, then raw rc / default.
     * Provider RC 02 "Transaksi Gagal" on inquiry is remapped to retry guidance (not a charged failure).
     *
     * @param  array<string, mixed>  $data
     */
    protected function resolveFailureUserMessage(array $data, ?DigiflazzResponseCodeClassifier $classifier): string
    {
        // Inquiry is never a wallet debit — generic Digi "Transaksi Gagal" (RC 02) misleads as final.
        if ($classifier !== null
            && ! $classifier->isValidationFailure()
            && ($classifier->isProviderFailure() || $classifier->isRetryable() || $classifier->category === DigiflazzResponseCodeClassifier::NETWORK)
        ) {
            $digiMsg = strtolower(trim((string) ($data['message'] ?? '')));
            if ($digiMsg === '' || $digiMsg === 'transaksi gagal' || $classifier->code === '02') {
                return 'Provider sementara gagal memverifikasi nomor. Silakan coba lagi.';
            }
        }

        $message = trim((string) ($data['message'] ?? ''));
        if ($message !== '') {
            return $message;
        }

        if ($classifier !== null) {
            $description = trim($classifier->description());
            if ($description !== '' && ! $classifier->isUnknown()) {
                return $description;
            }
        }

        $rcRaw = trim((string) ($data['rc'] ?? ''));
        if ($rcRaw !== '') {
            return 'Inquiry gagal (RC '.$rcRaw.').';
        }

        return 'Inquiry gagal. Silakan coba lagi.';
    }

    /**
     * Digiflazz E-Money inquiry (inq-pasca + amount).
     * GurkyNet E-Wallet uses Pascabayar / Bebas Nominal only — face amount comes from the client.
     *
     * @return array<string, mixed>
     */
    public function inquireEwallet(User $user, string $skuCode, string $customerNo, int $amount): array
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

        $brandResolver = app(\App\Services\Catalog\EwalletBrandResolver::class);
        if (! $brandResolver->isOpenAmountProduct($product)) {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk E-Wallet harus Bebas Nominal / Pascabayar.'],
            ]);
        }
        if ($brandResolver->isCekNamaProduct($product)) {
            throw ValidationException::withMessages([
                'sku_code' => ['Produk Cek Nama tidak dapat digunakan untuk top up.'],
            ]);
        }

        $limits = $brandResolver->openAmountLimitsForProduct($product);
        if ($limits === null) {
            throw ValidationException::withMessages([
                'amount' => ['Batas nominal untuk brand ini belum dikonfigurasi.'],
            ]);
        }

        if ($amount < $limits['min_amount'] || $amount > $limits['max_amount']) {
            throw ValidationException::withMessages([
                'amount' => [sprintf(
                    'Nominal harus antara Rp%s — Rp%s.',
                    number_format($limits['min_amount'], 0, ',', '.'),
                    number_format($limits['max_amount'], 0, ',', '.')
                )],
            ]);
        }

        // Digiflazz E-Money RC 87 — face amount must be a multiple of Rp1.000.
        if ($amount % 1000 !== 0) {
            throw ValidationException::withMessages([
                'amount' => ['Nominal harus kelipatan Rp1.000'],
            ]);
        }

        return $this->inquire($user, $skuCode, $customerNo, null, $amount);
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

        // Jangan fallback ke internal SKU (mis. VIP-DANA80) — bukan buyer_sku_code Digiflazz.
        return null;
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

        // E-Wallet (amount set): Digi may return Sukses/rc=00 with empty customer_name (GoPay
        // production 2026-09-12). Empty name must NOT block — only Digi status/rc failure does.
        // Regular tagihan still requires a name for bill identity verification.
        $customerName = trim((string) ($data['customer_name'] ?? ''));
        $isEwalletInquiry = $requestedAmount !== null && $requestedAmount > 0;
        if ($customerName === '' && ! $isEwalletInquiry) {
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
            // Digiflazz Bayar Tagihan: payment allowed only on the same calendar day as inquiry.
            'inquired_at' => now()->toIso8601String(),
            'raw' => $data,
        ];
    }

    /**
     * Digiflazz rule: bill payment must occur on the same local calendar day as inquiry.
     * Additional to session TTL — does not replace CACHE_TTL_MINUTES.
     *
     * @param  array<string, mixed>  $session
     */
    public function assertSameDayAsInquiry(array $session): void
    {
        $raw = $session['inquired_at'] ?? null;
        if (! is_string($raw) || trim($raw) === '') {
            throw ValidationException::withMessages([
                'inquiry_ref_id' => ['Sesi inquiry tidak memiliki waktu pengecekan. Silakan cek tagihan ulang.'],
            ]);
        }

        try {
            $inquiryDate = \Illuminate\Support\Carbon::parse($raw)
                ->timezone(config('app.timezone'))
                ->toDateString();
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'inquiry_ref_id' => ['Waktu inquiry tidak valid. Silakan cek tagihan ulang.'],
            ]);
        }

        $today = now()->timezone(config('app.timezone'))->toDateString();
        if ($inquiryDate !== $today) {
            throw ValidationException::withMessages([
                'inquiry_ref_id' => [
                    'Pembayaran tagihan hanya dapat dilakukan pada tanggal yang sama dengan tanggal pengecekan tagihan. Silakan cek tagihan ulang.',
                ],
            ]);
        }
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
