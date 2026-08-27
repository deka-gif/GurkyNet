<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * FR-KYC-02..05 / SRS Bagian 21 — KYC Tier 2 submission & review record.
 */
class KycVerification extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const TIER_2 = 2;

    protected $fillable = [
        'user_id',
        'tier',
        'ktp_full_name',
        'ktp_number',
        'ktp_photo_path',
        'selfie_photo_path',
        'bank_name',
        'bank_account_name',
        'bank_account_number',
        'status',
        'rejection_reason',
        'reviewed_by',
        'submitted_at',
        'reviewed_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'tier' => 'integer',
    ];

    protected $hidden = [
        'ktp_number',
        'ktp_photo_path',
        'selfie_photo_path',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }
}
