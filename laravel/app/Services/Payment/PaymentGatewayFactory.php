<?php

namespace App\Services\Payment;

use App\Contracts\Payment\PaymentGatewayInterface;
use InvalidArgumentException;

class PaymentGatewayFactory
{
    public function __construct(
        protected MidtransPaymentGateway $midtrans
    ) {}

    public function make(string $driver = 'midtrans'): PaymentGatewayInterface
    {
        return match (strtolower($driver)) {
            'midtrans' => $this->midtrans,
            default => throw new InvalidArgumentException("Unsupported payment gateway [{$driver}]."),
        };
    }

    public function default(): PaymentGatewayInterface
    {
        return $this->make((string) config('services.payment.default', 'midtrans'));
    }
}
