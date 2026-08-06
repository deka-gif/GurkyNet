<?php

namespace App\Exceptions\Payment;

use RuntimeException;

class PaymentGatewayNotConfiguredException extends RuntimeException
{
    public const CODE = 'MIDTRANS_NOT_CONFIGURED';

    public function __construct(
        string $message = 'Metode pembayaran belum tersedia. Midtrans belum dikonfigurasi.'
    ) {
        parent::__construct($message);
    }

    public function errorCode(): string
    {
        return self::CODE;
    }
}
