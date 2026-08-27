<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * SRS 7.7 / FR-FIN-05 — withdraw request queue (hold → Finance).
 */
class WithdrawRequest extends Model
{
    public const WORKFLOW_HOLD_QUEUE = 'hold_queue';
    public const WORKFLOW_LEGACY_DEBIT = 'legacy_debit';

    protected $fillable = [
        'user_id',
        'amount',
        'admin_fee',
        'method',
        'bank_name',
        'account_number',
        'account_holder',
        'proof_file_url',
        'status',
        'notes',
        'rejection_reason',
        'transaction_id',
        'workflow',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'admin_fee' => 'decimal:2',
        'reviewed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function totalDebit(): float
    {
        return (float) $this->amount + (float) $this->admin_fee;
    }

    public function isHoldQueue(): bool
    {
        return ($this->workflow ?: self::WORKFLOW_HOLD_QUEUE) === self::WORKFLOW_HOLD_QUEUE;
    }
}
