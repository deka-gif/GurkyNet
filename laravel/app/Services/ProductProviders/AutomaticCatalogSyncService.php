<?php

namespace App\Services\ProductProviders;

use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Runtime state + schedule resolution for automatic Digiflazz/VIPayment catalog sync.
 * Does not perform HTTP calls — only Settings/Cache + next-run math.
 */
class AutomaticCatalogSyncService
{
    public const STATE_KEY = 'ppob_catalog_auto_sync_state';

    public const LOCK_KEY = 'ppob_catalog_auto_sync_lock';

    /**
     * @return array{
     *   enabled:bool,
     *   timezone:string,
     *   daily_at:string,
     *   digiflazz_cooldown_minutes:int,
     *   retry_delay_seconds:int,
     *   max_retries:int,
     *   providers:list<string>
     * }
     */
    public function resolvedConfig(): array
    {
        $cfg = config('ppob.catalog_auto_sync', []);

        $enabledSetting = Setting::where('key', 'ppob_catalog_auto_sync_enabled')->value('value');
        $atSetting = Setting::where('key', 'ppob_catalog_auto_sync_at')->value('value');
        $tzSetting = Setting::where('key', 'ppob_catalog_auto_sync_timezone')->value('value');

        $enabled = $enabledSetting !== null
            ? filter_var($enabledSetting, FILTER_VALIDATE_BOOLEAN)
            : (bool) ($cfg['enabled'] ?? true);

        $dailyAt = is_string($atSetting) && preg_match('/^\d{1,2}:\d{2}$/', trim($atSetting))
            ? trim($atSetting)
            : (string) ($cfg['daily_at'] ?? '23:59');

        // Normalize H:i → HH:mm
        [$h, $m] = array_map('intval', explode(':', $dailyAt));
        $dailyAt = sprintf('%02d:%02d', max(0, min(23, $h)), max(0, min(59, $m)));

        $timezone = is_string($tzSetting) && $tzSetting !== ''
            ? $tzSetting
            : (string) ($cfg['timezone'] ?? config('app.timezone', 'Asia/Jakarta'));

        $providers = $cfg['providers'] ?? ['digiflazz', 'vip'];
        if (! is_array($providers)) {
            $providers = ['digiflazz', 'vip'];
        }

        return [
            'enabled' => $enabled,
            'timezone' => $timezone,
            'daily_at' => $dailyAt,
            'digiflazz_cooldown_minutes' => max(1, (int) ($cfg['digiflazz_cooldown_minutes'] ?? 5)),
            'retry_delay_seconds' => max(30, (int) ($cfg['retry_delay_seconds'] ?? 120)),
            'max_retries' => max(0, (int) ($cfg['max_retries'] ?? 2)),
            'providers' => array_values(array_map('strval', $providers)),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getState(): array
    {
        $raw = Setting::where('key', self::STATE_KEY)->value('value');
        $decoded = is_string($raw) ? json_decode($raw, true) : null;

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param  array<string, mixed>  $patch
     * @return array<string, mixed>
     */
    public function patchState(array $patch): array
    {
        $state = array_merge($this->getState(), $patch);
        Setting::updateOrCreate(
            ['key' => self::STATE_KEY],
            ['value' => json_encode($state, JSON_UNESCAPED_UNICODE)]
        );
        Cache::forget('ppob_catalog_auto_sync_status_cache');

        return $state;
    }

    public function nextSyncAt(?Carbon $from = null): Carbon
    {
        $cfg = $this->resolvedConfig();
        $tz = $cfg['timezone'];
        $from = ($from ?? now())->copy()->timezone($tz);
        [$h, $m] = array_map('intval', explode(':', $cfg['daily_at']));

        $candidate = $from->copy()->setTime($h, $m, 0);
        if ($from->greaterThanOrEqualTo($candidate)) {
            $candidate->addDay();
        }

        return $candidate;
    }

    /**
     * Control Center / API payload for the Automatic Synchronization panel.
     *
     * @return array<string, mixed>
     */
    public function statusPayload(): array
    {
        $cfg = $this->resolvedConfig();
        $state = $this->getState();
        $tz = $cfg['timezone'];
        $next = $this->nextSyncAt();

        $status = (string) ($state['status'] ?? 'idle');
        $startedAt = isset($state['started_at']) ? Carbon::parse($state['started_at'])->timezone($tz) : null;
        $finishedAt = isset($state['finished_at']) ? Carbon::parse($state['finished_at'])->timezone($tz) : null;

        $providerResults = is_array($state['providers'] ?? null) ? $state['providers'] : [];

        return [
            'enabled' => $cfg['enabled'],
            'status' => $status,
            'running' => $status === 'running',
            'schedule' => [
                'frequency' => 'Daily',
                'time' => $cfg['daily_at'],
                'timezone' => $tz,
                'display' => 'Daily '.$cfg['daily_at'].' WIB',
            ],
            'providers' => collect($cfg['providers'])->map(fn ($code) => [
                'code' => $code,
                'name' => match ($code) {
                    'digiflazz' => 'Digiflazz',
                    'vip' => 'VIPayment',
                    default => strtoupper((string) $code),
                },
                'included' => true,
                'lastResult' => $providerResults[$code] ?? null,
            ])->values()->all(),
            'step' => $state['step'] ?? null,
            'steps' => $state['steps'] ?? [],
            'startedAt' => $startedAt?->toIso8601String(),
            'finishedAt' => $finishedAt?->toIso8601String(),
            'startedDisplay' => $startedAt?->format('d M Y H:i:s'),
            'finishedDisplay' => $finishedAt?->format('d M Y H:i:s'),
            'durationSec' => $state['duration_sec'] ?? null,
            'lastStatus' => $state['last_status'] ?? $status,
            'lastError' => $state['last_error'] ?? null,
            'lastSynchronization' => [
                'at' => $finishedAt?->toIso8601String() ?? $startedAt?->toIso8601String(),
                'dateDisplay' => ($finishedAt ?? $startedAt)?->format('d M Y'),
                'timeDisplay' => ($finishedAt ?? $startedAt)?->format('H:i:s'),
                'status' => $state['last_status'] ?? ($status === 'idle' ? null : $status),
                'durationSec' => $state['duration_sec'] ?? null,
            ],
            'nextSynchronization' => [
                'at' => $next->toIso8601String(),
                'dateDisplay' => $next->format('d M Y'),
                'timeDisplay' => $next->format('H:i'),
            ],
            'digiflazzCooldownMinutes' => $cfg['digiflazz_cooldown_minutes'],
            'retryDelaySeconds' => $cfg['retry_delay_seconds'],
            'maxRetries' => $cfg['max_retries'],
            'message' => $state['message'] ?? null,
        ];
    }

    public function acquireLock(int $seconds = 1800): bool
    {
        return Cache::add(self::LOCK_KEY, now()->toIso8601String(), $seconds);
    }

    public function releaseLock(): void
    {
        Cache::forget(self::LOCK_KEY);
    }
}
