<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

/** SRS 30.3 — api_credentials */
class ApiCredential extends Model
{
    protected $fillable = [
        'partner_id', 'api_key', 'secret_encrypted', 'secret_hint',
        'callback_url', 'is_sandbox', 'is_active', 'revoked_at', 'created_by',
    ];

    protected $casts = [
        'is_sandbox' => 'boolean',
        'is_active' => 'boolean',
        'revoked_at' => 'datetime',
    ];

    protected $hidden = ['secret_encrypted'];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(ApiPartner::class, 'partner_id');
    }

    public function plainSecret(): string
    {
        return Crypt::decryptString($this->secret_encrypted);
    }

    public function isUsable(): bool
    {
        return $this->is_active && $this->revoked_at === null;
    }
}
