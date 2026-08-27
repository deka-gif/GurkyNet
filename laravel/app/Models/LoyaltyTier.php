<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** FR-DIFF-08 / SRS 12.2 — loyalty_tiers master. */
class LoyaltyTier extends Model
{
    protected $fillable = [
        'tier_name',
        'min_monthly_transaction',
        'benefit_json',
        'sort_order',
    ];

    protected $casts = [
        'benefit_json' => 'array',
        'min_monthly_transaction' => 'integer',
        'sort_order' => 'integer',
    ];
}
