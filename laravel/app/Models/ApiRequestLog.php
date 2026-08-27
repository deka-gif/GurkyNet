<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApiRequestLog extends Model
{
    protected $fillable = [
        'partner_id', 'endpoint', 'method', 'request_hash', 'idempotency_key',
        'response_status', 'latency_ms', 'error_class', 'sandbox',
    ];

    protected $casts = ['sandbox' => 'boolean'];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(ApiPartner::class, 'partner_id');
    }
}
