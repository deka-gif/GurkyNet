<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Transaction extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'invoice_number',
        'service_name',
        'target_number',
        'amount',
        'admin_fee',
        'total_payment',
        'payment_method',
        'status',
        'notes',
        'timeout_at',
        'provider_checked_at',
        'provider_last_status',
        'fulfillment_provider_code',
        'provider_sku_used',
        'provider_ref',
        'refunded_at',
        'refund_reference',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'admin_fee' => 'decimal:2',
        'total_payment' => 'decimal:2',
        'timeout_at' => 'datetime',
        'provider_checked_at' => 'datetime',
        'refunded_at' => 'datetime',
    ];

    /**
     * Relationship: Transaction belongs to a User.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relationship: Transaction has many TransactionItems.
     */
    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    /**
     * Relationship: Transaction has one PaymentHistory record.
     */
    public function paymentHistory(): HasOne
    {
        return $this->hasOne(PaymentHistory::class);
    }

    /**
     * Relationship: Transaction has one MidtransTransaction record.
     */
    public function midtransTransaction(): HasOne
    {
        return $this->hasOne(MidtransTransaction::class);
    }

    /**
     * Relationship: Transaction has one DigiflazzTransaction record.
     */
    public function digiflazzTransaction(): HasOne
    {
        return $this->hasOne(DigiflazzTransaction::class);
    }
}
