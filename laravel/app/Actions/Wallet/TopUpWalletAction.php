<?php

namespace App\Actions\Wallet;

use App\Enums\WalletHistoryType;
use App\Exceptions\Payment\PaymentGatewayNotConfiguredException;
use App\Models\MidtransTransaction;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Repositories\Contracts\WalletHistoryRepositoryInterface;
use App\Repositories\Contracts\WalletRepositoryInterface;
use App\Services\Payment\PaymentGatewayFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TopUpWalletAction
{
    public function __construct(
        protected WalletRepositoryInterface $walletRepository,
        protected WalletHistoryRepositoryInterface $historyRepository,
        protected PaymentGatewayFactory $paymentGatewayFactory
    ) {}

    public function execute(User $user, float $amount, float $adminFee = 0.00, string $status = 'pending', string $paymentMethod = 'midtrans'): Transaction
    {
        $gateway = $this->paymentGatewayFactory->default();

        // Direct-credit bypass is only allowed outside production (testing/local).
        $allowDirectCredit = app()->environment('local', 'testing');
        if ($allowDirectCredit && in_array(strtolower($status), ['sukses', 'success'], true)) {
            return $this->executeDirectCredit($user, $amount, $adminFee);
        }

        // Fail fast before any DB writes when Midtrans keys are missing.
        if (!$gateway->isConfigured()) {
            throw new PaymentGatewayNotConfiguredException();
        }

        return DB::transaction(function () use ($user, $amount, $adminFee, $paymentMethod, $gateway) {
            $wallet = Wallet::where('user_id', $user->id)->lockForUpdate()->first();

            if (!$wallet) {
                throw new \Exception('Wallet tidak ditemukan.');
            }

            $invoiceNumber = 'TRX-TOPUP-' . now()->format('YmdHis') . '-' . mt_rand(1000, 9999);

            $transaction = Transaction::create([
                'user_id' => $user->id,
                'invoice_number' => $invoiceNumber,
                'service_name' => 'Top Up Saldo',
                'target_number' => $wallet->wallet_number,
                'amount' => $amount,
                'admin_fee' => $adminFee,
                'total_payment' => $amount + $adminFee,
                'payment_method' => $paymentMethod,
                'status' => 'pending',
                'notes' => 'Top up saldo via Midtrans',
            ]);

            try {
                $checkout = $gateway->createCheckout([
                    'order_id' => $invoiceNumber,
                    'gross_amount' => $amount + $adminFee,
                    'customer' => [
                        'first_name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone_number,
                    ],
                ]);

                $snapToken = $checkout['token'] ?? null;
                $redirectUrl = $checkout['redirect_url'] ?? null;

                MidtransTransaction::create([
                    'transaction_id' => $transaction->id,
                    'order_id' => $invoiceNumber,
                    'snap_token' => $snapToken,
                    'gross_amount' => $amount + $adminFee,
                    'transaction_status' => 'pending',
                ]);

                $transaction->snap_token = $snapToken;
                $transaction->redirect_url = $redirectUrl;
            } catch (PaymentGatewayNotConfiguredException $e) {
                throw $e;
            } catch (\Exception $e) {
                Log::error('Failed to generate Midtrans Snap transaction: ' . $e->getMessage());

                // Testing fallback when keys exist but Snap HTTP is unavailable.
                if (app()->environment('testing')) {
                    $snapToken = 'test_snap_token';
                    $redirectUrl = 'https://app.sandbox.midtrans.com/snap/v1/payment-page/test_snap_token';

                    MidtransTransaction::create([
                        'transaction_id' => $transaction->id,
                        'order_id' => $invoiceNumber,
                        'snap_token' => $snapToken,
                        'gross_amount' => $amount + $adminFee,
                        'transaction_status' => 'pending',
                    ]);

                    $transaction->snap_token = $snapToken;
                    $transaction->redirect_url = $redirectUrl;
                } else {
                    throw $e;
                }
            }

            event(new \App\Events\TransactionCreated($transaction));
            event(new \App\Events\TransactionProcessing($transaction));

            return $transaction;
        });
    }

    protected function executeDirectCredit(User $user, float $amount, float $adminFee): Transaction
    {
        return DB::transaction(function () use ($user, $amount, $adminFee) {
            $wallet = Wallet::where('user_id', $user->id)->lockForUpdate()->first();

            if (!$wallet) {
                throw new \Exception('Wallet tidak ditemukan.');
            }

            $invoiceNumber = 'TRX-TOPUP-' . now()->format('YmdHis') . '-' . mt_rand(1000, 9999);

            $transaction = Transaction::create([
                'user_id' => $user->id,
                'invoice_number' => $invoiceNumber,
                'service_name' => 'Top Up Saldo',
                'target_number' => $wallet->wallet_number,
                'amount' => $amount,
                'admin_fee' => $adminFee,
                'total_payment' => $amount + $adminFee,
                'payment_method' => 'dummy_gateway',
                'status' => 'success',
                'notes' => 'Top up saldo via dummy gateway',
            ]);

            $wallet->balance += $amount;
            $wallet->save();

            $this->historyRepository->create([
                'wallet_id' => $wallet->id,
                'amount' => $amount,
                'type' => WalletHistoryType::CREDIT->value,
                'description' => 'Top Up Saldo - Invoice: ' . $invoiceNumber,
                'reference_id' => $transaction->id,
            ]);

            event(new \App\Events\TransactionCreated($transaction));
            event(new \App\Events\WalletCredited($wallet, $amount, 'Top Up Saldo - Invoice: ' . $invoiceNumber, $transaction->id));
            event(new \App\Events\TransactionSuccess($transaction));

            return $transaction;
        });
    }
}
