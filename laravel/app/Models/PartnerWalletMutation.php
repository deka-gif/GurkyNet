<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartnerWalletMutation extends Model
{
    public const TYPE_DEPOSIT = 'deposit';
    public const TYPE_PURCHASE = 'purchase';
    public const TYPE_REFUND = 'refund';
    public const TYPE_ADJUSTMENT = 'adjustment';

    protected $fillable = [
        'partner_wallet_id', 'type', 'amount', 'reference_id', 'approved_by',
    ];

    protected $casts = ['amount' => 'decimal:2'];

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(PartnerWallet::class, 'partner_wallet_id');
    }
}
