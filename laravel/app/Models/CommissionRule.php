<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** SRS 31.3 — commission_rules */
class CommissionRule extends Model
{
    protected $fillable = [
        'level',
        'percentage',
        'effective_from',
        'is_current',
        'updated_by',
        'reason',
    ];

    protected $casts = [
        'level' => 'integer',
        'percentage' => 'decimal:4',
        'effective_from' => 'datetime',
        'is_current' => 'boolean',
    ];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
