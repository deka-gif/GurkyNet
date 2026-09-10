<?php

namespace App\Listeners;

use App\Events\TransactionCreated;
use App\Events\TransactionProcessing;
use App\Events\TransactionSuccess;
use App\Events\TransactionFailed;
use App\Events\WalletCredited;
use App\Events\WalletDebited;
use App\Events\PaymentSettled;
use App\Services\NotificationService;
use App\Support\Transactions\TransactionStatusMapper;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class SendNotification implements ShouldQueue
{
    use InteractsWithQueue;

    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    private function channelsFor($user, array $channels): array
    {
        if ($user && ($user->notify_transactions ?? true) === false) {
            return array_values(array_diff($channels, ['push']));
        }

        return $channels;
    }

    private function formatIdr(float $amount): string
    {
        return 'Rp'.number_format($amount, 0, ',', '.');
    }

    private function isTransfer(\App\Models\Transaction $tx): bool
    {
        return str_contains(strtolower((string) ($tx->service_name ?? '')), 'transfer');
    }

    private function isBillPayment(\App\Models\Transaction $tx): bool
    {
        $service = strtolower((string) ($tx->service_name ?? ''));

        foreach (['pln', 'pdam', 'bpjs', 'internet', 'tv', 'gas', 'pbb', 'multifinance', 'tagihan'] as $keyword) {
            if (str_contains($service, $keyword)) {
                return true;
            }
        }

        return false;
    }

    private function hasConfirmedRefund(\App\Models\Transaction $tx): bool
    {
        return $tx->refunded_at !== null || TransactionStatusMapper::isRefunded($tx->status);
    }

    /**
     * Customer-facing product/service label from authoritative transaction fields.
     * Prefer item.product_name, then service_name. Never surface provider internals.
     */
    private function customerFacingServiceLabel(\App\Models\Transaction $tx): string
    {
        if (! $tx->relationLoaded('items')) {
            $tx->loadMissing('items');
        }

        $fromItem = '';
        $firstItem = $tx->items->first();
        if ($firstItem && is_string($firstItem->product_name ?? null)) {
            $fromItem = trim((string) $firstItem->product_name);
        }

        $fromService = trim((string) ($tx->service_name ?? ''));
        $label = $fromItem !== '' ? $fromItem : $fromService;

        if ($label === '') {
            return '';
        }

        $blocked = ['digiflazz', 'vippayment', 'vip payment', 'midtrans', 'provider'];
        $lower = strtolower($label);
        foreach ($blocked as $needle) {
            if (str_contains($lower, $needle)) {
                return $fromService !== '' && ! str_contains(strtolower($fromService), $needle)
                    ? $fromService
                    : '';
            }
        }

        return $label;
    }

    private function amountText(\App\Models\Transaction $tx): string
    {
        return $this->formatIdr((float) $tx->amount);
    }

    private function refundSuffix(\App\Models\Transaction $tx): string
    {
        return $this->hasConfirmedRefund($tx)
            ? ' Dana telah dikembalikan ke saldo Anda.'
            : '';
    }

    private function finalPayload(\App\Models\Transaction $tx, string $kind): array
    {
        return [
            'category' => 'transaction',
            'transaction_id' => $tx->id,
            'invoice_number' => (string) $tx->invoice_number,
            'deep_link' => '/riwayat/'.$tx->id,
            // FR-NOTIF-DEDUP-01 — One transaction = maksimal satu customer final notification.
            // Outcome (SUCCESS/FAILED/EXPIRED) boleh datang berurutan/duplikat; identitas final
            // untuk inbox selalu `customer_final:{transaction_id}`.
            'dedupe_key' => 'customer_final:'.$tx->id,
        ];
    }

    /**
     * @return array{title:string,message:string,type:string,payload:array<string,mixed>}
     */
    private function successContent(\App\Models\Transaction $tx): array
    {
        $payload = $this->finalPayload($tx, 'success');
        $amount = $this->amountText($tx);
        $service = $this->customerFacingServiceLabel($tx);

        if (TransactionStatusMapper::isWalletTopUp($tx)) {
            return [
                'title' => 'Top Up Berhasil',
                'message' => 'Saldo Anda berhasil ditambahkan sebesar '.$amount.'.',
                'type' => 'transaction_success',
                'payload' => $payload,
            ];
        }

        if ($this->isTransfer($tx)) {
            return [
                'title' => 'Transfer Berhasil',
                'message' => 'Transfer sebesar '.$amount.' berhasil dilakukan.',
                'type' => 'transaction_success',
                'payload' => $payload,
            ];
        }

        if ($this->isBillPayment($tx)) {
            $label = $service !== '' ? ' tagihan '.$service : ' tagihan';

            return [
                'title' => 'Pembayaran Berhasil',
                'message' => 'Pembayaran'.$label.' sebesar '.$amount.' berhasil diselesaikan.',
                'type' => 'transaction_success',
                'payload' => $payload,
            ];
        }

        $subject = $service !== '' ? $service.' sebesar '.$amount : 'sebesar '.$amount;

        return [
            'title' => 'Pembelian Berhasil',
            'message' => 'Pembelian '.$subject.' berhasil diproses.',
            'type' => 'transaction_success',
            'payload' => $payload,
        ];
    }

    /**
     * @return array{title:string,message:string,type:string,payload:array<string,mixed>}
     */
    private function failureContent(\App\Models\Transaction $tx): array
    {
        $payload = $this->finalPayload(
            $tx,
            strtolower((string) $tx->status) === \App\Enums\TransactionStatus::EXPIRED->value ? 'expired' : 'failed'
        );
        $amount = $this->amountText($tx);
        $service = $this->customerFacingServiceLabel($tx);
        $refund = $this->refundSuffix($tx);

        if (strtolower((string) $tx->status) === \App\Enums\TransactionStatus::EXPIRED->value) {
            if (TransactionStatusMapper::isWalletTopUp($tx)) {
                $context = 'top up sebesar '.$amount;
            } elseif ($this->isTransfer($tx)) {
                $context = 'transfer sebesar '.$amount;
            } elseif ($this->isBillPayment($tx)) {
                $context = $service !== ''
                    ? 'tagihan '.$service.' sebesar '.$amount
                    : 'tagihan sebesar '.$amount;
            } else {
                $context = $service !== ''
                    ? $service.' sebesar '.$amount
                    : 'sebesar '.$amount;
            }

            return [
                'title' => 'Pembayaran Kedaluwarsa',
                'message' => 'Pembayaran '.$context.' tidak diselesaikan dalam batas waktu yang ditentukan.',
                'type' => 'transaction_failed',
                'payload' => $payload,
            ];
        }

        if (TransactionStatusMapper::isWalletTopUp($tx)) {
            return [
                'title' => 'Top Up Tidak Berhasil',
                'message' => 'Top up saldo sebesar '.$amount.' tidak dapat diproses.'.$refund,
                'type' => 'transaction_failed',
                'payload' => $payload,
            ];
        }

        if ($this->isTransfer($tx)) {
            return [
                'title' => 'Transfer Tidak Berhasil',
                'message' => 'Transfer sebesar '.$amount.' tidak dapat diproses.'.$refund,
                'type' => 'transaction_failed',
                'payload' => $payload,
            ];
        }

        if ($this->isBillPayment($tx)) {
            $label = $service !== '' ? ' tagihan '.$service : ' tagihan';

            return [
                'title' => 'Pembayaran Gagal',
                'message' => 'Pembayaran'.$label.' sebesar '.$amount.' tidak dapat diproses.'.$refund,
                'type' => 'transaction_failed',
                'payload' => $payload,
            ];
        }

        $subject = $service !== '' ? $service.' sebesar '.$amount : 'sebesar '.$amount;

        return [
            'title' => 'Pembelian Gagal',
            'message' => 'Pembelian '.$subject.' tidak dapat diproses.'.$refund,
            'type' => 'transaction_failed',
            'payload' => $payload,
        ];
    }

    /**
     * Handle the event.
     */
    public function handle(mixed $event): void
    {
        Log::info('SendNotification listener handling event: '.get_class($event));

        if ($event instanceof TransactionCreated) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                Log::info('SEND NOTIFICATION — skipped TransactionCreated (internal lifecycle only)', [
                    'transaction_id' => $tx->id,
                    'invoice' => $tx->invoice_number,
                ]);
            }
        } elseif ($event instanceof TransactionProcessing) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                Log::info('SEND NOTIFICATION — skipped TransactionProcessing (internal lifecycle only)', [
                    'transaction_id' => $tx->id,
                    'invoice' => $tx->invoice_number,
                ]);
            }
        } elseif ($event instanceof TransactionSuccess) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                $content = $this->successContent($tx);
                Log::info('SEND NOTIFICATION — final success notification', [
                    'transaction_id' => $tx->id,
                    'user_id' => $user->id,
                    'invoice' => $tx->invoice_number,
                    'title' => $content['title'],
                    'dedupe_key' => $content['payload']['dedupe_key'] ?? null,
                ]);
                $this->notificationService->send(
                    $user,
                    $content['title'],
                    $content['message'],
                    $content['type'],
                    $this->channelsFor($user, ['database', 'push']),
                    $content['payload']
                );
            }
        } elseif ($event instanceof TransactionFailed) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                $content = $this->failureContent($tx);
                Log::info('SEND NOTIFICATION — final failed notification', [
                    'transaction_id' => $tx->id,
                    'user_id' => $user->id,
                    'invoice' => $tx->invoice_number,
                    'title' => $content['title'],
                    'dedupe_key' => $content['payload']['dedupe_key'] ?? null,
                    'refunded_at' => $tx->refunded_at,
                ]);
                $this->notificationService->send(
                    $user,
                    $content['title'],
                    $content['message'],
                    $content['type'],
                    $this->channelsFor($user, ['database', 'push']),
                    $content['payload']
                );
            }
        } elseif ($event instanceof WalletCredited) {
            $user = $event->wallet->user;
            if ($user) {
                $relatedTx = $event->referenceId ? \App\Models\Transaction::find($event->referenceId) : null;
                if ($relatedTx) {
                    Log::info('SEND NOTIFICATION — skipped WalletCredited (covered by transaction final state)', [
                        'wallet_id' => $event->wallet->id,
                        'transaction_id' => $relatedTx->id,
                        'reason' => $event->reason,
                    ]);
                } else {
                    Log::info('SEND NOTIFICATION — skipped WalletCredited (internal ledger event only)', [
                        'wallet_id' => $event->wallet->id,
                        'reason' => $event->reason,
                    ]);
                }
            }
        } elseif ($event instanceof WalletDebited) {
            $user = $event->wallet->user;
            if ($user) {
                Log::info('SEND NOTIFICATION — skipped WalletDebited (internal ledger event only)', [
                    'wallet_id' => $event->wallet->id,
                    'reference_id' => $event->referenceId,
                    'reason' => $event->reason,
                ]);
            }
        } elseif ($event instanceof PaymentSettled) {
            // TransactionSuccess already sends final customer notification — avoid duplicate badge noise.
            $tx = $event->transaction;
            Log::info('SEND NOTIFICATION — skipped PaymentSettled (covered by TransactionSuccess)', [
                'transaction_id' => $tx->id ?? null,
                'invoice' => $tx->invoice_number ?? null,
            ]);
        }
    }
}
