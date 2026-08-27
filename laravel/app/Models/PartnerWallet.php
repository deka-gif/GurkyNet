<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** SRS 30.3 — partner_wallets */
class PartnerWallet extends Model
{
    protected $fillable = ['partner_id', 'balance', 'status'];

    protected $casts = ['balance' => 'decimal:2'];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(ApiPartner::class, 'partner_id');
    }

    public function mutations(): HasMany
    {
        return $this->hasMany(PartnerWalletMutation::class, 'partner_wallet_id');
    }
}
