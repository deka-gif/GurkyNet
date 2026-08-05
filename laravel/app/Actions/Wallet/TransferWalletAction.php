<?php

namespace App\Actions\Wallet;

use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Repositories\Contracts\WalletRepositoryInterface;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;
use App\Enums\WalletHistoryType;
use App\Enums\TransactionStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class TransferWalletAction
{
    protected WalletRepositoryInterface $walletRepository;
    protected WalletHistoryRepositoryInterface $historyRepository;

    public function __construct(
        WalletRepositoryInterface $walletRepository,
        WalletHistoryRepositoryInterface $historyRepository
    ) {
        $this->walletRepository = $walletRepository;
        $this->historyRepository = $historyRepository;
    }

    public function execute(User $sender, string $recipientWalletNumber, float $amount, string $pin, float $fee = 0.00): Transaction
    {
        // 1. PIN Validation (pre-checks before transaction to fail fast)
        if ($sender->transaction_pin === null) {
            throw ValidationException::withMessages([
                'pin' => ['PIN transaksi belum diatur. Silakan atur PIN transaksi Anda terlebih dahulu.'],
            ]);
        }

        if (!Hash::check($pin, $sender->transaction_pin)) {
            throw ValidationException::withMessages([
                'pin' => ['PIN transaksi yang Anda masukkan salah.'],
            ]);
        }

        // 2. Recipient validation
        $recipientWallet = $this->walletRepository->findByWalletNumber($recipientWalletNumber);
        if (!$recipientWallet) {
            throw ValidationException::withMessages([
                'recipient_wallet_number' => ['Nomor rekening / wallet tujuan tidak ditemukan.'],
            ]);
        }

        $senderWallet = $this->walletRepository->findByUserId($sender->id);
        if (!$senderWallet) {
            throw new \Exception('Wallet pengirim tidak ditemukan.');
        }

        if ($senderWallet->id === $recipientWallet->id) {
            throw ValidationException::withMessages([
                'recipient_wallet_number' => ['Tidak diperbolehkan melakukan transfer ke rekening / wallet sendiri.'],
            ]);
        }

        // 3. DB Transaction with lockForUpdate in a deadlock-free order
        return DB::transaction(function () use ($sender, $senderWallet, $recipientWallet, $amount, $fee) {
            // Sort wallet IDs to prevent deadlock / race condition
            $walletIds = [$senderWallet->id, $recipientWallet->id];
            sort($walletIds);

            // Fetch and lock wallets in ascending order
            $lockedWallets = Wallet::whereIn('id', $walletIds)->lockForUpdate()->get()->keyBy('id');
            
            $senderWalletLocked = $lockedWallets->get($senderWallet->id);
            $recipientWalletLocked = $lockedWallets->get($recipientWallet->id);

            $totalDebit = $amount + $fee;

            if ($senderWalletLocked->balance < $totalDebit) {
                throw ValidationException::withMessages([
                    'amount' => ['Saldo tidak mencukupi untuk melakukan transfer.'],
                ]);
            }

            // Perform balance changes atomically
            $senderWalletLocked->balance -= $totalDebit;
            $senderWalletLocked->save();

            $recipientWalletLocked->balance += $amount;
            $recipientWalletLocked->save();

            $invoiceNumber = 'TRX-TF-' . now()->format('YmdHis') . '-' . mt_rand(1000, 9999);

            // Create general transaction record
            $transaction = Transaction::create([
                'user_id' => $sender->id,
                'invoice_number' => $invoiceNumber,
                'service_name' => 'Transfer Saldo',
                'target_number' => $recipientWalletLocked->wallet_number,
                'amount' => $amount,
                'admin_fee' => $fee,
                'total_payment' => $totalDebit,
                'payment_method' => 'wallet',
                'status' => TransactionStatus::SUKSES->value,
                'notes' => 'Transfer ke ' . ($recipientWalletLocked->user->name ?? $recipientWalletLocked->wallet_number),
            ]);

            // Create sender wallet history (Debit)
            $this->historyRepository->create([
                'wallet_id' => $senderWalletLocked->id,
                'amount' => $totalDebit,
                'type' => WalletHistoryType::DEBIT->value,
                'description' => 'Transfer ke ' . $recipientWalletLocked->wallet_number,
                'reference_id' => $transaction->id,
            ]);

            // Create recipient wallet history (Credit)
            $this->historyRepository->create([
                'wallet_id' => $recipientWalletLocked->id,
                'amount' => $amount,
                'type' => WalletHistoryType::CREDIT->value,
                'description' => 'Transfer masuk dari ' . $senderWalletLocked->wallet_number,
                'reference_id' => $transaction->id,
            ]);

            \App\Models\PaymentHistory::recordFor(
                $transaction,
                'wallet_transfer',
                'success',
                [
                    'from_wallet' => $senderWalletLocked->wallet_number,
                    'to_wallet' => $recipientWalletLocked->wallet_number,
                ]
            );

            event(new \App\Events\WalletDebited(
                $senderWalletLocked,
                $totalDebit,
                'Transfer ke ' . $recipientWalletLocked->wallet_number,
                $transaction->id
            ));
            event(new \App\Events\WalletCredited(
                $recipientWalletLocked,
                $amount,
                'Transfer masuk dari ' . $senderWalletLocked->wallet_number,
                $transaction->id
            ));
            event(new \App\Events\TransactionCreated($transaction));
            event(new \App\Events\TransactionSuccess($transaction));

            return $transaction;
        });
    }
}
