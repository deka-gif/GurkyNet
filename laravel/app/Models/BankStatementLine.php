<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** FR-FIN-07 — one bank mutation row. */
class BankStatementLine extends Model
{
    protected $fillable = [
        'bank_statement_import_id',
        'transacted_on',
        'amount',
        'external_reference',
        'description',
        'match_status',
        'internal_type',
        'internal_id',
        'internal_amount',
        'evidence',
        'matched_by',
        'matched_at',
        'reconciliation_incident_id',
    ];

    protected $casts = [
        'transacted_on' => 'date',
        'amount' => 'decimal:2',
        'internal_amount' => 'decimal:2',
        'matched_at' => 'datetime',
    ];

    public function import(): BelongsTo
    {
        return $this->belongsTo(BankStatementImport::class, 'bank_statement_import_id');
    }
}
