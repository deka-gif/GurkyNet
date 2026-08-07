<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;

/**
 * Derives operator-facing provider health from multiple real indicators.
 * Balance failure alone must never force Offline.
 */
class ProviderHealthStatus
{
    public const ONLINE = 'online';
    public const PARTIAL = 'partial';
    public const MAINTENANCE = 'maintenance';
    public const OFFLINE = 'offline';
    public const AUTH_FAILED = 'auth_failed';
    public const NOT_CONFIGURED = 'not_configured';

    /**
     * @param  array{
     *   connection?:string,
     *   authentication?:string,
     *   sync?:string,
     *   balance?:string,
     *   inquiry?:string,
     *   success_rate?:string,
     *   partner_status?:string,
     *   configured?:bool,
     *   latency_ms?:?int,
     *   balance_value?:?float,
     *   product_count?:int,
     *   success_rate_value?:?float,
     *   warnings?:list<string>,
     *   message?:?string,
     * }  $indicators
     * @return array{
     *   api_status:string,
     *   health_color:string,
     *   label:string,
     *   description:string,
     *   transaction_eligible:bool,
     *   indicators:array,
     * }
     */
    public static function evaluate(array $indicators): array
    {
        $partner = strtolower((string) ($indicators['partner_status'] ?? 'online'));
        if ($partner === 'maintenance') {
            return self::result(
                self::MAINTENANCE,
                'orange',
                'Maintenance',
                'Provider sedang dalam pemeliharaan. Sistem akan menggunakan provider cadangan jika tersedia.',
                false,
                $indicators
            );
        }

        if (($indicators['configured'] ?? true) === false) {
            return self::result(
                self::NOT_CONFIGURED,
                'red',
                'Belum Dikonfigurasi',
                'Integrasi provider belum dikonfigurasi. Periksa API Key dan Secret.',
                false,
                $indicators
            );
        }

        $connection = strtolower((string) ($indicators['connection'] ?? 'unknown'));
        $auth = strtolower((string) ($indicators['authentication'] ?? 'unknown'));
        $sync = strtolower((string) ($indicators['sync'] ?? 'unknown'));
        $balance = strtolower((string) ($indicators['balance'] ?? 'unknown'));
        $inquiry = strtolower((string) ($indicators['inquiry'] ?? 'unknown'));
        $successRate = strtolower((string) ($indicators['success_rate'] ?? 'unknown'));

        if ($auth === 'failed') {
            return self::result(
                self::AUTH_FAILED,
                'red',
                'Autentikasi Gagal',
                'API Key atau Secret provider tidak valid. Periksa kembali konfigurasi integrasi.',
                false,
                $indicators
            );
        }

        if (in_array($connection, ['failed', 'timeout'], true)) {
            return self::result(
                self::OFFLINE,
                'red',
                'Offline',
                'Provider tidak dapat dihubungi. Produk tetap tersedia dari sinkronisasi terakhir. Seluruh transaksi akan dialihkan ke provider cadangan.',
                false,
                $indicators
            );
        }

        $warnings = $indicators['warnings'] ?? [];
        if (! is_array($warnings)) {
            $warnings = [];
        }

        if ($balance === 'failed') {
            $warnings[] = 'Gagal mengambil informasi saldo provider.';
        }
        if ($sync === 'failed' || $sync === 'stale') {
            $warnings[] = 'Sinkronisasi produk tertunda atau belum berhasil.';
        }
        if ($inquiry === 'failed' || $inquiry === 'warning') {
            $warnings[] = 'Inquiry sebagian produk mengalami gangguan.';
        }
        if ($successRate === 'warning') {
            $warnings[] = 'Success rate transaksi hari ini menurun.';
        }
        if ($connection === 'slow') {
            $warnings[] = 'Latency API tinggi.';
        }

        $warnings = array_values(array_unique(array_filter($warnings)));

        if ($warnings !== []) {
            $desc = count($warnings) === 1
                ? $warnings[0].' Transaksi masih dapat diproses.'
                : 'Provider masih dapat digunakan. Sebagian layanan sedang mengalami gangguan.';

            return self::result(
                self::PARTIAL,
                'yellow',
                'Gangguan Sebagian',
                $desc,
                true,
                array_merge($indicators, ['warnings' => $warnings])
            );
        }

        return self::result(
            self::ONLINE,
            'green',
            'Online',
            'Provider berjalan normal dan siap memproses transaksi.',
            true,
            $indicators
        );
    }

