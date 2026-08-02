<?php

namespace App\Events;

use App\Models\Wallet;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WalletDebited
{
    use Dispatchable, SerializesModels;

    public Wallet $wallet;
    public float $amount;
    public string $reason;
    public ?int $referenceId;

    public function __construct(Wallet $wallet, float $amount, string $reason, ?int $referenceId = null)
    {
        $this->wallet = $wallet;
        $this->amount = $amount;
        $this->reason = $reason;
        $this->referenceId = $referenceId;
    }
}
