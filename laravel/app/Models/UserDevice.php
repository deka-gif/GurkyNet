<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserDevice extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'device_uuid',
        'platform',
        'push_token',
        'push_provider',
        'app_version',
        'app_build',
        'device_model',
        'os_version',
        'user_agent',
        'is_active',
        'last_seen_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'app_build' => 'integer',
        'is_active' => 'boolean',
        'last_seen_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
