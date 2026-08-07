<?php

namespace App\Services\ProductProviders;

/**
 * Official Digiflazz "Alasan Gagal" message catalog (Jabber / FM / IP Get docs).
 *
 * This is NOT a decision engine. DigiflazzResponseCodeClassifier remains the
 * Single Source of Truth when an RC is present.
 *
 * Use this catalog for:
 * - official failure message dictionary
 * - fallback classification when RC is absent
 * - UX copy (user / admin actions)
 * - audit metadata (transaction_created, retry, refund)
 *
 * @see Alasan Gagal — Dokumentasi Teknis Digiflazz
 */
final class DigiflazzFailureReasonCatalog
{
    public const AUTHENTICATION = 'AUTHENTICATION';

    public const VALIDATION = 'VALIDATION';

    public const PROVIDER = 'PROVIDER';

    public const NETWORK = 'NETWORK';

    public const BUSINESS = 'BUSINESS';

    public const CUSTOMER = 'CUSTOMER';

    public const SYSTEM = 'SYSTEM';

    /** Connection type / buyer channel not supported — no official RC. */
    public const UNKNOWN_CONFIGURATION = 'UNKNOWN_CONFIGURATION';

    /**
     * Seller-side Digiflazz balance empty — ambiguous vs RC 44 (buyer saldo).
     * Do not force-map to RC 44.
     */
    public const PROVIDER_SELLER_BALANCE = 'PROVIDER_SELLER_BALANCE';

    public const UNKNOWN = 'UNKNOWN';

    public function __construct(
        public readonly string $message,
        public readonly ?string $relatedRc,
        public readonly string $category,
        public readonly bool $transactionCreated,
        public readonly bool $retryable,
        public readonly bool $refundable,
        public readonly string $userAction,
        public readonly string $adminAction,
        public readonly string $userMessage,
        public readonly string $internalMessage,
        public readonly ?string $notes = null,
    ) {}

    /**
     * Exact (case-insensitive, trimmed) lookup of an official Digiflazz failure message.
     */
    public static function findByMessage(?string $message): ?self
    {
        $key = self::normalizeMessageKey($message);
        if ($key === null) {
            return null;
        }

        foreach (self::catalog() as $canonical => $row) {
            if (self::normalizeMessageKey($canonical) === $key) {
                return self::fromRow($canonical, $row);
            }
        }

        return null;
    }

    /**
     * Last-resort fuzzy match — only when exact catalog lookup fails and RC is absent.
     * Prefers the longest official message match to avoid short/partial collisions
     * (e.g. "Produk Sedang Gangguan" vs "Produk sedang Gangguan (Non Aktif)").
     */
    public static function findByMessageFuzzy(?string $message): ?self
    {
        $exact = self::findByMessage($message);
        if ($exact !== null) {
            return $exact;
        }

        $raw = strtolower(trim((string) $message));
        if ($raw === '') {
            return null;
        }

        $bestKey = null;
        $bestLen = 0;
        $bestRow = null;

        foreach (self::catalog() as $canonical => $row) {
            $needle = strtolower($canonical);
            if ($needle === '') {
                continue;
            }
            if (str_contains($raw, $needle) || str_contains($needle, $raw)) {
                $len = mb_strlen($needle);
                if ($len > $bestLen) {
                    $bestLen = $len;
                    $bestKey = $canonical;
                    $bestRow = $row;
                }
            }
        }

        return ($bestKey !== null && is_array($bestRow))
            ? self::fromRow($bestKey, $bestRow)
            : null;
    }

    public function category(): string
    {
        return $this->category;
    }

    public function transactionCreated(): bool
    {
        return $this->transactionCreated;
    }

    public function shouldRetry(): bool
    {
        return $this->retryable;
    }

    public function shouldRefund(): bool
    {
        return $this->refundable;
    }

    public function userAction(): string
    {
        return $this->userAction;
    }

