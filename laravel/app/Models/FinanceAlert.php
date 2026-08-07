<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceAlert extends Model
{
    public const TYPES = [
        'refund_spike',
        'negative_margin',
        'low_provider_deposit',
        'gateway_offline',
        'settlement_delay',
        'chargeback',
        'large_refund',
        'abnormal_transaction',
    ];

    public const SEVERITIES = ['info', 'warning', 'critical'];

    protected $fillable = [
        'alert_code',
        'type',
        'severity',
        'title',
        'body',
        'payload',
        'status',
        'related_type',
        'related_id',
        'workflow_id',
        'read_at',
        'resolved_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'read_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }
}
