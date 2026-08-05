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
        'sort_order',
        'priority',
        'api_status',
        'health_color',
        'balance',
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
