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
        'raw_response',
    ];

    protected $casts = [
        'raw_response' => 'array',
    ];

    /**
     * Relationship: DigiflazzTransaction belongs to a Transaction.
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