    public function adminAction(): string
    {
        return $this->adminAction;
    }

    public function description(): string
    {
        return $this->message;
    }

    /**
     * UX layer — does not change API response contracts.
     *
     * @return array{
     *   internal_message:string,
     *   user_message:string,
     *   user_action:string,
     *   admin_action:string
     * }
     */
    public function ux(): array
    {
        return [
            'internal_message' => $this->internalMessage,
            'user_message' => $this->userMessage,
            'user_action' => $this->userAction,
            'admin_action' => $this->adminAction,
        ];
    }

    /**
     * Reason key compatible with DigiflazzProductProviderAdapter / ProviderFailoverPolicy.
     */
    public function fulfillmentReason(): string
    {
        return match ($this->category) {
            self::AUTHENTICATION => 'authentication_failure',
            self::VALIDATION, self::CUSTOMER => 'customer_validation',
            self::UNKNOWN_CONFIGURATION => 'unknown_configuration',
            self::PROVIDER_SELLER_BALANCE => 'provider_seller_balance',
            self::NETWORK => str_contains(strtolower($this->message), 'timeout')
                ? 'timeout'
                : 'provider_error',
            self::BUSINESS => str_contains(strtolower($this->message), 'saldo')
                || str_contains(strtolower($this->message), 'deposit')
                ? 'insufficient_balance'
                : 'provider_rejected',
            self::SYSTEM => strtolower($this->message) === 'transaksi refund'
                ? 'digiflazz_refund'
                : 'provider_rejected',
            self::PROVIDER => $this->retryable ? 'provider_maintenance' : 'provider_error',
            default => 'provider_rejected',
        };
    }

    public function allowsFailover(): bool
    {
        if (in_array($this->category, [
            self::VALIDATION,
            self::CUSTOMER,
            self::UNKNOWN_CONFIGURATION,
            self::SYSTEM,
        ], true) && ! $this->retryable) {
            // Refund is SYSTEM + non-retry — never failover.
            if (strtolower($this->message) === 'transaksi refund') {
                return false;
            }
            if (in_array($this->category, [self::VALIDATION, self::CUSTOMER, self::UNKNOWN_CONFIGURATION], true)) {
                return false;
            }
        }

        if ($this->category === self::AUTHENTICATION) {
            return true;
        }

        if ($this->category === self::PROVIDER_SELLER_BALANCE) {
            return true;
        }

        if ($this->category === self::PROVIDER && $this->retryable) {
            return true;
        }

        if ($this->category === self::NETWORK && $this->retryable) {
            return true;
        }

        if ($this->category === self::BUSINESS && $this->retryable) {
            return true;
        }

        return $this->retryable && ! in_array($this->category, [self::VALIDATION, self::CUSTOMER], true);
    }

