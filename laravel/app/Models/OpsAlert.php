<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OpsAlert extends Model
{
    public const STATUSES = ['open', 'acknowledged', 'investigating', 'resolved', 'closed'];

    public const SEVERITIES = ['info', 'warning', 'critical'];

    protected $fillable = [
        'alert_code',
        'type',
        'severity',
        'title',
        'body',
        'payload',
        'status',
        'source',
        'related_type',
        'related_id',
        'workflow_id',
        'assigned_to',
        'acknowledged_at',
        'resolved_at',
        'closed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'acknowledged_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }
}
