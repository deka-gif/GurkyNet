<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartnerAbuseFlag extends Model
{
    public const STATUS_FLAGGED = 'flagged';

    protected $fillable = [
        'partner_id', 'signal', 'evidence', 'status', 'detected_at', 'reviewed_by',
    ];

    protected $casts = [
        'evidence' => 'array',
        'detected_at' => 'datetime',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(ApiPartner::class, 'partner_id');
    }
}
