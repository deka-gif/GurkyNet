<?php

namespace App\Services\ProductProviders;

/**
 * Official Digiflazz Response Code (RC) catalog and classifier.
 *
 * All Digiflazz transaction / health decisions that depend on RC must use this class.
 * Do not classify Digiflazz outcomes by message substring when an RC is present.
 *
 * @see Response Code — Dokumentasi Teknis Digiflazz
 */
final class DigiflazzResponseCodeClassifier
{
    public const SUCCESS = 'SUCCESS';

    public const PENDING = 'PENDING';

    public const AUTHENTICATION = 'AUTHENTICATION';

    public const VALIDATION = 'VALIDATION';

    public const BUSINESS = 'BUSINESS';

    public const PROVIDER = 'PROVIDER';

    public const NETWORK = 'NETWORK';

    public const REFUND = 'REFUND';

    public const RATE_LIMIT = 'RATE_LIMIT';

    public const UNKNOWN = 'UNKNOWN';

    public function __construct(
        public readonly string $code,
        public readonly string $message,
        public readonly string $category,
        public readonly bool $transactionCreated,
        public readonly bool $shouldRetry,
        public readonly bool $shouldRefund,
        public readonly bool $permanentFailure,
        public readonly bool $authenticationFailure,
        public readonly bool $validationFailure,
        public readonly bool $providerFailure,
        public readonly bool $rateLimit,
        public readonly bool $deprecated = false,
        /** Official PDF Status: Sukses | Pending | Gagal */
        public readonly string $digiflazzStatus = 'Gagal',
        /** Official PDF Deskripsi (empty when PDF shows "-") */
        public readonly string $deskripsi = '',
    ) {}

    /**
     * Classify a Digiflazz RC. Unknown codes never throw.
     */
    public static function classify(mixed $rc): self
    {
        $code = self::normalize($rc);
        if ($code === null) {
            return self::unknown('null');
        }

        $catalog = self::catalog();
        if (! isset($catalog[$code])) {
            return self::unknown($code);
        }

        $row = $catalog[$code];

        return new self(
            code: $code,
            message: $row['message'],
            category: $row['category'],
            transactionCreated: $row['transaction_created'],
            shouldRetry: $row['should_retry'],
            shouldRefund: $row['should_refund'],
            permanentFailure: $row['permanent_failure'],
            authenticationFailure: $row['authentication_failure'],
            validationFailure: $row['validation_failure'],
            providerFailure: $row['provider_failure'],
            rateLimit: $row['rate_limit'],
            deprecated: $row['deprecated'] ?? false,
            digiflazzStatus: $row['status'] ?? self::digiflazzStatusForCategory($row['category']),
            deskripsi: $row['deskripsi'] ?? '',
        );
    }

    /**
     * Classify from Digiflazz response `data` payload (prefers data.rc).
     *
     * @param  array<string, mixed>  $data
     */
    public static function fromResponseData(array $data): self
    {
        return self::classify($data['rc'] ?? null);
    }

    /**
     * Classify from a full Digiflazz JSON body or already-unwrapped data.
     *
     * @param  array<string, mixed>  $response
     */
    public static function fromResponse(array $response): self
    {
        if (isset($response['data']) && is_array($response['data'])) {
            return self::fromResponseData($response['data']);
        }

        return self::fromResponseData($response);
    }

    public static function normalize(mixed $rc): ?string
    {
        if ($rc === null || $rc === '') {
            return null;
        }

        if (is_int($rc) || is_float($rc)) {
            $n = (int) $rc;

            // Digiflazz official RCs are two-digit (00–99).
            return ($n >= 0 && $n <= 99)
                ? str_pad((string) $n, 2, '0', STR_PAD_LEFT)
                : (string) $n;
        }

        $raw = trim((string) $rc);
        if ($raw === '') {
            return null;
        }

        if (preg_match('/\d+/', $raw, $m)) {
            $n = (int) $m[0];

            return ($n >= 0 && $n <= 99)
                ? str_pad((string) $n, 2, '0', STR_PAD_LEFT)
                : (string) $n;
        }

        return null;
    }

    public function isSuccess(): bool
    {
        return $this->category === self::SUCCESS;
    }

    public function isPending(): bool
    {
        return $this->category === self::PENDING;
    }

    public function isRetryable(): bool
    {
        return $this->shouldRetry;
    }

    public function isRefundable(): bool
    {
        return $this->shouldRefund;
    }

    public function isAuthenticationFailure(): bool
    {
        return $this->authenticationFailure;
    }

    public function isValidationFailure(): bool
    {
        return $this->validationFailure;
    }

