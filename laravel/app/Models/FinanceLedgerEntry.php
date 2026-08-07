<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only finance journal. Never update/delete via application APIs.
 */
class FinanceLedgerEntry extends Model
{
    public $timestamps = true;

    protected $fillable = [
        'ledger_code',
        'workflow_id',
        'user_id',
        'transaction_id',
        'payment_history_id',
        'wallet_history_id',
        'invoice',
        'source_module',
        'event_type',
        'debit',
        'credit',
        'balance_snapshot',
        'currency',
        'reference',
        'created_by',
        'meta',
    ];

    protected $casts = [
        'debit' => 'decimal:2',
        'credit' => 'decimal:2',
        'balance_snapshot' => 'decimal:2',
        'meta' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }
}
