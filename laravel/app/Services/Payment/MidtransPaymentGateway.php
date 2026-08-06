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

        // TODO: When keys are present, this path is production Midtrans Snap.
        $response = $this->midtrans->createSnapTransaction(
            (string) $payload['order_id'],
            (float) $payload['gross_amount'],
            $payload['customer'] ?? [],
            $payload['items'] ?? []
        );

        return [
            'token' => $response['token'] ?? null,
            'redirect_url' => $response['redirect_url'] ?? null,
            'raw' => $response,
        ];
    }
}
