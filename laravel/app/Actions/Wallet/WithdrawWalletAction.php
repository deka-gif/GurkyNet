<?php

namespace App\Actions\Wallet;

use App\Enums\TransactionStatus;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Models\WithdrawRequest;
use App\Repositories\Contracts\WalletRepositoryInterface;
use App\Services\Transactions\IdempotencyGuard;
use App\Services\Wallet\WalletLedgerService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * FR-FIN-05 / SRS 6.5 — withdraw submit holds balance and queues Finance review.
 * Legacy immediate-debit path is no longer used for new requests (historical rows preserved).
 */
class WithdrawWalletAction
{
    public function __construct(
        protected WalletRepositoryInterface $walletRepository,
        protected IdempotencyGuard $idempotencyGuard,
        protected WalletLedgerService $ledgerService
    ) {}

    public function execute(
        User $user,
        float $amount,
        string $pin,
        string $bankName,
        string $accountNumber,
        float $adminFee = 0.00,
        ?string $idempotencyKey = null,
        ?string $accountHolder = null
    ): Transaction {
        // Sprint 8 / FR-USR07 deferred — public withdraw disabled until explicit go-live + KYC.
        $gate = app(\App\Support\Features\TransactionFeatureGate::class);
        if (! $gate->withdrawEnabled()) {
            throw ValidationException::withMessages([
                'amount' => [$gate->withdrawDisabledMessage()],
            ]);
        }

        // FR-USR07 + FR-KYC-02..04 — eligibility wired for future activation (gate still OFF).
        app(\App\Services\Kyc\WithdrawEligibilityService::class)->assertEligible($user, $accountHolder);

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

        // SRS 18.2 — withdraw freeze gate (Sprint 7 zero-loss).
        $freeze = app(\App\Services\Finance\Reconciliation\ReconciliationIncidentService::class);
        if ($freeze->isWithdrawFrozen($user->id)) {
            throw ValidationException::withMessages([
                'amount' => [$freeze->withdrawFreezeMessage()],
            ]);
        }

        $existing = $idempotencyKey ? $this->idempotencyGuard->findActive($user->id, $idempotencyKey) : null;
        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($user, $amount, $bankName, $accountNumber, $adminFee, $idempotencyKey, $accountHolder) {
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

            $invoiceNumber = 'TRX-WD-'.now()->format('YmdHis').'-'.mt_rand(1000, 9999);

            $claim = $this->idempotencyGuard->claim(
                $user->id,
                $idempotencyKey,
                function () use ($user, $invoiceNumber, $bankName, $accountNumber, $amount, $adminFee, $totalDebit, $idempotencyKey) {
                    return Transaction::create([
                        'user_id' => $user->id,
                        'invoice_number' => $invoiceNumber,
                        'service_name' => 'Penarikan Dana',
                        'target_number' => $bankName.':'.$accountNumber,
                        'amount' => $amount,
                        'admin_fee' => $adminFee,
                        'total_payment' => $totalDebit,
                        'payment_method' => 'wallet',
                        'status' => TransactionStatus::LOCKED->value,
                        'notes' => "Withdraw hold → antrean Finance ke {$bankName} {$accountNumber}",
                        'idempotency_key' => $idempotencyKey,
                    ]);
                }
            );

            if (!$claim['is_new']) {
                return $claim['transaction'];
            }

            $transaction = $claim['transaction'];

            // Hold only — final TYPE_WITHDRAW written on Finance approve (FR-FIN-05).
            $wallet->balance -= $totalDebit;
            $wallet->save();

            $desc = "Hold withdraw ke {$bankName} {$accountNumber}";
            $this->ledgerService->record(
                $wallet,
                WalletMutation::TYPE_HOLD,
                $totalDebit,
                'debit',
                $desc,
                $transaction->id
            );

            WithdrawRequest::create([
                'user_id' => $user->id,
                'amount' => $amount,
                'admin_fee' => $adminFee,
                'method' => 'bank_transfer',
                'bank_name' => $bankName,
                'account_number' => $accountNumber,
                'account_holder' => $accountHolder,
                'status' => 'pending',
                'transaction_id' => $transaction->id,
                'workflow' => WithdrawRequest::WORKFLOW_HOLD_QUEUE,
            ]);

            \App\Models\PaymentHistory::recordFor(
                $transaction,
                'wallet_withdraw',
                'pending',
                [
                    'bank' => $bankName,
                    'account_number' => $accountNumber,
                    'workflow' => WithdrawRequest::WORKFLOW_HOLD_QUEUE,
                ]
            );

            event(new \App\Events\WalletDebited($wallet, $totalDebit, $desc, $transaction->id));
            event(new \App\Events\TransactionCreated($transaction));

            return $transaction;
        });
    }
}
