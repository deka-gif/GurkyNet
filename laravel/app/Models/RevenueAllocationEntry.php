<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** FR-FIN-10 — snapshot alokasi per transaksi. */
class RevenueAllocationEntry extends Model
{
    public const STATUS_POSTED = 'posted';

    public const STATUS_REVERSED = 'reversed';

    public const STATUS_SKIPPED = 'skipped';

    protected $fillable = [
        'transaction_id',
        'rule_set_id',
        'admin_fee_component',
        'margin_component',
        'gross_allocable',
        'status',
        'skip_reason',
        'posted_at',
        'reversed_at',
        'reverse_reason',
        'refund_reference',
    ];

    protected $casts = [
        'admin_fee_component' => 'decimal:2',
        'margin_component' => 'decimal:2',
        'gross_allocable' => 'decimal:2',
        'posted_at' => 'datetime',
        'reversed_at' => 'datetime',
    ];

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function ruleSet(): BelongsTo
    {
        return $this->belongsTo(RevenueAllocationRuleSet::class, 'rule_set_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(RevenueAllocationEntryLine::class, 'entry_id');
    }
}
