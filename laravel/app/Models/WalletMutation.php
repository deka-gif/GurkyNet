<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * SRS 7.6 / 14.2 / 14.3 — wallet mutation ledger (source ledger for balance changes).
 */
class WalletMutation extends Model
{
    protected $fillable = [
        'wallet_id',
        'type',
        'amount',
        'reference_id',
        'approved_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public const TYPE_TOPUP = 'topup';
    public const TYPE_PURCHASE = 'purchase';
    public const TYPE_REFUND = 'refund';
    public const TYPE_WITHDRAW = 'withdraw';
    public const TYPE_ADJUSTMENT = 'adjustment';
    public const TYPE_HOLD = 'hold';
    public const TYPE_LOYALTY_REDEEM = 'loyalty_redeem';
    public const TYPE_REFERRAL_COMMISSION = 'referral_commission';

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
