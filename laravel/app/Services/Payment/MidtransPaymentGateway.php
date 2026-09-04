<?php

namespace App\Services\Payment;

use App\Contracts\Payment\PaymentGatewayInterface;
use App\Exceptions\Payment\PaymentGatewayNotConfiguredException;
use App\Services\MidtransService;

/**
 * Midtrans adapter.
 *
 * When MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY are empty, createCheckout()
 * throws PaymentGatewayNotConfiguredException so controllers can return a
 * clean API error instead of HTTP 500. Real Snap calls stay behind isConfigured().
 */
class MidtransPaymentGateway implements PaymentGatewayInterface
{
    public function __construct(
        protected MidtransService $midtrans
    ) {}

    public function name(): string
    {
        return 'midtrans';
    }

    public function isConfigured(): bool
    {
        return $this->midtrans->isConfigured();
    }

    public function createCheckout(array $payload): array
    {
        if (!$this->isConfigured()) {
            throw new PaymentGatewayNotConfiguredException();
        }

        $options = [];
        if (! empty($payload['enabled_payments']) && is_array($payload['enabled_payments'])) {
            $options['enabled_payments'] = $payload['enabled_payments'];
        }
        if (! empty($payload['expiry']) && is_array($payload['expiry'])) {
            $options['expiry'] = $payload['expiry'];
        }
        if (! empty($payload['finish_redirect_url']) && is_string($payload['finish_redirect_url'])) {
            $options['finish_redirect_url'] = $payload['finish_redirect_url'];
        }

        $response = $this->midtrans->createSnapTransaction(
            (string) $payload['order_id'],
            (float) $payload['gross_amount'],
            $payload['customer'] ?? [],
            $payload['items'] ?? [],
            $options
        );

        return [
            'token' => $response['token'] ?? null,
            'redirect_url' => $response['redirect_url'] ?? null,
            'raw' => $response,
        ];
    }
}
