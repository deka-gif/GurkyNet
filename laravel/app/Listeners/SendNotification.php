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
                $this->notificationService->send($user, 'Transaksi Dibuat', "Transaksi #{$tx->invoice_number} senilai Rp" . number_format($tx->amount, 0) . " telah dibuat.", 'info', ['database']);
            }
        } elseif ($event instanceof TransactionProcessing) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                $this->notificationService->send($user, 'Transaksi Diproses', "Transaksi #{$tx->invoice_number} sedang diproses.", 'info', ['database']);
            }
        } elseif ($event instanceof TransactionSuccess) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
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
                    ['database', 'push']
                );
            }
        } elseif ($event instanceof TransactionFailed) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                $isTimeout = str_contains(strtolower((string) ($tx->notes ?? '')), 'batas waktu')
                    || str_contains(strtolower((string) ($tx->notes ?? '')), 'timeout');
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
                    ['database', 'push']
                );
            }
        } elseif ($event instanceof WalletCredited) {
            $user = $event->wallet->user;
            if ($user) {
                $title = str_contains(strtolower($event->reason), 'refund') ? 'Refund Berhasil' : 'Saldo Bertambah';
                $this->notificationService->send($user, $title, "Saldo Anda bertambah sebesar Rp" . number_format($event->amount, 0) . ". Alasan: {$event->reason}", 'success', ['database', 'push']);
            }
        } elseif ($event instanceof WalletDebited) {
            $user = $event->wallet->user;
            if ($user) {
                $this->notificationService->send($user, 'Saldo Berkurang', "Saldo Anda berkurang sebesar Rp" . number_format($event->amount, 0) . ". Alasan: {$event->reason}", 'info', ['database', 'push']);
            }
        } elseif ($event instanceof PaymentSettled) {
            // TransactionSuccess already sends "Pembayaran Berhasil" — avoid duplicate badge noise.
            $tx = $event->transaction;
            Log::info('SEND NOTIFICATION — skipped PaymentSettled (covered by TransactionSuccess)', [
                'transaction_id' => $tx->id ?? null,
                'invoice' => $tx->invoice_number ?? null,
            ]);
        }
    }
}
