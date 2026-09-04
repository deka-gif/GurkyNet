<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $rawStatus = (string) $this->status;
        $normalizedStatus = $rawStatus;
        if (in_array($rawStatus, ['success', 'sukses'], true)) {
            $normalizedStatus = 'success';
        } elseif ($rawStatus === 'expired') {
            // Keep expired distinct so Top Up UX can show "Pembayaran Kedaluwarsa".
            $normalizedStatus = 'expired';
        } elseif (in_array($rawStatus, ['failed', 'gagal'], true)) {
            $normalizedStatus = 'failed';
        } elseif (in_array($rawStatus, ['canceled', 'cancelled', 'batal'], true)) {
            $normalizedStatus = 'cancelled';
        } elseif (in_array($rawStatus, ['REFUNDED', 'refunded'], true)) {
            $normalizedStatus = 'refunded';
        } elseif (in_array(strtolower($rawStatus), ['processing'], true)) {
            $normalizedStatus = 'processing';
        } elseif (in_array(strtolower($rawStatus), ['pending'], true)) {
            $normalizedStatus = 'pending';
        } else {
            $normalizedStatus = 'pending';
        }

        $payload = [
            'id' => $this->id,
            'transactionCode' => $this->invoice_number,
            'serviceName' => $this->service_name,
            'productName' => $this->service_name,
            'targetNo' => $this->target_number,
            'amount' => (float) $this->amount,
            'adminFee' => (float) $this->admin_fee,
            'totalPayment' => (float) $this->total_payment,
            'paymentMethod' => $this->payment_method,
            // Keep legacy UI-normalized status; expose SRS vocabulary separately (14.3).
            'status' => $normalizedStatus,
            'statusRaw' => $rawStatus,
            'status_srs' => TransactionStatusMapper::toSrs($rawStatus),
            'notes' => $this->notes,
            'items' => TransactionItemResource::collection($this->whenLoaded('items')),
            'date' => $this->created_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];

        if ($this->exposesInternalFulfillment($request)) {
            $payload['providerCode'] = $this->fulfillment_provider_code;
            $payload['providerName'] = $this->fulfillment_provider_code;
        }

        // FR-TOPUP-UX-01 — payment resume only for authenticated owner on detail payloads.
        if ($this->shouldExposePaymentResume($request)) {
            $payload['paymentResume'] = $this->buildPaymentResume();
        }

        return $payload;
    }

    protected function exposesInternalFulfillment(Request $request): bool
    {
        $user = $request->user();
        if ($user === null) {
            return false;
        }

        $role = $user->role instanceof UserRole
            ? $user->role
            : UserRole::tryFrom((string) $user->role);

        return $role !== null && $role !== UserRole::USER;
    }

    protected function shouldExposePaymentResume(Request $request): bool
    {
        if (! ($this->resource->expose_payment_resume ?? false)) {
            return false;
        }

        $user = $request->user();
        if ($user === null) {
            return false;
        }

        return (int) $this->user_id === (int) $user->id;
    }

    /**
     * @return array{
     *   canResume: bool,
     *   snapToken: ?string,
     *   orderId: ?string,
     *   midtransStatus: ?string,
     *   reason: ?string
     * }
     */
    protected function buildPaymentResume(): array
    {
        $isTopUp = TransactionStatusMapper::isWalletTopUp($this->resource);
        $raw = strtolower(trim((string) $this->status));
        $mt = $this->relationLoaded('midtransTransaction')
            ? $this->midtransTransaction
            : $this->midtransTransaction()->first();

        $orderId = $mt?->order_id ?? $this->invoice_number;
        $mtStatus = strtolower(trim((string) ($mt?->transaction_status ?? '')));
        $snapToken = $mt?->snap_token ? (string) $mt->snap_token : null;

        $localTerminal = in_array($raw, [
            'success', 'sukses', 'failed', 'gagal', 'expired', 'canceled', 'cancelled', 'refunded',
        ], true);

        $mtTerminal = in_array($mtStatus, [
            'settlement', 'capture', 'expire', 'cancel', 'deny', 'failure', 'failed',
            'refund', 'partial_refund',
        ], true);

        $localOpen = in_array($raw, ['pending', 'processing'], true);

        if (! $isTopUp) {
            return [
                'canResume' => false,
                'snapToken' => null,
                'orderId' => $orderId,
                'midtransStatus' => $mtStatus !== '' ? $mtStatus : null,
                'reason' => 'not_topup',
            ];
        }

        if ($raw === 'expired' || $mtStatus === 'expire') {
            return [
                'canResume' => false,
                'snapToken' => null,
                'orderId' => $orderId,
                'midtransStatus' => $mtStatus !== '' ? $mtStatus : null,
                'reason' => 'expired',
            ];
        }

        if ($localTerminal || $mtTerminal) {
            return [
                'canResume' => false,
                'snapToken' => null,
                'orderId' => $orderId,
                'midtransStatus' => $mtStatus !== '' ? $mtStatus : null,
                'reason' => 'terminal',
            ];
        }

        if (! $localOpen || ! $snapToken) {
            return [
                'canResume' => false,
                'snapToken' => null,
                'orderId' => $orderId,
                'midtransStatus' => $mtStatus !== '' ? $mtStatus : null,
                'reason' => 'unavailable',
            ];
        }

        return [
            'canResume' => true,
            'snapToken' => $snapToken,
            'orderId' => $orderId,
            'midtransStatus' => $mtStatus !== '' ? $mtStatus : 'pending',
            'reason' => null,
        ];
    }
}