    public function isProviderFailure(): bool
    {
        return $this->providerFailure;
    }

    public function isRateLimited(): bool
    {
        return $this->rateLimit;
    }

    public function transactionCreated(): bool
    {
        return $this->transactionCreated;
    }

    /**
     * Official PDF Message column (same as {@see $message}).
     */
    public function description(): string
    {
        return $this->message;
    }

    /**
     * Official PDF Status column: Sukses | Pending | Gagal.
     */
    public function officialStatus(): string
    {
        return $this->digiflazzStatus;
    }

    /**
     * Official PDF Deskripsi column (empty when PDF has "-").
     */
    public function deskripsi(): string
    {
        return $this->deskripsi;
    }

    public function isUnknown(): bool
    {
        return $this->category === self::UNKNOWN;
    }

    public function isDeprecated(): bool
    {
        return $this->deprecated;
    }

    /**
     * Official PDF columns only (RC, Message, Status, Terbentuk Transaksi, Deskripsi).
     *
     * @return array{rc:string, message:string, status:string, transaction_created:bool, deskripsi:string}
     */
    public function toOfficialMetadata(): array
    {
        return [
            'rc' => $this->code,
            'message' => $this->message,
            'status' => $this->digiflazzStatus,
            'transaction_created' => $this->transactionCreated,
            'deskripsi' => $this->deskripsi,
        ];
    }

    /**
     * Whether Digiflazz fulfillment may failover to another product provider.
     * Validation / refund / permanent customer-facing failures must not failover.
     */
    public function allowsFailover(): bool
    {
        if ($this->isSuccess() || $this->isPending()) {
            return false;
        }

        if ($this->isValidationFailure()) {
            return false;
        }

        if ($this->category === self::REFUND) {
            return false;
        }

        if ($this->isAuthenticationFailure()) {
            // Digiflazz credential/IP issues — secondary provider may still succeed.
            return true;
        }

        if ($this->isRateLimited() || $this->isProviderFailure() || $this->category === self::NETWORK) {
            return true;
        }

        if ($this->category === self::BUSINESS && $this->code === '44') {
            // Digiflazz deposit empty — try secondary provider.
            return true;
        }

        return $this->isRetryable() && ! $this->permanentFailure;
    }

    /**
     * Reason key for ProviderFulfillmentResult / ProviderFailoverPolicy.
     */
    public function fulfillmentReason(): string
    {
        if ($this->isSuccess()) {
            return 'ok';
        }

        if ($this->isPending()) {
            return 'pending';
        }

        if ($this->isAuthenticationFailure()) {
            return 'authentication_failure';
        }

        if ($this->isValidationFailure()) {
            return 'customer_validation';
        }

        if ($this->category === self::REFUND) {
            return 'digiflazz_refund';
        }

        if ($this->isRateLimited()) {
            return 'rate_limited';
        }

        if ($this->code === '01' || $this->code === '70') {
            return 'timeout';
        }

        if ($this->code === '44') {
            return 'insufficient_balance';
        }

        if (in_array($this->code, ['53', '55', '58', '62', '66', '68', '71'], true)) {
            return 'provider_maintenance';
        }

        if ($this->isProviderFailure() || $this->category === self::NETWORK) {
            return 'provider_error';
        }

        if ($this->category === self::BUSINESS) {
            return 'provider_rejected';
        }

        return 'provider_rejected';
    }

    /**
     * Map RC to GurkyNet Digiflazz health probe api_status (cek-saldo path).
     */
    public function healthStatus(): ?string
    {
        return match ($this->code) {
            '40' => ProviderHealthStatus::CONFIG_ERROR,
            '41', '42' => ProviderHealthStatus::AUTH_FAILED,
            '45' => ProviderHealthStatus::NETWORK_CONFIGURATION,
            default => $this->isAuthenticationFailure() ? ProviderHealthStatus::AUTH_FAILED : null,
        };
    }

    /**
     * @return array<string, mixed>
     */
    public function toLogContext(): array
    {
        return array_merge($this->toOfficialMetadata(), [
            'category' => $this->category,
            'retry' => $this->shouldRetry,
            'refund' => $this->shouldRefund,
            'permanent_failure' => $this->permanentFailure,
            'deprecated' => $this->deprecated,
        ]);
    }

    protected static function unknown(string $code): self
    {
        return new self(
            code: $code,
            message: 'Unknown Digiflazz response code',
            category: self::UNKNOWN,
            transactionCreated: false,
            shouldRetry: false,
            shouldRefund: false,
            permanentFailure: true,
            authenticationFailure: false,
            validationFailure: false,
            providerFailure: false,
            rateLimit: false,
            deprecated: false,
            digiflazzStatus: 'Gagal',
            deskripsi: '',
        );
    }

