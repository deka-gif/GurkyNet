<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;

/**
 * Derives operator-facing provider health from multiple real indicators.
 * Balance failure alone must never force Offline or Auth Failed.
 * Descriptions prefer the real provider message — never invent credential errors.
 */
class ProviderHealthStatus
{
    public const ONLINE = 'online';
    public const PARTIAL = 'partial';
    public const MAINTENANCE = 'maintenance';
    public const OFFLINE = 'offline';
    public const AUTH_FAILED = 'auth_failed';
    public const NOT_CONFIGURED = 'not_configured';
    public const DISABLED = 'disabled';

    /**
     * @param  array{
     *   connection?:string,
     *   authentication?:string,
     *   sync?:string,
     *   balance?:string,
     *   inquiry?:string,
     *   success_rate?:string,
     *   partner_status?:string,
     *   is_active?:bool,
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
     *   indicator_labels:array<string, string>,
     * }
     */
    public static function evaluate(array $indicators): array
    {
        $providerMessage = trim((string) ($indicators['message'] ?? ''));
        $partner = strtolower((string) ($indicators['partner_status'] ?? 'online'));

        if ($partner === 'maintenance') {
            return self::result(
                self::MAINTENANCE,
                'orange',
                'Maintenance',
                $providerMessage !== ''
                    ? $providerMessage
                    : 'Provider sedang dalam pemeliharaan. Sistem akan menggunakan provider cadangan jika tersedia.',
                false,
                $indicators
            );
        }

        if (($indicators['configured'] ?? true) === false) {
            return self::result(
                self::NOT_CONFIGURED,
                'red',
                'Belum Dikonfigurasi',
                $providerMessage !== ''
                    ? $providerMessage
                    : 'Integrasi provider belum dikonfigurasi.',
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
                $providerMessage !== ''
                    ? $providerMessage
                    : 'Autentikasi provider gagal menurut response provider.',
                false,
                $indicators
            );
        }

        if (in_array($connection, ['failed', 'timeout'], true)) {
            return self::result(
                self::OFFLINE,
                'red',
                'Offline',
                $providerMessage !== ''
                    ? $providerMessage
                    : 'Provider tidak dapat dihubungi. Produk tetap tersedia dari sinkronisasi terakhir.',
                false,
                $indicators
            );
        }

        $warnings = [];
        if ($balance === 'failed') {
            $warnings[] = $providerMessage !== ''
                ? $providerMessage
                : 'Balance provider sedang tidak tersedia.';
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
            // Prefer the real provider message when balance/service is degraded.
            $desc = $providerMessage !== '' && $balance === 'failed'
                ? $providerMessage
                : (count($warnings) === 1
                    ? $warnings[0]
                    : 'Provider masih dapat digunakan. Sebagian layanan sedang mengalami gangguan.');

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
            $providerMessage !== '' && strtoupper($providerMessage) !== 'OK'
                ? $providerMessage
                : 'Provider berjalan normal dan siap memproses transaksi.',
            true,
            $indicators
        );
    }

    /**
     * Human labels for Control Center / Provider Management indicator grid.
     *
     * @param  array<string, mixed>  $indicators
     * @return array{connection:string, authentication:string, balance:string, service:string}
     */
    public static function indicatorLabels(array $indicators): array
    {
        $connection = strtolower((string) ($indicators['connection'] ?? 'unknown'));
        $auth = strtolower((string) ($indicators['authentication'] ?? 'unknown'));
        $balance = strtolower((string) ($indicators['balance'] ?? 'unknown'));
        $sync = strtolower((string) ($indicators['sync'] ?? 'unknown'));
        $inquiry = strtolower((string) ($indicators['inquiry'] ?? 'unknown'));

        $serviceOk = ! in_array($sync, ['failed', 'stale'], true)
            && ! in_array($inquiry, ['failed', 'warning'], true);

        return [
            'connection' => match ($connection) {
                'ok' => 'Online',
                'slow' => 'Lambat',
                'timeout' => 'Timeout',
                'failed' => 'Gagal',
                default => 'Tidak diketahui',
            },
            'authentication' => match ($auth) {
                'ok' => 'Valid',
                'failed' => 'Gagal',
                default => 'Tidak diketahui',
            },
            'balance' => match ($balance) {
                'ok' => 'Tersedia',
                'failed' => 'Tidak dapat dibaca',
                default => 'Tidak diketahui',
            },
            'service' => $serviceOk ? 'Aktif' : 'Terganggu',
        ];
    }

    /**
     * Whether checkout routing may still attempt this provider.
     * unknown = belum di-probe — tetap boleh dicoba (bukan Offline).
     *
     * Partner power (is_active / DISABLED) is enforced by ProductRoutingService separately.
     * partner_status=offline alone must not block when the provider is powered on —
     * that stale flag is synced from is_active; API Offline is api_status instead.
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
            self::DISABLED => 'Disabled',
            'timeout', 'no_response' => 'Offline',
            self::OFFLINE => 'Offline',
            default => $apiStatus ? ucwords(str_replace('_', ' ', (string) $apiStatus)) : 'Tidak Diketahui',
        };
    }

    public static function descriptionFor(ProductProvider $provider): string
    {
        if (method_exists($provider, 'isPartnerMaintenance') && $provider->isPartnerMaintenance()) {
            $err = trim((string) ($provider->last_error ?? ''));

            return $err !== ''
                ? $err
                : 'Provider sedang dalam pemeliharaan. Sistem akan menggunakan provider cadangan jika tersedia.';
        }

        if (! $provider->is_active || (method_exists($provider, 'isPartnerOffline') && $provider->isPartnerOffline())) {
            $err = trim((string) ($provider->last_error ?? ''));

            return $err !== ''
                ? $err
                : 'Provider dinonaktifkan manual oleh administrator. Transaksi tidak dikirim ke provider ini.';
        }

        $api = strtolower((string) ($provider->api_status ?? ''));
        $err = trim((string) ($provider->last_error ?? ''));

        // Prefer stored provider/probe message for all non-online states.
        if ($err !== '' && $api !== self::ONLINE) {
            return $err;
        }

        return match ($api) {
            self::ONLINE => 'Provider berjalan normal dan siap memproses transaksi.',
            self::PARTIAL, 'degraded', 'syncing' => 'Provider masih dapat digunakan. Sebagian layanan sedang mengalami gangguan.',
            self::MAINTENANCE => 'Provider sedang dalam pemeliharaan. Sistem akan menggunakan provider cadangan jika tersedia.',
            self::AUTH_FAILED => 'Autentikasi provider gagal menurut response provider.',
            self::NOT_CONFIGURED => 'Integrasi provider belum dikonfigurasi.',
            self::DISABLED => 'Provider dinonaktifkan manual oleh administrator.',
            self::OFFLINE, 'timeout', 'no_response' => 'Provider tidak dapat dihubungi. Produk tetap tersedia dari sinkronisasi terakhir.',
            default => $err !== '' ? $err : 'Status provider belum diperiksa.',
        };
    }

    /**
     * @param  array<string, mixed>  $indicators
     * @return array{api_status:string,health_color:string,label:string,description:string,transaction_eligible:bool,indicators:array,indicator_labels:array<string,string>}
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
            'indicator_labels' => self::indicatorLabels($indicators),
        ];
    }
}