    /**
     * Resolve Digiflazz-side transaction_created: RC wins, else Alasan Gagal catalog.
     *
     * @param  array<string, mixed>  $data  Digiflazz response `data` payload
     */
    public static function resolveTransactionCreated(array $data): bool
    {
        $rc = DigiflazzResponseCodeClassifier::normalize($data['rc'] ?? null);
        if ($rc !== null) {
            return DigiflazzResponseCodeClassifier::classify($rc)->transactionCreated();
        }

        $message = (string) ($data['message'] ?? '');
        $reason = self::findByMessage($message) ?? self::findByMessageFuzzy($message);

        return $reason?->transactionCreated() ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function toLogContext(): array
    {
        return [
            'failure_reason' => $this->message,
            'related_rc' => $this->relatedRc,
            'category' => $this->category,
            'transaction_created' => $this->transactionCreated,
            'retry' => $this->retryable,
            'refund' => $this->refundable,
            'user_action' => $this->userAction,
            'admin_action' => $this->adminAction,
        ];
    }

    /**
     * All 36 official Alasan Gagal messages (exact Digiflazz wording).
     *
     * @return list<string>
     */
    public static function officialMessages(): array
    {
        return array_keys(self::catalog());
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public static function catalog(): array
    {
        return [
            'Nomor Tujuan Salah' => self::row(
                relatedRc: '54',
                category: self::CUSTOMER,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Periksa dan masukkan ulang nomor tujuan yang benar.',
                adminAction: 'Tidak perlu intervensi kecuali keluhan berulang pada SKU tertentu.',
                userMessage: 'Nomor tujuan tidak valid. Silakan periksa kembali nomor Anda.',
                internalMessage: 'Digiflazz: Nomor Tujuan Salah (RC54).',
            ),
            'Invalid Payload' => self::row(
                relatedRc: '40',
                category: self::VALIDATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Coba ulangi transaksi. Jika berulang, hubungi layanan pelanggan.',
                adminAction: 'Periksa payload request Digiflazz (field wajib, format JSON).',
                userMessage: 'Transaksi gagal karena data permintaan tidak valid.',
                internalMessage: 'Digiflazz: Invalid Payload / Payload Error (RC40).',
            ),
            'Gagal memproses API Buyer' => self::row(
                relatedRc: '42',
                category: self::AUTHENTICATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Silakan coba lagi nanti atau hubungi layanan pelanggan.',
                adminAction: 'Periksa kredensial API Buyer Digiflazz (username / API key / signature).',
                userMessage: 'Transaksi gagal diproses oleh penyedia. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Gagal memproses API Buyer (RC42).',
            ),
            'SKU tidak di temukan atau Non-Aktif' => self::row(
                relatedRc: '43',
                category: self::VALIDATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Pilih produk lain yang tersedia.',
                adminAction: 'Sinkronkan katalog Digiflazz dan periksa mapping SKU.',
                userMessage: 'Produk tidak tersedia saat ini.',
                internalMessage: 'Digiflazz: SKU tidak ditemukan atau non-aktif (RC43).',
            ),
            'Saldo Tidak Cukup' => self::row(
                relatedRc: '44',
                category: self::BUSINESS,
                transactionCreated: false,
                retryable: true,
                refundable: false,
                userAction: 'Silakan coba lagi nanti.',
                adminAction: 'Top-up deposit Digiflazz (saldo buyer).',
                userMessage: 'Layanan sedang tidak dapat memproses transaksi. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Saldo buyer tidak cukup (RC44).',
            ),
            'IP Anda tidak kami kenali' => self::row(
                relatedRc: '45',
                category: self::AUTHENTICATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Silakan coba lagi nanti atau hubungi layanan pelanggan.',
                adminAction: 'Whitelist IP server GurkyNet di dashboard Digiflazz.',
                userMessage: 'Transaksi gagal karena konfigurasi jaringan penyedia.',
                internalMessage: 'Digiflazz: IP tidak dikenali (RC45).',
            ),
            'Stok habis' => self::row(
                relatedRc: '68',
                category: self::PROVIDER,
                transactionCreated: false,
                retryable: true,
                refundable: false,
                userAction: 'Coba lagi nanti atau pilih produk lain.',
                adminAction: 'Pantau stok seller / aktifkan failover ke provider lain bila tersedia.',
                userMessage: 'Stok produk sedang habis. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Stok habis (RC68).',
            ),
            'Cut Off (Perbaikan Sistem Seller)' => self::row(
                relatedRc: '66',
                category: self::PROVIDER,
                transactionCreated: false,
                retryable: true,
                refundable: false,
                userAction: 'Coba lagi setelah beberapa saat.',
                adminAction: 'Pantau cutoff seller; failover ke provider lain bila tersedia.',
                userMessage: 'Produk sedang dalam perbaikan. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Cut Off perbaikan sistem seller (RC66).',
            ),
            'Limit saldo seller' => self::row(
                relatedRc: '56',
                category: self::BUSINESS,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Coba lagi nanti atau pilih produk lain.',
                adminAction: 'RC56 deprecated — pantau limit saldo seller Digiflazz.',
                userMessage: 'Transaksi tidak dapat diproses saat ini.',
                internalMessage: 'Digiflazz: Limit saldo seller (RC56, deprecated).',
                notes: 'Deprecated Digiflazz RC — still recognized for compatibility.',
            ),
            'Limit transaksi multi' => self::row(
                relatedRc: '65',
                category: self::BUSINESS,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Kirim transaksi satu per satu.',
                adminAction: 'RC65 deprecated — hindari pola transaksi multi.',
                userMessage: 'Transaksi multi tidak didukung untuk permintaan ini.',
                internalMessage: 'Digiflazz: Limit transaksi multi (RC65, deprecated).',
                notes: 'Deprecated Digiflazz RC — still recognized for compatibility.',
            ),
            /*
             * Wording differs from RC 53 ("Produk Seller Sedang Tidak Tersedia")
             * and RC 55 ("Produk Sedang Gangguan"). Do NOT treat as identical.
             * Alasan Gagal: Terbentuk Transaksi = Tidak.
             */
            'Produk sedang Gangguan (Non Aktif)' => self::row(
                relatedRc: null,
                category: self::PROVIDER,
                transactionCreated: false,
                retryable: true,
                refundable: false,
                userAction: 'Coba lagi nanti atau pilih produk lain.',
                adminAction: 'Produk Digiflazz non-aktif/gangguan — bedakan dari RC53/RC55; cek status produk di Digiflazz.',
                userMessage: 'Produk sedang gangguan. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Produk sedang Gangguan (Non Aktif) — bukan RC53/RC55.',
                notes: 'Separate from RC53 and RC55; official Alasan Gagal wording with transaction_created=false.',
            ),
            'Koneksi belum didukung' => self::row(
                relatedRc: null,
                category: self::UNKNOWN_CONFIGURATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Hubungi layanan pelanggan.',
                adminAction: 'Periksa tipe koneksi Digiflazz buyer (API/Jabber/FM/IP Get). Konfigurasi channel tidak didukung.',
                userMessage: 'Layanan tidak dapat memproses transaksi karena konfigurasi penyedia.',
                internalMessage: 'Digiflazz: Koneksi belum didukung (UNKNOWN_CONFIGURATION, no official RC).',
                notes: 'No official Response Code — configuration / connection-type issue.',
            ),
            'Transaksi sudah terjadi di buyer lain' => self::row(
                relatedRc: '47',
                category: self::VALIDATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Jangan ulangi transaksi yang sama; cek status transaksi.',
                adminAction: 'Periksa duplikasi lintas buyer / ref_id di Digiflazz.',
                userMessage: 'Transaksi serupa sudah diproses. Silakan cek riwayat transaksi.',
                internalMessage: 'Digiflazz: Transaksi sudah terjadi di buyer lain (RC47).',
            ),
            'Ref ID tidak unik' => self::row(
                relatedRc: '49',
                category: self::SYSTEM,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Jangan kirim ulang dengan invoice yang sama; hubungi layanan pelanggan bila saldo terpotong.',
                adminAction: 'Pastikan ref_id/invoice GurkyNet unik per transaksi Digiflazz.',
                userMessage: 'Transaksi gagal karena referensi tidak unik.',
                internalMessage: 'Digiflazz: Ref ID tidak unik (RC49).',
            ),
            'Nomor Tujuan Diblokir' => self::row(
                relatedRc: '51',
                category: self::CUSTOMER,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Gunakan nomor lain atau hubungi operator tujuan.',
                adminAction: 'Tidak perlu retry; konfirmasi refund lokal jika user sudah didebit.',
                userMessage: 'Nomor tujuan diblokir oleh operator.',
                internalMessage: 'Digiflazz: Nomor Tujuan Diblokir (RC51).',
            ),
            'Tagihan belum tersedia' => self::row(
                relatedRc: '60',
                category: self::CUSTOMER,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Coba lagi setelah periode tagihan tersedia.',
                adminAction: 'Informasikan jadwal tagihan; jangan paksa retry otomatis.',
                userMessage: 'Tagihan belum tersedia untuk nomor ini.',
                internalMessage: 'Digiflazz: Tagihan belum tersedia (RC60).',
            ),
            'Transaksi Tidak Ditemukan' => self::row(
                relatedRc: '50',
                category: self::PROVIDER,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Hubungi layanan pelanggan untuk pengecekan status.',
                adminAction: 'Investigasi ref_id di Digiflazz / log lokal.',
                userMessage: 'Transaksi tidak ditemukan di penyedia.',
                internalMessage: 'Digiflazz: Transaksi Tidak Ditemukan (RC50).',
            ),
            'Prefix Tidak Sesuai Dengan Operator' => self::row(
                relatedRc: '52',
                category: self::CUSTOMER,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Pastikan nomor sesuai operator produk yang dipilih.',
                adminAction: 'Periksa mapping prefix / produk.',
                userMessage: 'Nomor tidak sesuai dengan operator produk.',
                internalMessage: 'Digiflazz: Prefix tidak sesuai operator (RC52).',
            ),
            'Produk Sedang Gangguan' => self::row(
                relatedRc: '55',
                category: self::PROVIDER,
                transactionCreated: true,
                retryable: true,
                refundable: true,
                userAction: 'Coba lagi nanti.',
                adminAction: 'Failover / pantau gangguan produk Digiflazz (RC55).',
                userMessage: 'Produk sedang gangguan. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Produk Sedang Gangguan (RC55).',
                notes: 'Distinct from "Produk sedang Gangguan (Non Aktif)" in Alasan Gagal (no RC, transaction_created=false).',
            ),
            /*
             * Ambiguous vs RC 44 (buyer "Saldo tidak cukup").
             * Do NOT force related_rc = 44. Seller-side Digiflazz balance issue.
             */
            'Saldo Seller Digiflazz Habis' => self::row(
                relatedRc: null,
                category: self::PROVIDER_SELLER_BALANCE,
                transactionCreated: true,
                retryable: true,
                refundable: true,
                userAction: 'Coba lagi nanti.',
                adminAction: 'Saldo seller Digiflazz habis — pantau seller/deposit jalur Digiflazz; jangan samakan dengan RC44 buyer.',
                userMessage: 'Layanan sedang tidak dapat memproses transaksi. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Saldo Seller Digiflazz Habis (PROVIDER_SELLER_BALANCE, not RC44).',
                notes: 'Ambiguous vs RC44 — keep as seller balance issue; retry when seller recovers.',
            ),
            'Belum pernah melakukan deposit' => self::row(
                relatedRc: '61',
                category: self::BUSINESS,
                transactionCreated: false,
                retryable: true,
                refundable: false,
                userAction: 'Silakan coba lagi nanti.',
                adminAction: 'Lakukan deposit pertama ke akun Digiflazz buyer.',
                userMessage: 'Layanan belum siap memproses transaksi.',
                internalMessage: 'Digiflazz: Belum pernah melakukan deposit (RC61).',
            ),
            'Seller sedang mengalami gangguan' => self::row(
                relatedRc: '62',
                category: self::PROVIDER,
                transactionCreated: false,
                retryable: true,
                refundable: false,
                userAction: 'Coba lagi nanti.',
                adminAction: 'Failover / pantau seller Digiflazz (RC62).',
                userMessage: 'Penyedia sedang gangguan. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Seller sedang mengalami gangguan (RC62).',
            ),
            'Tidak support transaksi multi' => self::row(
                relatedRc: '63',
                category: self::VALIDATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Lakukan transaksi satu per satu.',
                adminAction: 'Nonaktifkan pengiriman transaksi multi ke Digiflazz.',
                userMessage: 'Transaksi multi tidak didukung.',
                internalMessage: 'Digiflazz: Tidak support transaksi multi (RC63).',
            ),
            'Jumlah Digit Kurang Atau Lebih' => self::row(
                relatedRc: '57',
                category: self::CUSTOMER,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Periksa panjang nomor tujuan.',
                adminAction: 'Validasi panjang nomor di form produk bila memungkinkan.',
                userMessage: 'Jumlah digit nomor tujuan tidak sesuai.',
                internalMessage: 'Digiflazz: Jumlah digit kurang atau lebih (RC57).',
            ),
            'Sedang Cut Off' => self::row(
                relatedRc: '58',
                category: self::PROVIDER,
                transactionCreated: true,
                retryable: true,
                refundable: true,
                userAction: 'Coba lagi setelah periode cut-off selesai.',
                adminAction: 'Pantau jadwal cut-off seller (RC58).',
                userMessage: 'Layanan sedang cut-off. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Sedang Cut Off (RC58).',
            ),
            'Tujuan di Luar Wilayah/Cluster' => self::row(
                relatedRc: '59',
                category: self::CUSTOMER,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Gunakan nomor yang berada di wilayah layanan produk.',
                adminAction: 'Konfirmasi cluster/wilayah produk Digiflazz.',
                userMessage: 'Nomor tujuan di luar wilayah layanan.',
                internalMessage: 'Digiflazz: Tujuan di luar wilayah/cluster (RC59).',
            ),
            'Timeout Dari Biller' => self::row(
                relatedRc: '70',
                category: self::NETWORK,
                transactionCreated: true,
                retryable: true,
                refundable: true,
                userAction: 'Tunggu konfirmasi status; jangan kirim ulang segera.',
                adminAction: 'Poll status Digiflazz; jangan fail permanen sebelum cek status.',
                userMessage: 'Koneksi ke operator timeout. Status sedang dicek.',
                internalMessage: 'Digiflazz: Timeout dari biller (RC70).',
            ),
            'Produk Sedang Tidak Stabil' => self::row(
                relatedRc: '71',
                category: self::PROVIDER,
                transactionCreated: true,
                retryable: true,
                refundable: true,
                userAction: 'Coba lagi nanti.',
                adminAction: 'Failover / pantau stabilitas produk (RC71).',
                userMessage: 'Produk sedang tidak stabil. Silakan coba lagi nanti.',
                internalMessage: 'Digiflazz: Produk Sedang Tidak Stabil (RC71).',
            ),
            'Lakukan Unreg Paket Dahulu' => self::row(
                relatedRc: '72',
                category: self::CUSTOMER,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Unregister paket lama di operator, lalu coba lagi.',
                adminAction: 'Tidak retry otomatis — edukasi user unreg paket.',
                userMessage: 'Silakan unregister paket terlebih dahulu di operator.',
                internalMessage: 'Digiflazz: Lakukan Unreg Paket Dahulu (RC72).',
            ),
            'Kwh Melebihi Batas' => self::row(
                relatedRc: '73',
                category: self::CUSTOMER,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Pilih nominal token yang lebih kecil.',
                adminAction: 'Tidak retry otomatis.',
                userMessage: 'Nominal kWh melebihi batas yang diizinkan.',
                internalMessage: 'Digiflazz: Kwh Melebihi Batas (RC73).',
            ),
            'Transaksi Refund' => self::row(
                relatedRc: '74',
                category: self::SYSTEM,
                transactionCreated: true,
                retryable: false,
                refundable: true,
                userAction: 'Saldo akan dikembalikan sesuai kebijakan platform.',
                adminAction: 'Pastikan refund wallet lokal selaras dengan RC74 Digiflazz.',
                userMessage: 'Transaksi digagalkan dan direfund oleh penyedia.',
                internalMessage: 'Digiflazz: Transaksi Refund (RC74).',
            ),
            'Harga seller lebih besar dari ketentuan harga Buyer' => self::row(
                relatedRc: '69',
                category: self::BUSINESS,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Coba lagi nanti atau pilih produk lain.',
                adminAction: 'Sesuaikan max_price / ketentuan harga buyer Digiflazz.',
                userMessage: 'Produk tidak dapat diproses karena ketentuan harga.',
                internalMessage: 'Digiflazz: Harga seller > ketentuan buyer (RC69).',
            ),
            'Akun Anda telah diblokir oleh Seller' => self::row(
                relatedRc: '80',
                category: self::AUTHENTICATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Hubungi layanan pelanggan.',
                adminAction: 'Hubungi Digiflazz/seller untuk unblock relasi buyer.',
                userMessage: 'Transaksi ditolak oleh penyedia.',
                internalMessage: 'Digiflazz: Akun diblokir oleh seller (RC80).',
            ),
            'Seller ini telah diblokir oleh Anda' => self::row(
                relatedRc: '81',
                category: self::AUTHENTICATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Hubungi layanan pelanggan.',
                adminAction: 'Unblock seller di dashboard Digiflazz bila perlu.',
                userMessage: 'Transaksi ditolak karena konfigurasi penyedia.',
                internalMessage: 'Digiflazz: Seller diblokir oleh buyer (RC81).',
            ),
            'Akun Anda belum ter-verfikasi' => self::row(
                relatedRc: '82',
                category: self::AUTHENTICATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Hubungi layanan pelanggan.',
                adminAction: 'Selesaikan verifikasi akun Digiflazz buyer.',
                userMessage: 'Layanan penyedia belum siap memproses transaksi.',
                internalMessage: 'Digiflazz: Akun belum terverifikasi (RC82).',
            ),
            'Akun Anda tidak dapat melakukan aksi ini' => self::row(
                relatedRc: '88',
                category: self::AUTHENTICATION,
                transactionCreated: false,
                retryable: false,
                refundable: false,
                userAction: 'Hubungi layanan pelanggan.',
                adminAction: 'Periksa hak akses / fitur akun Digiflazz buyer.',
                userMessage: 'Aksi transaksi tidak diizinkan oleh penyedia.',
                internalMessage: 'Digiflazz: Akun tidak dapat melakukan aksi ini (RC88).',
            ),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected static function row(
        ?string $relatedRc,
        string $category,
        bool $transactionCreated,
        bool $retryable,
        bool $refundable,
        string $userAction,
        string $adminAction,
        string $userMessage,
        string $internalMessage,
        ?string $notes = null,
    ): array {
        return [
            'related_rc' => $relatedRc,
            'category' => $category,
            'transaction_created' => $transactionCreated,
            'retryable' => $retryable,
            'refundable' => $refundable,
            'user_action' => $userAction,
            'admin_action' => $adminAction,
            'user_message' => $userMessage,
            'internal_message' => $internalMessage,
            'notes' => $notes,
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     */
    protected static function fromRow(string $message, array $row): self
    {
        return new self(
            message: $message,
            relatedRc: $row['related_rc'] ?? null,
            category: (string) $row['category'],
            transactionCreated: (bool) $row['transaction_created'],
            retryable: (bool) $row['retryable'],
            refundable: (bool) $row['refundable'],
            userAction: (string) $row['user_action'],
            adminAction: (string) $row['admin_action'],
            userMessage: (string) $row['user_message'],
            internalMessage: (string) $row['internal_message'],
            notes: isset($row['notes']) ? (string) $row['notes'] : null,
        );
    }

    protected static function normalizeMessageKey(?string $message): ?string
    {
        if ($message === null) {
            return null;
        }

        $trimmed = trim($message);
        if ($trimmed === '') {
            return null;
        }

        // Collapse internal whitespace for resilient exact matching.
        $collapsed = preg_replace('/\s+/u', ' ', $trimmed) ?? $trimmed;

        return mb_strtolower($collapsed);
    }
}
