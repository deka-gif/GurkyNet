<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** FR-FIN-10 — versi konfigurasi persentase alokasi. */
class RevenueAllocationRuleSet extends Model
{
    protected $fillable = [
        'is_current',
        'effective_from',
        'created_by',
        'reason',
    ];

    protected $casts = [
        'is_current' => 'boolean',
        'effective_from' => 'datetime',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(RevenueAllocationRuleLine::class, 'rule_set_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
