<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OnboardingAttempt extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'phone_number',
        'password',
        'otp_code',
        'otp_expires_at',
        'otp_verified_at',
        'finalize_token_hash',
        'finalize_token_expires_at',
        'finalize_token_consumed_at',
        'status',
        'meta',
    ];

    protected $hidden = [
        'password',
        'otp_code',
        'finalize_token_hash',
    ];

    protected $casts = [
        'otp_expires_at' => 'datetime',
        'otp_verified_at' => 'datetime',
        'finalize_token_expires_at' => 'datetime',
        'finalize_token_consumed_at' => 'datetime',
        'meta' => 'array',
    ];
}