    /**
     * Map GurkyNet category extras → official PDF Status values.
     */
    protected static function digiflazzStatusForCategory(string $category): string
    {
        return match ($category) {
            self::SUCCESS => 'Sukses',
            self::PENDING => 'Pending',
            default => 'Gagal',
        };
    }

    /**
     * Official Digiflazz RC catalog (Response Code.pdf).
     *
     * @return array<string, array{
     *   message:string,
     *   status:string,
     *   deskripsi:string,
     *   category:string,
     *   transaction_created:bool,
     *   should_retry:bool,
     *   should_refund:bool,
     *   permanent_failure:bool,
     *   authentication_failure:bool,
     *   validation_failure:bool,
     *   provider_failure:bool,
     *   rate_limit:bool,
     *   deprecated?:bool
     * }>
     */
    public static function catalog(): array
    {
        return [
            '00' => self::row('Transaksi Sukses', self::SUCCESS, true, false, false, false, false, false, false, false),
            '01' => self::row('Timeout', self::NETWORK, true, true, true, false, false, false, true, false),
            '02' => self::row('Transaksi Gagal', self::PROVIDER, true, false, true, true, false, false, true, false),
            '03' => self::row('Transaksi Pending', self::PENDING, true, true, false, false, false, false, false, false),

            '40' => self::row('Payload Error', self::VALIDATION, false, false, false, true, false, true, false, false, false, 'Tipe data atau parameter tidak sesuai'),
            '41' => self::row('Signature tidak valid', self::AUTHENTICATION, false, false, false, true, true, false, false, false, false, 'Perhatikan formula signature; pastikan apiKey sesuai mode API (Development / Production)'),
            '42' => self::row('Gagal memproses API Buyer', self::AUTHENTICATION, false, false, false, true, true, false, false, false, false, 'Username belum sesuai'),
            '43' => self::row('SKU tidak di temukan atau Non-Aktif', self::VALIDATION, false, false, false, true, false, true, false, false),
            '44' => self::row('Saldo tidak cukup', self::BUSINESS, false, true, false, false, false, false, false, false),
            '45' => self::row('IP Anda tidak kami kenali', self::AUTHENTICATION, false, false, false, true, true, false, false, false, false, 'Whitelist IP di pengaturan koneksi; sesuaikan mode API'),
            '47' => self::row('Transaksi sudah terjadi di buyer lain', self::VALIDATION, false, false, false, true, false, true, false, false),
            '49' => self::row('Ref ID tidak unik', self::VALIDATION, false, false, false, true, false, true, false, false),

            '50' => self::row('Transaksi Tidak Ditemukan', self::PROVIDER, true, false, true, true, false, false, true, false),
            '51' => self::row('Nomor Tujuan Diblokir', self::VALIDATION, true, false, true, true, false, true, false, false),
            '52' => self::row('Prefix Tidak Sesuai Dengan Operator', self::VALIDATION, true, false, true, true, false, true, false, false),
            '53' => self::row('Produk Seller Sedang Tidak Tersedia', self::PROVIDER, true, true, true, false, false, false, true, false),
            '54' => self::row('Nomor Tujuan Salah', self::VALIDATION, true, false, true, true, false, true, false, false),
            '55' => self::row('Produk Sedang Gangguan', self::PROVIDER, true, true, true, false, false, false, true, false),
            // Deprecated Digiflazz RC — still recognized for compatibility.
            '56' => self::row('Limit saldo seller', self::BUSINESS, false, false, false, true, false, false, false, false, true, 'Deprecated'),
            '57' => self::row('Jumlah Digit Kurang Atau Lebih', self::VALIDATION, true, false, true, true, false, true, false, false),
            '58' => self::row('Sedang Cut Off', self::PROVIDER, true, true, true, false, false, false, true, false),
            '59' => self::row('Tujuan di Luar Wilayah/Cluster', self::VALIDATION, true, false, true, true, false, true, false, false),

            '60' => self::row('Tagihan belum tersedia', self::BUSINESS, true, false, true, true, false, false, false, false),
            '61' => self::row('Belum pernah melakukan deposit', self::BUSINESS, false, true, false, false, false, false, false, false),
            '62' => self::row('Seller sedang mengalami gangguan', self::PROVIDER, false, true, false, false, false, false, true, false),
            '63' => self::row('Tidak support transaksi multi', self::VALIDATION, false, false, false, true, false, true, false, false),
            '64' => self::row('Tarik tiket gagal, coba nominal lain atau hubungi admin.', self::BUSINESS, false, false, false, true, false, false, false, false),
            // Deprecated Digiflazz RC — still recognized for compatibility.
            '65' => self::row('Limit transaksi multi', self::BUSINESS, false, false, false, true, false, false, false, false, true, 'Deprecated'),
            '66' => self::row('Cut Off (Perbaikan Sistem Seller)', self::PROVIDER, false, true, false, false, false, false, true, false),
            '67' => self::row('Seller belum ter-verfikasi', self::PROVIDER, false, false, false, true, false, false, true, false),
            '68' => self::row('Stok habis', self::PROVIDER, false, true, false, false, false, false, true, false),
            '69' => self::row('Harga seller lebih besar dari ketentuan harga Buyer', self::BUSINESS, false, false, false, true, false, false, false, false),

            '70' => self::row('Timeout Dari Biller', self::NETWORK, true, true, true, false, false, false, true, false),
            '71' => self::row('Produk Sedang Tidak Stabil', self::PROVIDER, true, true, true, false, false, false, true, false),
            '72' => self::row('Lakukan Unreg Paket Dahulu', self::VALIDATION, true, false, true, true, false, true, false, false),
            '73' => self::row('Kwh Melebihi Batas', self::VALIDATION, true, false, true, true, false, true, false, false),
            '74' => self::row('Transaksi Refund', self::REFUND, true, false, true, true, false, false, false, false),

            '80' => self::row('Akun Anda telah diblokir oleh Seller', self::AUTHENTICATION, false, false, false, true, true, false, false, false),
            '81' => self::row('Seller ini telah diblokir oleh Anda', self::AUTHENTICATION, false, false, false, true, true, false, false, false),
            '82' => self::row('Akun Anda belum ter-verfikasi', self::AUTHENTICATION, false, false, false, true, true, false, false, false),
            '83' => self::row(
                'Anda telah mencapai limitasi pengecekan pricelist, silahkan coba beberapa saat lagi',
                self::RATE_LIMIT,
                false,
                true,
                false,
                false,
                false,
                false,
                false,
                true,
                false,
                'API Pricelist semua produk (termasuk per category/brand/type) maksimal 5 menit 1x; per satu kode maksimal 1x per detik'
            ),
            '84' => self::row('Nominal tidak valid', self::VALIDATION, true, false, true, true, false, true, false, false),
            '85' => self::row('Anda telah mencapai limitasi transaksi, silahkan coba 1 menit lagi', self::RATE_LIMIT, true, true, true, false, false, false, false, true),
            '86' => self::row('Anda telah mencapai limitasi pengecekan nomor PLN, silahkan coba beberapa saat lagi', self::RATE_LIMIT, true, true, true, false, false, false, false, true),
            '87' => self::row('Transaksi E-money wajib kelipatan Rp 1.000', self::VALIDATION, false, false, false, true, false, true, false, false),
            '88' => self::row('Akun Anda tidak dapat melakukan aksi ini', self::AUTHENTICATION, false, false, false, true, true, false, false, false),

            '99' => self::row('DF Router Issue', self::PENDING, true, true, false, false, false, false, false, false),
        ];
    }

