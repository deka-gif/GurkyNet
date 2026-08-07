<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Conversation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'assigned_agent_id',
        'status',
        'subject',
        'last_message_at',
        'last_message_preview',
        'unread_user',
        'unread_agent',
        'support_ticket_id',
        'transaction_id',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'unread_user' => 'integer',
        'unread_agent' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignedAgent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_agent_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'support_ticket_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function escalations(): HasMany
    {
        return $this->hasMany(SupportEscalation::class);
    }
}
