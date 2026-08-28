<?php

namespace App\Exceptions\Payment;

use RuntimeException;

/**
 * FR-USR03 — user-safe top-up payment errors. Never includes secrets or stack traces.
 */
class TopUpPaymentException extends RuntimeException
{
    public const PAYMENT_FAILED = 'TOPUP_PAYMENT_FAILED';

    public const CHANNEL_UNAVAILABLE = 'TOPUP_CHANNEL_UNAVAILABLE';

    public function __construct(
        string $message,
        protected string $errorCode = self::PAYMENT_FAILED,
        protected int $httpStatus = 422
    ) {
        parent::__construct($message);
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    public function httpStatus(): int
    {
        return $this->httpStatus;
    }
}
