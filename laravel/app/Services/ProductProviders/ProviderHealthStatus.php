<?php

namespace App\Services\ProductProviders;

use App\Models\ProductProvider;

/**
 * Universal provider health evaluation for Control Center.
 * Adapters map provider-native responses → indicators + optional authoritative `status`.
 * Dashboard never classifies Digiflazz/VIP/etc. — it only renders evaluate() output.
 */
class ProviderHealthStatus
{
    public const ONLINE = 'online';
    public const PARTIAL = 'partial';
    public const MAINTENANCE = 'maintenance';
    public const OFFLINE = 'offline';
    public const AUTH_FAILED = 'auth_failed';
    public const CONFIG_ERROR = 'config_error';
    public const NETWORK_CONFIGURATION = 'network_configuration';
    public const NOT_CONFIGURED = 'not_configured';
    public const DISABLED = 'disabled';

    /**
     * @param  array<string, mixed>  $indicators
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
        $providerMessage = trim((string) ($indicators['message'] ?? $indicators['provider_message'] ?? ''));
        $partner = strtolower((string) ($indicators['partner_status'] ?? 'online'));

        if ($partner === 'maintenance') {
            return self::result(
                self::MAINTENANCE,
                'orange',
                self::labelFor(self::MAINTENANCE),
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
                self::labelFor(self::NOT_CONFIGURED),
                $providerMessage !== ''
                    ? $providerMessage
                    : 'Integrasi provider belum dikonfigurasi.',
                false,
                $indicators
            );
        }

        // Adapter-authoritative status (RC / native code mapping already done in adapter).
        $forced = strtolower(trim((string) ($indicators['status'] ?? '')));
        if ($forced !== '' && self::isKnownStatus($forced)) {
            return self::resultFromForcedStatus($forced, $providerMessage, $indicators);
        }

        $connection = strtolower((string) ($indicators['connection'] ?? 'unknown'));
        $auth = strtolower((string) ($indicators['authentication'] ?? 'unknown'));
        $sync = strtolower((string) ($indicators['sync'] ?? 'unknown'));
        $balance = strtolower((string) ($indicators['balance'] ?? 'unknown'));
        $inquiry = strtolower((string) ($indicators['inquiry'] ?? 'unknown'));
        $successRate = strtolower((string) ($indicators['success_rate'] ?? 'unknown'));
        $service = strtolower((string) ($indicators['service'] ?? 'unknown'));

        if ($auth === 'failed') {
            return self::result(
                self::AUTH_FAILED,
                'red',
                self::labelFor(self::AUTH_FAILED),
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
                self::labelFor(self::OFFLINE),
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
        if ($service === 'failed') {
            $warnings[] = $providerMessage !== ''
                ? $providerMessage
                : 'Sebagian layanan provider sedang terganggu.';
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
            $desc = $providerMessage !== '' && ($balance === 'failed' || $service === 'failed')
                ? $providerMessage
                : (count($warnings) === 1
                    ? $warnings[0]
                    : 'Provider masih dapat digunakan. Sebagian layanan sedang mengalami gangguan.');

            return self::result(
                self::PARTIAL,
                'yellow',
                self::labelFor(self::PARTIAL),
                $desc,
                true,
                array_merge($indicators, ['warnings' => $warnings])
            );
        }

        return self::result(
            self::ONLINE,
            'green',
            self::labelFor(self::ONLINE),
            $providerMessage !== '' && strtoupper($providerMessage) !== 'OK'
                ? $providerMessage
                : 'Provider berjalan normal dan siap memproses transaksi.',
            true,
            $indicators
        );
    }

    /**
     * @param  array<string, mixed>  $indicators
     * @return array{api_status:string,health_color:string,label:string,description:string,transaction_eligible:bool,indicators:array,indicator_labels:array<string,string>}
     */
    protected static function resultFromForcedStatus(string $status, string $providerMessage, array $indicators): array
    {
        // Soft-upgrade ONLINE → PARTIAL when sync/inquiry/etc. degrade while adapter says online.
        if ($status === self::ONLINE) {
            $sync = strtolower((string) ($indicators['sync'] ?? 'ok'));
            $inquiry = strtolower((string) ($indicators['inquiry'] ?? 'ok'));
            $successRate = strtolower((string) ($indicators['success_rate'] ?? 'ok'));
            if (in_array($sync, ['failed', 'stale'], true)
                || in_array($inquiry, ['failed', 'warning'], true)
                || $successRate === 'warning') {
                $status = self::PARTIAL;
            }
        }

        $color = match ($status) {
            self::ONLINE => 'green',
            self::PARTIAL, 'degraded', 'syncing' => 'yellow',
            self::MAINTENANCE => 'orange',
            default => 'red',
        };

        $eligible = self::isTransactionEligible($status, $indicators['partner_status'] ?? 'online');

        $fallback = match ($status) {
            self::ONLINE => 'Provider berjalan normal dan siap memproses transaksi.',
            self::PARTIAL => 'Provider masih dapat digunakan. Sebagian layanan sedang mengalami gangguan.',
            self::AUTH_FAILED => 'Autentikasi provider gagal menurut response provider.',
            self::CONFIG_ERROR => 'Konfigurasi request/payload provider tidak valid menurut response provider.',
            self::NETWORK_CONFIGURATION => 'Konfigurasi jaringan provider (whitelist IP / firewall) bermasalah menurut response provider.',
            self::OFFLINE => 'Provider tidak dapat dihubungi. Produk tetap tersedia dari sinkronisasi terakhir.',
            self::NOT_CONFIGURED => 'Integrasi provider belum dikonfigurasi.',
            self::MAINTENANCE => 'Provider sedang dalam pemeliharaan.',
            self::DISABLED => 'Provider dinonaktifkan manual oleh administrator.',
            default => 'Status provider belum diperiksa.',
        };

        return self::result(
            $status,
            $color,
            self::labelFor($status),
            $providerMessage !== '' ? $providerMessage : $fallback,
            $eligible,
            $indicators
        );
    }