    /**
     * @return array{
     *   message:string,
     *   status:string,
     *   deskripsi:string,
     *   category:string,
     *   transaction_created:bool,
     *   should_retry:bool,
     *   should_refund:bool,
     *   permanent_failure:bool,
     *   authentication_failure:bool,
     *   validation_failure:bool,
     *   provider_failure:bool,
     *   rate_limit:bool,
     *   deprecated?:bool
     * }
     */
    protected static function row(
        string $message,
        string $category,
        bool $transactionCreated,
        bool $shouldRetry,
        bool $shouldRefund,
        bool $permanentFailure,
        bool $authenticationFailure,
        bool $validationFailure,
        bool $providerFailure,
        bool $rateLimit,
        bool $deprecated = false,
        string $deskripsi = '',
    ): array {
        $row = [
            'message' => $message,
            'status' => self::digiflazzStatusForCategory($category),
            'deskripsi' => $deskripsi,
            'category' => $category,
            'transaction_created' => $transactionCreated,
            'should_retry' => $shouldRetry,
            'should_refund' => $shouldRefund,
            'permanent_failure' => $permanentFailure,
            'authentication_failure' => $authenticationFailure,
            'validation_failure' => $validationFailure,
            'provider_failure' => $providerFailure,
            'rate_limit' => $rateLimit,
        ];

        if ($deprecated) {
            $row['deprecated'] = true;
        }

        return $row;
    }
}
