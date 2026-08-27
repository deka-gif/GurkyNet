<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Sprint 18 — server-side policy acceptance (Bagian 27.4 / 28.1). */
class PolicyAcceptance extends Model
{
    protected $fillable = [
        'user_id',
        'document_type',
        'policy_version',
        'accepted_at',
    ];

    protected $casts = [
        'accepted_at' => 'datetime',
        'policy_version' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
