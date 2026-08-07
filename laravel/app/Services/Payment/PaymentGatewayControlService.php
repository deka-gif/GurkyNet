<?php

namespace App\Services\Payment;

use App\Models\ActivityLog;
use App\Models\Setting;
use App\Services\ProductProviders\ProviderHealthStatus;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * Payment Gateway Control Center — Midtrans / future gateways (Tripay, Xendit, …).
 * Never mixed with Product Provider (Digiflazz / VIP) PPOB routing.
 */
class PaymentGatewayControlService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function listControlCenter(): array
    {
        return $this->collectGateways()->values()->all();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function collectGateways(): Collection
    {
        $cards = collect();
        $priority = 1;

        foreach ((array) config('ppob.payment_gateways', []) as $code => $meta) {
            $code = strtolower((string) $code);
            $cards->push($this->toCard($code, is_array($meta) ? $meta : [], $priority));
            $priority++;
        }

        return $cards->sortBy('priority')->values();
    }

    /**
     * @return array<string, mixed>
     */
    public function show(string $code): array
    {
        $code = $this->normalizeCode($code);
        $card = $this->collectGateways()->first(fn (array $c) => strtolower((string) $c['code']) === $code);
        if (! $card) {
            throw ValidationException::withMessages([
                'code' => ['Payment gateway tidak ditemukan.'],
            ]);
        }

        return $card;
    }

    /**
     * Power ON — allows wallet top-up via this gateway when credentials exist.
     *
     * @return array<string, mixed>
     */
    public function enable(string $code): array
    {
        $code = $this->normalizeCode($code);
        $this->assertIntegrated($code);

        if (! $this->isConfigured($code)) {
            throw ValidationException::withMessages([
                'code' => ['Kredensial gateway belum dikonfigurasi. Periksa Server Key / Client Key di System Settings.'],
            ]);
        }

        $this->writeStatus($code, 'online');
        $this->log($code, 'PAYMENT_GATEWAY_ENABLE', ['status' => 'online']);

        return $this->show($code);
    }

    /**
     * Power OFF — no new top-up sessions via this gateway.
     *
     * @return array<string, mixed>
     */
    public function disable(string $code): array
    {
        $code = $this->normalizeCode($code);
        $this->assertIntegrated($code);

        $this->writeStatus($code, 'offline');
        $this->log($code, 'PAYMENT_GATEWAY_DISABLE', ['status' => 'offline']);

        return $this->show($code);
    }

    /**
     * @return array<string, mixed>
     */
    public function setMaintenance(string $code): array
    {
        $code = $this->normalizeCode($code);
        $this->assertIntegrated($code);

        $this->writeStatus($code, 'maintenance');
        $this->log($code, 'PAYMENT_GATEWAY_MAINTENANCE', ['status' => 'maintenance']);

        return $this->show($code);
    }

    /**
     * @return array<string, mixed>
     */
    public function setPriority(string $code, int $priority): array
    {
        $code = $this->normalizeCode($code);
        $this->assertIntegrated($code);

        $priority = max(1, min(99, $priority));
        Setting::updateOrCreate(
            ['key' => $this->priorityKey($code)],
            ['value' => (string) $priority]
        );
        $this->log($code, 'PAYMENT_GATEWAY_SET_PRIORITY', ['priority' => $priority]);

        return $this->show($code);
    }

    /**
     * Probe real credential / config state (no fake health).
     *
     * @return array<string, mixed>
     */
    public function healthCheck(string $code): array
    {
        $code = $this->normalizeCode($code);
        $this->assertIntegrated($code);

        $configured = $this->isConfigured($code);
        $stored = $this->readStatus($code);

        if ($stored === 'maintenance') {
            // Leave ops maintenance mode intact.
        } elseif ($stored === 'offline') {
            // Leave powered-off state intact; still report probe outcome in log.
        } elseif ($configured) {
            $this->writeStatus($code, 'online');
        } else {
            $this->writeStatus($code, 'offline');
        }

        Setting::updateOrCreate(
            ['key' => $this->lastHealthKey($code)],
            ['value' => now()->toIso8601String()]
        );

        $this->log($code, 'PAYMENT_GATEWAY_HEALTH_CHECK', [
            'configured' => $configured,
            'status' => $this->readStatus($code),
        ]);

        return $this->show($code);
    }

    /**
     * Refresh health for all integrated gateways.
     *
     * @return list<array<string, mixed>>
     */
    public function refreshAll(): array
    {
        $out = [];
        foreach ($this->integratedCodes() as $code) {
            try {
                $out[] = $this->healthCheck($code);
            } catch (\Throwable $e) {
                $out[] = ['code' => $code, 'error' => $e->getMessage()];
            }
        }

        return $out;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function logs(string $code, int $limit = 50): array
    {
        $code = $this->normalizeCode($code);

        return ActivityLog::query()
            ->where('activity', 'like', 'PAYMENT_GATEWAY_%')
            ->orderByDesc('id')
            ->limit(max(1, min(100, $limit)))
            ->get()
            ->filter(function (ActivityLog $log) use ($code) {
                $payload = is_array($log->payload) ? $log->payload : [];

                return strtolower((string) ($payload['code'] ?? '')) === $code;
            })
            ->values()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'eventType' => $log->activity,
                'payload' => $log->payload,
                'createdAt' => optional($log->created_at)?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    protected function toCard(string $code, array $meta, int $defaultPriority): array
    {
        $integrated = in_array($code, $this->integratedCodes(), true);
        $configured = $integrated && $this->isConfigured($code);
        $stored = $integrated ? $this->readStatus($code) : 'offline';
        $priority = $this->readPriority($code, $defaultPriority);
        $lastHealth = Setting::where('key', $this->lastHealthKey($code))->value('value');

        if (! $integrated) {
            return [
                'id' => $code,
                'code' => $code,
                'name' => (string) ($meta['name'] ?? ucfirst($code)),
                'type' => 'payment_gateway',
                'integrated' => false,
                'enabled' => false,
                'status' => 'Belum Diintegrasikan',
                'partnerStatus' => 'offline',
                'apiStatus' => 'not_configured',
                'apiStatusLabel' => 'Belum Diintegrasikan',
                'healthColor' => 'red',
                'healthLabel' => 'Tidak Aktif',
                'statusDescription' => 'Gateway ini belum diintegrasikan ke GurkyNet. Konfigurasi tersedia setelah integrasi selesai.',
                'priority' => $priority,
                'balance' => null,
                'avgResponseMs' => null,
                'responseTime' => null,
                'lastSyncAt' => null,
                'lastSyncDisplay' => null,
                'lastHealthCheckAt' => $lastHealth,
                'supportedServices' => ['Top Up Saldo'],
                'controlsCatalogAlone' => false,
                'note' => 'Payment Gateway — bukan Product Provider PPOB.',
            ];
        }

        if ($stored === 'maintenance') {
            $status = 'Maintenance';
            $apiStatus = 'maintenance';
            $healthColor = 'orange';
            $description = 'Payment gateway sedang dalam pemeliharaan. Top up saldo sementara tidak diproses melalui gateway ini.';
            $healthLabel = 'Maintenance';
        } elseif ($stored === 'offline' || ! $configured) {
            $status = $configured ? 'Offline' : 'Belum Dikonfigurasi';
            $apiStatus = $configured ? 'offline' : 'not_configured';
            $healthColor = 'red';
            $description = $configured
                ? 'Payment gateway dimatikan atau tidak dapat digunakan. Top up saldo tidak dikirim ke gateway ini.'
                : 'Kredensial Midtrans belum dikonfigurasi. Periksa Server Key dan Client Key.';
            $healthLabel = 'Tidak Aktif';
        } else {
            $status = 'Online';
            $apiStatus = 'online';
            $healthColor = 'green';
            $description = 'Payment gateway berjalan normal dan siap memproses top up saldo.';
            $healthLabel = 'Sehat';
        }

        return [
            'id' => $code,
            'code' => $code,
            'name' => (string) ($meta['name'] ?? config('ppob.payment_gateways.'.$code.'.name') ?: ucfirst($code)),
            'type' => 'payment_gateway',
            'integrated' => true,
            'enabled' => $stored !== 'offline' && $configured,
            'status' => $status,
            'partnerStatus' => $stored,
            'apiStatus' => $apiStatus,
            'apiStatusLabel' => ProviderHealthStatus::labelFor($apiStatus),
            'healthColor' => $healthColor,
            'healthLabel' => $healthLabel,
            'statusDescription' => $description,
            'priority' => $priority,
            'balance' => null,
            'avgResponseMs' => null,
            'responseTime' => null,
            'lastSyncAt' => null,
            'lastSyncDisplay' => null,
            'lastHealthCheckAt' => $lastHealth,
            'supportedServices' => ['Top Up Saldo', 'QRIS', 'Virtual Account', 'E-Wallet'],
            'controlsCatalogAlone' => false,
            'note' => 'Digunakan hanya untuk top up saldo pengguna — bukan transaksi PPOB.',
        ];
    }

    /**
     * @return list<string>
     */
    protected function integratedCodes(): array
    {
        // Only Midtrans is live-integrated today; others appear as future slots.
        return ['midtrans'];
    }

    protected function assertIntegrated(string $code): void
    {
        if (! in_array($code, $this->integratedCodes(), true)) {
            throw ValidationException::withMessages([
                'code' => ['Gateway belum diintegrasikan. Tidak dapat dikonfigurasi.'],
            ]);
        }
    }

    protected function normalizeCode(string $code): string
    {
        return strtolower(str_replace(['pg-', 'payment-'], '', trim($code)));
    }

    protected function isConfigured(string $code): bool
    {
        if ($code === 'midtrans') {
            $server = (string) (config('services.midtrans.server_key') ?: env('MIDTRANS_SERVER_KEY', ''));
            $client = (string) (config('services.midtrans.client_key') ?: env('MIDTRANS_CLIENT_KEY', ''));

            return trim($server) !== '' && trim($client) !== '';
        }

        return false;
    }

    protected function statusKey(string $code): string
    {
        return 'partner_'.$code.'_status';
    }

    protected function priorityKey(string $code): string
    {
        return 'payment_gateway_priority_'.$code;
    }

    protected function lastHealthKey(string $code): string
    {
        return 'payment_gateway_last_health_'.$code;
    }

    protected function readStatus(string $code): string
    {
        $stored = strtolower((string) (Setting::where('key', $this->statusKey($code))->value('value') ?? ''));
        if (! in_array($stored, ['online', 'maintenance', 'offline'], true)) {
            return $this->isConfigured($code) ? 'online' : 'offline';
        }

        return $stored;
    }

    protected function writeStatus(string $code, string $status): void
    {
        Setting::updateOrCreate(
            ['key' => $this->statusKey($code)],
            ['value' => $status]
        );
    }

    protected function readPriority(string $code, int $default): int
    {
        $raw = Setting::where('key', $this->priorityKey($code))->value('value');
        if ($raw === null || $raw === '') {
            return $default;
        }

        return max(1, (int) $raw);
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    protected function log(string $code, string $activity, array $extra = []): void
    {
        ActivityLog::create([
            'user_id' => Auth::id(),
            'activity' => $activity,
            'payload' => array_merge(['code' => $code], $extra),
        ]);
    }
}
