<?php

namespace App\Actions\Transaction;

use App\Models\Transaction;
use App\Models\Wallet;
use App\Repositories\Contracts\TransactionRepositoryInterface;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;
use App\Enums\TransactionStatus;
use App\Enums\WalletHistoryType;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CancelTransactionAction
{
    protected TransactionRepositoryInterface $transactionRepository;
    protected WalletHistoryRepositoryInterface $historyRepository;

    public function __construct(
        TransactionRepositoryInterface $transactionRepository,
        WalletHistoryRepositoryInterface $historyRepository
    ) {
        $this->transactionRepository = $transactionRepository;
        $this->historyRepository = $historyRepository;
    }

    public function execute(Transaction $transaction, ?string $reason = null): Transaction
    {
        return DB::transaction(function () use ($transaction, $reason) {
            // Lock transaction
            $lockedTransaction = Transaction::where('id', $transaction->id)->lockForUpdate()->first();

            if (in_array($lockedTransaction->status, [TransactionStatus::CANCELED->value, TransactionStatus::FAILED->value, TransactionStatus::SUCCESS->value])) {
                throw ValidationException::withMessages([
                    'transaction' => ['Transaksi tidak dapat dibatalkan karena sudah selesai, gagal, atau telah dibatalkan sebelumnya.'],
                ]);
            }

            // Sprint 3 (SRS 15.3 / locked decision #3) — UNSAFE CANCEL guard.
            // Once the transaction is `processing`, or a provider dispatch has already been
            // claimed (provider_dispatch_started_at set — see ProductProviderFulfillmentService),
            // the order may already be in flight at the supplier. Cancelling + refunding here
            // would risk "user cancel + provider fulfillment = double loss". Reject instead and
            // let the existing reconciliation/timeout/provider-status flow resolve the outcome.
            $unsafeToCancel = $lockedTransaction->status === TransactionStatus::PROCESSING->value
                || $lockedTransaction->provider_dispatch_started_at !== null;

            if ($unsafeToCancel) {
                throw ValidationException::withMessages([
                    'transaction' => ['Transaksi sudah dikirim ke penyedia layanan dan tidak dapat dibatalkan langsung. Sistem akan menyelesaikan status transaksi secara otomatis.'],
                ]);
            }

            // SAFE CANCEL: status PENDING and no provider dispatch claimed yet — wallet was
            // debited but nothing has been sent to a supplier, so refund is always safe here.
            // (PROCESSING is already rejected by the unsafe-cancel guard above.)
            if ($lockedTransaction->status === TransactionStatus::PENDING->value) {
                $wallet = Wallet::where('user_id', $lockedTransaction->user_id)->lockForUpdate()->first();
                if ($wallet) {
                    $wallet->balance += $lockedTransaction->total_payment;
                    $wallet->save();

                    // Create history credit for refund
                    $this->historyRepository->create([
                        'wallet_id' => $wallet->id,
                        'amount' => $lockedTransaction->total_payment,
                        'type' => WalletHistoryType::CREDIT->value,
                        'description' => 'Refund Pembatalan Transaksi: ' . $lockedTransaction->invoice_number,
                        'reference_id' => $lockedTransaction->id,
                    ]);

                    event(new \App\Events\WalletCredited($wallet, $lockedTransaction->total_payment, 'Refund Pembatalan Transaksi: ' . $lockedTransaction->invoice_number, $lockedTransaction->id));
                }
            }

            $lockedTransaction->status = TransactionStatus::CANCELED->value;
            $lockedTransaction->notes = $reason ?? 'Transaksi dibatalkan oleh pengguna atau sistem';
            $lockedTransaction->save();

            event(new \App\Events\TransactionFailed($lockedTransaction));

            return $lockedTransaction;
        });
    }
}
