<?php

namespace App\Contracts\Payment;

interface PaymentGatewayInterface
{
    public function name(): string;

    public function isConfigured(): bool;

    /**
     * Create a checkout/session token for Snap (or equivalent).
     *
     * @param  array{order_id:string,gross_amount:float|int,customer?:array,items?:array,enabled_payments?:list<string>,expiry?:array}  $payload
     * @return array{token:?string,redirect_url:?string,raw?:array}
     */
    public function createCheckout(array $payload): array;
}
