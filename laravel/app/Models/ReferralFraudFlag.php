<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** SRS 31.3 — referral_fraud_flags (flag-only, no auto-block). */
class ReferralFraudFlag extends Model
{
    public const STATUS_FLAGGED = 'flagged';
    public const STATUS_REVIEWED = 'reviewed';
    public const STATUS_DISMISSED = 'dismissed';

    protected $fillable = [
        'user_id',
        'signal',
        'evidence',
        'related_user_ids',
        'related_transaction_id',
        'status',
        'detected_at',
        'reviewed_by',
        'reviewed_at',
        'review_note',
    ];

    protected $casts = [
        'evidence' => 'array',
        'related_user_ids' => 'array',
        'detected_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function relatedTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'related_transaction_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
