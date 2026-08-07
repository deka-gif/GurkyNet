<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Workflow extends Model
{
    use SoftDeletes;

    public const STATUSES = [
        'waiting_cs',
        'waiting_operations',
        'waiting_finance',
        'waiting_marketing',
        'waiting_user',
        'resolved',
        'rejected',
        'cancelled',
        'closed',
    ];

    public const DIVISIONS = [
        'customer_support',
        'operations',
        'finance',
        'marketing',
        'admin',
    ];

    public const PRIORITIES = ['low', 'medium', 'high', 'critical'];

    public const OPS_CATEGORIES = [
        'provider_failure',
        'product_failure',
        'api_failure',
        'price_sync',
        'stock_sync',
        'sku_error',
        'provider_maintenance',
        'latency',
        'timeout',
        'retry_failed',
        'other_ops',
    ];

    public const FINANCE_CATEGORIES = [
        'refund_request',
        'partial_refund',
        'wallet_exception',
        'settlement_batch',
        'other_finance',
    ];

    public const MARKETING_CATEGORIES = [
        'feedback_ui',
        'feedback_promo',
        'feedback_banner',
        'feedback_voucher',
        'feedback_website',
        'feature_request',
        'complaint',
        'suggestion',
        'other_marketing',
    ];

    protected $fillable = [
        'workflow_code',
        'source',
        'category',
        'current_division',
        'status',
        'priority',
        'title',
        'description',
        'created_by',
        'owner_id',
        'assigned_to',
        'conversation_id',
        'support_ticket_id',
        'transaction_id',
        'product_id',
        'product_provider_sku_id',
        'legacy_escalation_id',
        'meta',
        'resolved_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'resolved_at' => 'datetime',
    ];

    public function events(): HasMany
    {
        return $this->hasMany(WorkflowEvent::class)->orderBy('created_at');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'support_ticket_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, ['resolved', 'rejected', 'cancelled', 'closed'], true);
    }

    public static function categoriesForDivision(string $division): array
    {
        return match ($division) {
            'operations' => self::OPS_CATEGORIES,
            'finance' => self::FINANCE_CATEGORIES,
            'marketing' => self::MARKETING_CATEGORIES,
            default => array_merge(self::OPS_CATEGORIES, self::FINANCE_CATEGORIES, self::MARKETING_CATEGORIES),
        };
    }

    public static function waitingStatusForDivision(string $division): string
    {
        return match ($division) {
            'operations' => 'waiting_operations',
            'finance' => 'waiting_finance',
            'marketing' => 'waiting_marketing',
            'customer_support' => 'waiting_cs',
            'admin' => 'waiting_cs',
            default => 'waiting_cs',
        };
    }
}
