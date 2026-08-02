<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MidtransTransaction extends Model
{
    protected $fillable = [
        'transaction_id',
        'order_id',
        'snap_token',
        'payment_type',
        'gross_amount',
        'transaction_status',
        'raw_notification',
    ];

    protected $casts = [
        'gross_amount' => 'decimal:2',
        'raw_notification' => 'array',
    ];

    /**
     * Relationship: MidtransTransaction belongs to a Transaction.
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
