<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DigiflazzTransaction extends Model
{
    protected $fillable = [
        'transaction_id',
        'ref_id',
        'buyer_sku_code',
        'customer_no',
        'sn',
        'digiflazz_status',
        'rc',
        'price',
        'buyer_last_saldo',
        'tele',
        'wa',
        'message',
        'raw_response',
    ];

    protected $casts = [
        'raw_response' => 'array',
        'price' => 'integer',
        'buyer_last_saldo' => 'decimal:2',
    ];

    /**
     * Relationship: DigiflazzTransaction belongs to a Transaction.
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
