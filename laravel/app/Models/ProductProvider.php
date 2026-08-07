<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductProvider extends Model
{
    public const CODE_DIGIFLAZZ = 'digiflazz';
    public const CODE_VIP = 'vip';

    protected $fillable = [
        'code',
        'name',
        'logo',
        'is_active',
        // Control Center partner mode: online | maintenance | offline
        'partner_status',
        'sort_order',
        'priority',
        'api_status',
        'health_color',
        'balance',
        'provider_profile',
        'product_count',
        'last_sync_at',
        'last_health_check_at',
        'avg_response_ms',
        'success_rate',
        'failed_transactions_today',
        'transactions_today',
        'last_success_at',
        'last_failure_at',
        'last_error',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'priority' => 'integer',
        'balance' => 'decimal:2',
        'provider_profile' => 'array',
        'success_rate' => 'decimal:2',
        'product_count' => 'integer',
        'avg_response_ms' => 'integer',
        'failed_transactions_today' => 'integer',
        'transactions_today' => 'integer',
        'last_sync_at' => 'datetime',
        'last_health_check_at' => 'datetime',
        'last_success_at' => 'datetime',
        'last_failure_at' => 'datetime',
    ];

    public function isPartnerMaintenance(): bool
    {
        // Maintenance only applies while powered ON (products stay visible, buy disabled).
        return $this->is_active
            && strtolower((string) ($this->partner_status ?? 'online')) === 'maintenance';
    }

    public function isPartnerOffline(): bool
    {
        // Catalog offline follows Control Center power (is_active).
        // partner_status=offline is kept in sync by Provider Management / disable().
        return !$this->is_active;
    }

    public function isPartnerSellable(): bool
    {
        return $this->is_active && !$this->isPartnerMaintenance();
    }

    protected static function booted(): void
    {
        static::updating(function (ProductProvider $provider) {
            if (!$provider->isDirty('is_active')) {
                return;
            }

            $old = $provider->getOriginal('is_active');
            $new = $provider->is_active;

            // Keep partner_status aligned with Control Center power switch.
            if ($new) {
                if (strtolower((string) ($provider->partner_status ?? '')) === 'offline') {
                    $provider->partner_status = 'online';
                }
            } else {
                $provider->partner_status = 'offline';
            }

            $trace = collect(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 25))
                ->map(function (array $frame) {
                    $file = $frame['file'] ?? '?';
                    $line = $frame['line'] ?? '?';
                    $fn = ($frame['class'] ?? '') . ($frame['type'] ?? '') . ($frame['function'] ?? '');

                    return $file . ':' . $line . ' ' . $fn;
                })
                ->all();

            \Illuminate\Support\Facades\Log::warning('EXEC TRACE — product_providers.is_active CHANGE', [
                'Provider ID' => $provider->id,
                'code' => $provider->code,
                'OLD VALUE' => $old,
                'NEW VALUE' => $new,
                'partner_status' => $provider->partner_status,
                'Call stack' => $trace,
            ]);
        });
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'product_provider_id');
    }

    public function skus(): HasMany
    {
        return $this->hasMany(ProductProviderSku::class, 'product_provider_id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(ProductProviderLog::class, 'product_provider_id');
    }

    public function scopeEnabled($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByPriority($query)
    {
        return $query->orderBy('priority')->orderBy('sort_order');
    }

    public static function findByCode(string $code): ?self
    {
        return static::query()->where('code', $code)->first();
    }

    public static function digiflazz(): ?self
    {
        return static::findByCode(self::CODE_DIGIFLAZZ);
    }

    public static function vip(): ?self
    {
        return static::findByCode(self::CODE_VIP);
    }

    /**
     * Display name for the VIP product provider brand (DB → setting → config).
     */
    public static function vipDisplayName(): string
    {
        $fromDb = static::vip()?->name;
        if (is_string($fromDb) && trim($fromDb) !== '') {
            return $fromDb;
        }

        $fromSetting = \App\Models\Setting::where('key', 'ppob_vip_display_name')->value('value');
        if (is_string($fromSetting) && trim($fromSetting) !== '') {
            return $fromSetting;
        }

        return (string) config('ppob.product_providers.vip.name', 'VIPAYMENT');
    }
}
