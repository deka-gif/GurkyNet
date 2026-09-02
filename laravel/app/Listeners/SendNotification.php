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

    /**
     * Handle the event.
     */
    public function handle(mixed $event): void
    {
        Log::info("SendNotification listener handling event: " . get_class($event));

        if ($event instanceof TransactionCreated) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                if (TransactionStatusMapper::isWalletTopUp($tx)) {
                    $this->notificationService->send(
                        $user,
                        'Menunggu Pembayaran',
                        'Top Up Rp' . number_format((float) $tx->amount, 0, ',', '.') . ' belum dibayar. Selesaikan pembayaran sebelum batas waktunya berakhir.',
                        'info',
                        $this->channelsFor($user, ['database'])
                    );
                } else {
                    $this->notificationService->send($user, 'Transaksi Dibuat', "Transaksi #{$tx->invoice_number} senilai Rp" . number_format($tx->amount, 0) . " telah dibuat.", 'info', $this->channelsFor($user, ['database']));
                }
            }
        } elseif ($event instanceof TransactionProcessing) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                if (TransactionStatusMapper::isWalletTopUp($tx)) {
                    $this->notificationService->send(
                        $user,
                        'Pembayaran Diproses',
                        'Pembayaran Rp' . number_format((float) $tx->amount, 0, ',', '.') . ' masih diproses. Saldo akan bertambah setelah pembayaran berhasil dikonfirmasi.',
                        'info',
                        $this->channelsFor($user, ['database'])
                    );
                } else {
                    $this->notificationService->send($user, 'Transaksi Diproses', "Transaksi #{$tx->invoice_number} sedang diproses.", 'info', $this->channelsFor($user, ['database']));
                }
            }
        } elseif ($event instanceof TransactionSuccess) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                if (TransactionStatusMapper::isWalletTopUp($tx)) {
                    $wallet = \App\Models\Wallet::where('user_id', $user->id)->first();
                    $balanceText = $wallet ? ' Saldo Anda sekarang Rp' . number_format((float) $wallet->balance, 0, ',', '.') . '.' : '';
                    Log::info('SEND NOTIFICATION — Top Up Berhasil', [
                        'transaction_id' => $tx->id,
                        'user_id' => $user->id,
                        'invoice' => $tx->invoice_number,
                    ]);
                    $this->notificationService->send(
                        $user,
                        'Top Up Berhasil',
                        'Top Up Rp' . number_format((float) $tx->amount, 0, ',', '.') . ' berhasil.' . $balanceText,
                        'transaction_success',
                        $this->channelsFor($user, ['database', 'push'])
                    );
                } else {
                    Log::info('SEND NOTIFICATION — Pembayaran Berhasil', [
                        'transaction_id' => $tx->id,
                        'user_id' => $user->id,
                        'invoice' => $tx->invoice_number,
                    ]);
                    $this->notificationService->send(
                        $user,
                        'Pembayaran Berhasil',
                        "Transaksi #{$tx->invoice_number} senilai Rp" . number_format((float) $tx->amount, 0, ',', '.') . ' telah berhasil diselesaikan.',
                        'transaction_success',
                        $this->channelsFor($user, ['database', 'push'])
                    );
                }
            }
        } elseif ($event instanceof TransactionFailed) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                $isTimeout = str_contains(strtolower((string) ($tx->notes ?? '')), 'batas waktu')
                    || str_contains(strtolower((string) ($tx->notes ?? '')), 'timeout');

                if (TransactionStatusMapper::isWalletTopUp($tx)) {
                    $amountText = 'Rp' . number_format((float) $tx->amount, 0, ',', '.');
                    $rawStatus = strtolower((string) $tx->status);

                    if ($rawStatus === \App\Enums\TransactionStatus::EXPIRED->value) {
                        $title = 'Pembayaran Kedaluwarsa';
                        $message = "Pembayaran Top Up {$amountText} telah kedaluwarsa. Saldo Anda tidak berubah.";
                        $type = 'transaction_failed';
                    } elseif ($isTimeout) {
                        // Belum ada bukti pasti dari Midtrans — jangan klaim gagal secara definitif.
                        $title = 'Status Pembayaran Belum Dapat Dikonfirmasi';
                        $message = "Status pembayaran Top Up {$amountText} belum dapat dikonfirmasi. Silakan cek kembali beberapa saat lagi. Saldo Anda tidak berubah.";
                        $type = 'transaction_timeout';
                    } else {
                        $title = 'Pembayaran Gagal';
                        $message = "Pembayaran Top Up {$amountText} tidak berhasil. Saldo Anda tidak berubah. Silakan coba lagi.";
                        $type = 'transaction_failed';
                    }

                    Log::info('SEND NOTIFICATION — ' . $title . ' (Top Up)', [
                        'transaction_id' => $tx->id,
                        'user_id' => $user->id,
                    ]);
                    $this->notificationService->send($user, $title, $message, $type, $this->channelsFor($user, ['database', 'push']));
                } else {
                    $title = $isTimeout ? 'Transaksi Timeout' : 'Transaksi Gagal';
                    $message = $isTimeout
                        ? ((string) ($tx->notes ?: 'Provider tidak memberikan respon dalam batas waktu. Saldo Anda telah dikembalikan.'))
                        : ("Transaksi #{$tx->invoice_number} telah gagal.");
                    Log::info('SEND NOTIFICATION — ' . $title, [
                        'transaction_id' => $tx->id,
                        'user_id' => $user->id,
                    ]);
                    $this->notificationService->send(
                        $user,
                        $title,
                        $message,
                        $isTimeout ? 'transaction_timeout' : 'transaction_failed',
                        $this->channelsFor($user, ['database', 'push'])
                    );
                }
            }
        } elseif ($event instanceof WalletCredited) {
            $user = $event->wallet->user;
            if ($user) {
                $relatedTx = $event->referenceId ? \App\Models\Transaction::find($event->referenceId) : null;
                $isTopUpCredit = $relatedTx && TransactionStatusMapper::isWalletTopUp($relatedTx);

                if ($isTopUpCredit) {
                    // Top Up settlement — TransactionSuccess event above already sent "Top Up
                    // Berhasil". Never label this a "refund": Top Up never debits the wallet
                    // up front, so there is nothing to "return". Avoid a second, redundant
                    // notification for the same completed Top Up.
                    Log::info('SEND NOTIFICATION — skipped WalletCredited for Top Up settlement (covered by TransactionSuccess)', [
                        'wallet_id' => $event->wallet->id,
                        'transaction_id' => $relatedTx->id,
                    ]);
                } else {
                    $title = str_contains(strtolower($event->reason), 'refund') ? 'Refund Berhasil' : 'Saldo Bertambah';
                    $this->notificationService->send($user, $title, "Saldo Anda bertambah sebesar Rp" . number_format($event->amount, 0) . ". Alasan: {$event->reason}", 'success', $this->channelsFor($user, ['database', 'push']));
                }
            }
        } elseif ($event instanceof WalletDebited) {
            $user = $event->wallet->user;
            if ($user) {
                $this->notificationService->send($user, 'Saldo Berkurang', "Saldo Anda berkurang sebesar Rp" . number_format($event->amount, 0) . ". Alasan: {$event->reason}", 'info', $this->channelsFor($user, ['database', 'push']));
            }
        } elseif ($event instanceof PaymentSettled) {
            // TransactionSuccess already sends "Pembayaran Berhasil"/"Top Up Berhasil" — avoid duplicate badge noise.
            $tx = $event->transaction;
            Log::info('SEND NOTIFICATION — skipped PaymentSettled (covered by TransactionSuccess)', [
                'transaction_id' => $tx->id ?? null,
                'invoice' => $tx->invoice_number ?? null,
            ]);
        }
    }
}
