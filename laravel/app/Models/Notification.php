<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Notification extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'title',
        'message',
        'type',
        'cover_media_id',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'cover_media_id' => 'integer',
    ];

    public function coverMedia()
    {
        return $this->belongsTo(Media::class, 'cover_media_id');
    }

    /**
     * Relationship: A notification can have many personal reads/user connections.
     */
    public function userNotifications(): HasMany
    {
        return $this->hasMany(UserNotification::class);
    }
}