    /**
     * Whether checkout routing may still attempt this provider.
     * unknown = belum di-probe — tetap boleh dicoba (bukan Offline).
     */
    public static function isTransactionEligible(?string $apiStatus, ?string $partnerStatus = null): bool
    {
        $partner = strtolower((string) ($partnerStatus ?? 'online'));
        if ($partner === 'maintenance') {
            return false;
        }

        $api = strtolower(trim((string) ($apiStatus ?? '')));

        if ($api === '' || $api === 'unknown') {
            return true;
        }

        return in_array($api, [self::ONLINE, self::PARTIAL, 'degraded', 'syncing'], true);
    }

    public static function labelFor(?string $apiStatus): string
    {
        return match (strtolower((string) $apiStatus)) {
            self::ONLINE => 'Online',
            self::PARTIAL, 'degraded', 'syncing' => 'Gangguan Sebagian',
            self::MAINTENANCE => 'Maintenance',
            self::AUTH_FAILED => 'Autentikasi Gagal',
            self::NOT_CONFIGURED => 'Belum Dikonfigurasi',
            'timeout', 'no_response' => 'Offline',
            self::OFFLINE => 'Offline',
            default => $apiStatus ? ucwords(str_replace('_', ' ', (string) $apiStatus)) : 'Tidak Diketahui',
        };
    }

    public static function descriptionFor(ProductProvider $provider): string
    {
        if (method_exists($provider, 'isPartnerMaintenance') && $provider->isPartnerMaintenance()) {
            return 'Provider sedang dalam pemeliharaan. Sistem akan menggunakan provider cadangan jika tersedia.';
        }

        $api = strtolower((string) ($provider->api_status ?? ''));
        $err = trim((string) ($provider->last_error ?? ''));

        return match ($api) {
            self::ONLINE => 'Provider berjalan normal dan siap memproses transaksi.',
            self::PARTIAL, 'degraded', 'syncing' => $err !== ''
                ? $err
                : 'Provider masih dapat digunakan. Sebagian layanan sedang mengalami gangguan.',
            self::MAINTENANCE => 'Provider sedang dalam pemeliharaan. Sistem akan menggunakan provider cadangan jika tersedia.',
            self::AUTH_FAILED => 'API Key atau Secret provider tidak valid. Periksa kembali konfigurasi integrasi.',
            self::NOT_CONFIGURED => 'Integrasi provider belum dikonfigurasi. Periksa API Key dan Secret.',
            self::OFFLINE, 'timeout', 'no_response' => 'Provider tidak dapat dihubungi. Produk tetap tersedia dari sinkronisasi terakhir. Seluruh transaksi akan dialihkan ke provider cadangan.',
            default => $err !== '' ? $err : 'Status provider belum diperiksa.',
        };
    }

    /**
     * @param  array<string, mixed>  $indicators
     * @return array{api_status:string,health_color:string,label:string,description:string,transaction_eligible:bool,indicators:array}
     */
    protected static function result(
        string $status,
        string $color,
        string $label,
        string $description,
        bool $eligible,
        array $indicators
    ): array {
        return [
            'api_status' => $status,
            'health_color' => $color,
            'label' => $label,
            'description' => $description,
            'transaction_eligible' => $eligible,
            'indicators' => $indicators,
        ];
    }
}
