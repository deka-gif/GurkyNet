<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** SRS 31.3 — referral_codes */
class ReferralCode extends Model
{
    protected $fillable = [
        'user_id',
        'code',
        'is_custom',
    ];

    protected $casts = [
        'is_custom' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
