<?php

namespace App\Actions\Wallet;

use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Repositories\Contracts\WalletRepositoryInterface;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;
use App\Enums\WalletHistoryType;
use App\Enums\TransactionStatus;
use App\Services\Transactions\IdempotencyGuard;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class WithdrawWalletAction
{
    public function __construct(
        protected WalletRepositoryInterface $walletRepository,
        protected WalletHistoryRepositoryInterface $historyRepository,
        protected IdempotencyGuard $idempotencyGuard
    ) {}

    /**
     * Debit wallet for a bank withdrawal request and record finance/ledger entries.
     */
    public function execute(
        User $user,
        float $amount,
        string $pin,
        string $bankName,
        string $accountNumber,
        float $adminFee = 0.00,
        ?string $idempotencyKey = null
    ): Transaction {
        if ($user->transaction_pin === null) {
            throw ValidationException::withMessages([
                'pin' => ['PIN transaksi belum diatur.'],
            ]);
        }

        if (!Hash::check($pin, $user->transaction_pin)) {
            throw ValidationException::withMessages([
                'pin' => ['PIN transaksi yang Anda masukkan salah.'],
            ]);
        }

        if ($amount < 10000) {
            throw ValidationException::withMessages([
                'amount' => ['Minimal penarikan adalah Rp 10.000.'],
            ]);
        }

        // SRS 14.1 — replay check before any lock/debit (no side effect to unwind on a hit).
        $existing = $idempotencyKey ? $this->idempotencyGuard->findActive($user->id, $idempotencyKey) : null;
        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($user, $amount, $bankName, $accountNumber, $adminFee, $idempotencyKey) {
            $wallet = Wallet::where('user_id', $user->id)->lockForUpdate()->first();
            if (!$wallet) {
                throw new \Exception('Wallet tidak ditemukan.');
            }

            $totalDebit = $amount + $adminFee;
            if ($wallet->balance < $totalDebit) {
                throw ValidationException::withMessages([
                    'amount' => ['Saldo tidak mencukupi untuk penarikan.'],
                ]);
            }

            $invoiceNumber = 'TRX-WD-' . now()->format('YmdHis') . '-' . mt_rand(1000, 9999);

            // Idempotency claim FIRST (before touching the balance): if this insert loses
            // a race or hits an expired key, the wallet has not been mutated yet, so it is
            // always safe to short-circuit and return the other transaction untouched.
            $claim = $this->idempotencyGuard->claim(
                $user->id,
                $idempotencyKey,
                function () use ($user, $invoiceNumber, $bankName, $accountNumber, $amount, $adminFee, $totalDebit, $idempotencyKey) {
                    return Transaction::create([
                        'user_id' => $user->id,
                        'invoice_number' => $invoiceNumber,
                        'service_name' => 'Penarikan Dana',
                        'target_number' => $bankName . ':' . $accountNumber,
                        'amount' => $amount,
                        'admin_fee' => $adminFee,
                        'total_payment' => $totalDebit,
                        'payment_method' => 'wallet',
                        'status' => TransactionStatus::PROCESSING->value,
                        'notes' => "Withdraw ke {$bankName} {$accountNumber}",
                        'idempotency_key' => $idempotencyKey,
                    ]);
                }
            );

            if (!$claim['is_new']) {
                return $claim['transaction'];
            }

            $transaction = $claim['transaction'];

            $wallet->balance -= $totalDebit;
            $wallet->save();

            $this->historyRepository->create([
                'wallet_id' => $wallet->id,
                'amount' => $totalDebit,
                'type' => WalletHistoryType::DEBIT->value,
                'description' => "Withdraw ke {$bankName} {$accountNumber}",
                'reference_id' => $transaction->id,
            ]);

            \App\Models\PaymentHistory::recordFor(
                $transaction,
                'wallet_withdraw',
                'processing',
                [
                    'bank' => $bankName,
                    'account_number' => $accountNumber,
                ]
            );

            event(new \App\Events\WalletDebited(
                $wallet,
                $totalDebit,
                "Withdraw ke {$bankName} {$accountNumber}",
                $transaction->id
            ));
            event(new \App\Events\TransactionCreated($transaction));
            event(new \App\Events\TransactionProcessing($transaction));

            return $transaction;
        });
    }
}
