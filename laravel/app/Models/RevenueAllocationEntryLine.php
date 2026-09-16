<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** FR-FIN-10 — baris snapshot alokasi per kategori. */
class RevenueAllocationEntryLine extends Model
{
    protected $fillable = [
        'entry_id',
        'category_id',
        'percentage_snapshot',
        'amount',
    ];

    protected $casts = [
        'percentage_snapshot' => 'decimal:4',
        'amount' => 'decimal:2',
    ];

    public function entry(): BelongsTo
    {
        return $this->belongsTo(RevenueAllocationEntry::class, 'entry_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(RevenueAllocationCategory::class, 'category_id');
    }
}
