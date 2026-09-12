<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountDeletionEvent extends Model
{
    public const EVENT_REQUESTED = 'requested';

    public const EVENT_CANCELLED = 'cancelled';

    public const EVENT_REMINDED_H7 = 'reminded_h7';

    public const EVENT_REMINDED_H1 = 'reminded_h1';

    public const EVENT_EXECUTED = 'executed';

    protected $fillable = [
        'user_id',
        'event',
        'actor',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
