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
                $this->notificationService->send($user, 'Transaksi Berhasil', "Transaksi #{$tx->invoice_number} senilai Rp" . number_format($tx->amount, 0) . " telah berhasil diselesaikan.", 'success', ['database']);
            }
        } elseif ($event instanceof TransactionFailed) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                $this->notificationService->send($user, 'Transaksi Gagal', "Transaksi #{$tx->invoice_number} telah gagal.", 'error', ['database']);
            }
        } elseif ($event instanceof WalletCredited) {
            $user = $event->wallet->user;
            if ($user) {
                $title = str_contains(strtolower($event->reason), 'refund') ? 'Refund Berhasil' : 'Saldo Bertambah';
                $this->notificationService->send($user, $title, "Saldo Anda bertambah sebesar Rp" . number_format($event->amount, 0) . ". Alasan: {$event->reason}", 'success', ['database']);
            }
        } elseif ($event instanceof WalletDebited) {
            $user = $event->wallet->user;
            if ($user) {
                $this->notificationService->send($user, 'Saldo Berkurang', "Saldo Anda berkurang sebesar Rp" . number_format($event->amount, 0) . ". Alasan: {$event->reason}", 'info', ['database']);
            }
        } elseif ($event instanceof PaymentSettled) {
            $tx = $event->transaction;
            $user = $tx->user;
            if ($user) {
                $this->notificationService->send($user, 'Pembayaran Selesai', "Pembayaran untuk transaksi #{$tx->invoice_number} telah diselesaikan.", 'success', ['database']);
            }
        }
    }
}
