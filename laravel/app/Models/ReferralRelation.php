<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** SRS 31.3 — referral_relations (immutable after register). */
class ReferralRelation extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'downline_user_id',
        'upline_user_id',
        'level',
        'created_at',
    ];

    protected $casts = [
        'level' => 'integer',
        'created_at' => 'datetime',
    ];

    public function downline(): BelongsTo
    {
        return $this->belongsTo(User::class, 'downline_user_id');
    }

    public function upline(): BelongsTo
    {
        return $this->belongsTo(User::class, 'upline_user_id');
    }
}
