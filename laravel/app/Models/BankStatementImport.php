<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** FR-FIN-07 — CSV bank statement import batch. */
class BankStatementImport extends Model
{
    protected $fillable = [
        'import_code',
        'filename',
        'status',
        'imported_by',
        'line_count',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(BankStatementLine::class);
    }
}
