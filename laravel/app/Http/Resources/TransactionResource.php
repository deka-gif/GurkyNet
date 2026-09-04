<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use App\Support\Payments\CustomerFacingPaymentMethod;
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

        $isTopUp = TransactionStatusMapper::isWalletTopUp($this->resource);
        $notes = (string) ($this->notes ?? '');
        if ($isTopUp) {
            $notes = $this->customerFacingTopUpNotes($notes, $normalizedStatus, (float) $this->amount);
        }

        // FR-TOPUP-UX-03 — never expose gateway name "midtrans" as Metode.
        $paymentMethodLabel = CustomerFacingPaymentMethod::labelFor($this->resource);

        $payload = [
            'id' => $this->id,
            'transactionCode' => $this->invoice_number,
            'serviceName' => $this->service_name,
            'productName' => $this->service_name,
            'targetNo' => $this->target_number,
            'amount' => (float) $this->amount,
            'adminFee' => (float) $this->admin_fee,
            'totalPayment' => (float) $this->total_payment,
            'paymentMethod' => $paymentMethodLabel,
            'paymentMethodLabel' => $paymentMethodLabel,
            // Keep legacy UI-normalized status; expose SRS vocabulary separately (14.3).
            'status' => $normalizedStatus,
            'statusRaw' => $rawStatus,
            'status_srs' => TransactionStatusMapper::toSrs($rawStatus),
            'notes' => $notes,
            'items' => TransactionItemResource::collection($this->whenLoaded('items')),
            'date' => $this->created_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'lastUpdated' => $this->updated_at?->toIso8601String(),
        ];

        if ($this->exposesInternalFulfillment($request)) {
            $payload['providerCode'] = $this->fulfillment_provider_code;
            $payload['providerName'] = $this->fulfillment_provider_code;
        }

        // FR-TOPUP-UX-01 — snap_token only when midtrans relation is loaded (detail), never on list.
        if ($this->shouldExposePaymentResume($request)) {
            $payload['paymentResume'] = $this->buildPaymentResume();
        }

        return $payload;
    }

    /**
     * Customer-facing Top Up notes — never expose Midtrans/provider/routing wording.
     * FR-TOPUP-UX-02
     */
    protected function customerFacingTopUpNotes(string $notes, string $normalizedStatus, float $amount = 0): string
    {
        if (in_array($normalizedStatus, ['success'], true)) {
            return 'Top Up berhasil. Saldo Anda telah ditambahkan.';
        }
        if (in_array($normalizedStatus, ['expired'], true)) {
            $amountText = 'Rp'.number_format($amount, 0, ',', '.');

            return "Pembayaran {$amountText} telah kedaluwarsa.";
        }
        if (in_array($normalizedStatus, ['failed', 'cancelled'], true)) {
            return 'Pembayaran Top Up tidak berhasil. Saldo Anda tidak berubah.';
        }

        // pending / processing / unpaid
        return 'Menunggu pembayaran. Selesaikan pembayaran untuk menambah saldo Anda.';
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
        $user = $request->user();
        if ($user === null) {
            return false;
        }

        if ((int) $this->user_id !== (int) $user->id) {
            return false;
        }

        // List collection must not load/expose snap tokens. Detail sets relation + flag.
        if ($this->resource->expose_payment_resume ?? false) {
            return true;
        }

        return $this->relationLoaded('midtransTransaction');
    }

    /**
     * Customer-facing resume payload — only canResume + snapToken (no processor internals).
     *
     * @return array{canResume: bool, snapToken: ?string}
     */
    protected function buildPaymentResume(): array
    {
        $deny = ['canResume' => false, 'snapToken' => null];

        $isTopUp = TransactionStatusMapper::isWalletTopUp($this->resource);
        $raw = strtolower(trim((string) $this->status));
        $mt = $this->relationLoaded('midtransTransaction')
            ? $this->midtransTransaction
            : $this->midtransTransaction()->first();

        $mtStatus = strtolower(trim((string) ($mt?->transaction_status ?? '')));
        $snapToken = $mt?->snap_token ? (string) $mt->snap_token : null;

        $localTerminal = in_array($raw, [
            'success', 'sukses', 'failed', 'gagal', 'expired', 'canceled', 'cancelled', 'refunded',
        ], true);

        // Snap docs: newly created Snap orders may have no Core API transaction_status yet
        // until the customer picks a payment method. Empty / unknown ≠ terminal.
        $mtTerminal = in_array($mtStatus, [
            'settlement', 'capture', 'expire', 'cancel', 'deny', 'failure', 'failed',
            'refund', 'partial_refund',
        ], true);

        $localOpen = in_array($raw, ['pending', 'processing'], true);

        if (! $isTopUp) {
            return $deny;
        }

        if ($raw === 'expired' || $mtStatus === 'expire') {
            return $deny;
        }

        if ($localTerminal || $mtTerminal) {
            return $deny;
        }

        if (! $localOpen || ! $snapToken) {
            return $deny;
        }

        return [
            'canResume' => true,
            'snapToken' => $snapToken,
        ];
    }
}
