<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** SRS 31.3 — commission_ledger */
class CommissionLedger extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_RELEASED = 'released';
    public const STATUS_REVERSED = 'reversed';
    public const STATUS_FINANCE_REVIEW = 'finance_review';

    protected $table = 'commission_ledger';

    protected $fillable = [
        'upline_user_id',
        'downline_user_id',
        'source_transaction_id',
        'level',
        'amount',
        'rate_percentage',
        'status',
        'release_at',
        'released_at',
        'reversed_at',
        'wallet_mutation_id',
        'finance_review_reason',
    ];

    protected $casts = [
        'level' => 'integer',
        'amount' => 'decimal:2',
        'rate_percentage' => 'decimal:4',
        'release_at' => 'datetime',
        'released_at' => 'datetime',
        'reversed_at' => 'datetime',
    ];

    public function upline(): BelongsTo
    {
        return $this->belongsTo(User::class, 'upline_user_id');
    }

    public function downline(): BelongsTo
    {
        return $this->belongsTo(User::class, 'downline_user_id');
    }

    public function sourceTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'source_transaction_id');
    }

    public function walletMutation(): BelongsTo
    {
        return $this->belongsTo(WalletMutation::class, 'wallet_mutation_id');
    }
}
