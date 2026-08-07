<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HomepageBuilderDraft extends Model
{
    protected $fillable = [
        'key',
        'payload',
        'is_dirty',
        'updated_by',
    ];

    protected $casts = [
        'payload' => 'array',
        'is_dirty' => 'boolean',
    ];

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
