<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** SRS 30.3 — api_partners */
class ApiPartner extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = [
        'user_id', 'nama_usaha', 'pic_name', 'pic_contact', 'tier', 'status',
        'rate_limit_per_minute', 'ip_whitelist', 'volume_notes',
        'reviewed_by', 'reviewed_at', 'review_note',
    ];

    protected $casts = [
        'ip_whitelist' => 'array',
        'reviewed_at' => 'datetime',
        'rate_limit_per_minute' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function credentials(): HasMany
    {
        return $this->hasMany(ApiCredential::class, 'partner_id');
    }

    public function wallet(): HasOne
    {
        return $this->hasOne(PartnerWallet::class, 'partner_id');
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }
}
