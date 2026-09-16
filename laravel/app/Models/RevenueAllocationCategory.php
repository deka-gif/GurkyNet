<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** FR-FIN-10 — kategori alokasi pendapatan. */
class RevenueAllocationCategory extends Model
{
    protected $fillable = [
        'code',
        'name',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function ruleLines(): HasMany
    {
        return $this->hasMany(RevenueAllocationRuleLine::class, 'category_id');
    }

    public function entryLines(): HasMany
    {
        return $this->hasMany(RevenueAllocationEntryLine::class, 'category_id');
    }
}
