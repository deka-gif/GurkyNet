<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OtpCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'phone_number',
        'code',
        'action',
        'channel',
        'is_used',
        'attempt_count',
        'max_attempts',
        'expires_at',
        'resend_available_at',
        'meta',
    ];

    protected $casts = [
        'is_used' => 'boolean',
        'expires_at' => 'datetime',
        'resend_available_at' => 'datetime',
        'meta' => 'array',
    ];
}
