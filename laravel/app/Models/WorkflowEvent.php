<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowEvent extends Model
{
    protected $fillable = [
        'workflow_id',
        'actor_id',
        'event_type',
        'from_division',
        'to_division',
        'from_status',
        'to_status',
        'action',
        'body',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