    public static function isKnownStatus(string $status): bool
    {
        return in_array($status, [
            self::ONLINE,
            self::PARTIAL,
            self::MAINTENANCE,
            self::OFFLINE,
            self::AUTH_FAILED,
            self::CONFIG_ERROR,
            self::NETWORK_CONFIGURATION,
            self::NOT_CONFIGURED,
            self::DISABLED,
            'degraded',
            'syncing',
            'timeout',
            'no_response',
        ], true);
    }

    /**
     * @param  array<string, mixed>  $indicators
     * @return array{connection:string, authentication:string, balance:string, service:string}
     */
    public static function indicatorLabels(array $indicators): array
    {
        $connection = strtolower((string) ($indicators['connection'] ?? 'unknown'));
        $auth = strtolower((string) ($indicators['authentication'] ?? 'unknown'));
        $balance = strtolower((string) ($indicators['balance'] ?? 'unknown'));
        $service = strtolower((string) ($indicators['service'] ?? ''));
        $sync = strtolower((string) ($indicators['sync'] ?? 'unknown'));
        $inquiry = strtolower((string) ($indicators['inquiry'] ?? 'unknown'));

        if ($service === '') {
            $serviceOk = ! in_array($sync, ['failed', 'stale'], true)
                && ! in_array($inquiry, ['failed', 'warning'], true);
            $service = $serviceOk ? 'ok' : 'failed';
        }

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
                'failed' => 'Failed',
                default => 'Unknown',
            },
            'balance' => match ($balance) {
                'ok' => 'OK',
                'failed' => 'Failed',
                default => 'Unknown',
            },
            'service' => match ($service) {
                'ok', 'active' => 'Active',
                'failed' => 'Terganggu',
                default => 'Unknown',
            },
        ];
    }

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
            self::ONLINE => 'ONLINE',
            self::PARTIAL, 'degraded', 'syncing' => 'PARTIAL',
            self::MAINTENANCE => 'MAINTENANCE',
            self::AUTH_FAILED => 'AUTH_FAILED',
            self::CONFIG_ERROR => 'CONFIG_ERROR',
            self::NETWORK_CONFIGURATION => 'NETWORK_CONFIGURATION',
            self::NOT_CONFIGURED => 'NOT_CONFIGURED',
            self::DISABLED => 'DISABLED',
            'timeout', 'no_response' => 'OFFLINE',
            self::OFFLINE => 'OFFLINE',
            default => $apiStatus ? strtoupper(str_replace(' ', '_', (string) $apiStatus)) : 'UNKNOWN',
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

        if ($err !== '' && $api !== self::ONLINE) {
            return $err;
        }

        return match ($api) {
            self::ONLINE => 'Provider berjalan normal dan siap memproses transaksi.',
            self::PARTIAL, 'degraded', 'syncing' => 'Provider masih dapat digunakan. Sebagian layanan sedang mengalami gangguan.',
            self::MAINTENANCE => 'Provider sedang dalam pemeliharaan. Sistem akan menggunakan provider cadangan jika tersedia.',
            self::AUTH_FAILED => 'Autentikasi provider gagal menurut response provider.',
            self::CONFIG_ERROR => 'Konfigurasi request/payload provider tidak valid menurut response provider.',
            self::NETWORK_CONFIGURATION => 'Konfigurasi jaringan provider (whitelist IP / firewall) bermasalah menurut response provider.',
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
