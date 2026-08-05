<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentHistory extends Model
{
    protected $fillable = [
        'transaction_id',
        'gateway',
        'payment_code',
        'payload',
        'response',
        'status',
    ];

    protected $casts = [
        'payload' => 'array',
        'response' => 'array',
    ];

    /**
     * Relationship: PaymentHistory belongs to a Transaction.
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /**
     * Upsert a payment/settlement ledger row for a transaction (single source for Finance settlements).
     */
    public static function recordFor(
        Transaction $transaction,
        string $gateway,
        string $status,
        ?array $payload = null,
        ?array $response = null,
        ?string $paymentCode = null
    ): self {
        return self::updateOrCreate(
            ['transaction_id' => $transaction->id],
            [
                'gateway' => $gateway,
                'payment_code' => $paymentCode ?? $transaction->invoice_number,
                'payload' => $payload,
                'response' => $response,
                'status' => strtolower($status),
            ]
        );
    }
}
