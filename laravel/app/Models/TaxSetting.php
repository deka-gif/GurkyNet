<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Sprint 18 — PKP/PPN scaffold (Bagian 22). Rate stays nullable. */
class TaxSetting extends Model
{
    protected $fillable = [
        'pkp_enabled',
        'ppn_rate',
        'metadata',
    ];

    protected $casts = [
        'pkp_enabled' => 'boolean',
        'ppn_rate' => 'decimal:4',
        'metadata' => 'array',
    ];

    public static function current(): self
    {
        $row = static::query()->orderByDesc('id')->first();
        if ($row) {
            return $row;
        }

        return static::create([
            'pkp_enabled' => (bool) config('tax.pkp_enabled', false),
            'ppn_rate' => null,
            'metadata' => ['note' => 'Sprint 18 scaffold — no PPN calculation'],
        ]);
    }
}
