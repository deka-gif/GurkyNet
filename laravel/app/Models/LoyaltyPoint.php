<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** FR-DIFF-01 / SRS 12.2 — per-user loyalty point balance + tier state. */
class LoyaltyPoint extends Model
{
    protected $table = 'loyalty_points';

    protected $fillable = [
        'user_id',
        'points_balance',
        'points_held_clawback',
        'current_tier',
        'grace_anchor_month',
    ];

    protected $casts = [
        'points_balance' => 'integer',
        'points_held_clawback' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
