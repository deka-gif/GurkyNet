<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** FR-FIN-10 — baris persentase dalam satu rule set. */
class RevenueAllocationRuleLine extends Model
{
    protected $fillable = [
        'rule_set_id',
        'category_id',
        'percentage',
    ];

    protected $casts = [
        'percentage' => 'decimal:4',
    ];

    public function ruleSet(): BelongsTo
    {
        return $this->belongsTo(RevenueAllocationRuleSet::class, 'rule_set_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(RevenueAllocationCategory::class, 'category_id');
    }
}
