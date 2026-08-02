<?php

namespace App\Events;

use App\Models\Transaction;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PaymentSettled
{
    use Dispatchable, SerializesModels;

    public Transaction $transaction;
    public array $payload;

    public function __construct(Transaction $transaction, array $payload = [])
    {
        $this->transaction = $transaction;
        $this->payload = $payload;
    }
}
