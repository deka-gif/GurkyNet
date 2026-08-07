<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class FinanceSettlement extends Model
{
    use SoftDeletes;

    public const STATUSES = ['pending', 'processing', 'completed', 'cancelled', 'failed'];

    protected $fillable = [
        'settlement_code',
        'workflow_id',
        'gateway',
        'provider',
        'batch_number',
        'settlement_reference',
        'amount',
        'currency',
        'status',
        'notes',
        'evidence',
        'created_by',
        'reviewed_by',
        'completed_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'evidence' => 'array',
        'completed_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, ['completed', 'cancelled', 'failed'], true);
    }
}
