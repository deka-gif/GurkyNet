<?php

namespace App\Actions\Wallet;

use App\Exceptions\Payment\PaymentGatewayNotConfiguredException;
use App\Exceptions\Payment\TopUpPaymentException;
use App\Models\MidtransTransaction;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Repositories\Contracts\WalletRepositoryInterface;
use App\Services\Payment\MidtransTopUpChannelCatalog;
use App\Services\Payment\PaymentGatewayFactory;
use App\Services\Transactions\IdempotencyGuard;
use App\Services\Wallet\WalletLedgerService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TopUpWalletAction
{
    public function __construct(
        protected WalletRepositoryInterface $walletRepository,
        protected PaymentGatewayFactory $paymentGatewayFactory,
        protected IdempotencyGuard $idempotencyGuard,
        protected WalletLedgerService $ledgerService
    ) {}

    public function execute(
        User $user,
        float $amount,
        float $adminFee = 0.00,
        string $status = 'pending',
        string $paymentMethod = 'midtrans',
        ?string $idempotencyKey = null,
        ?string $topupMethod = 'qris',
        ?string $topupChannel = null
    ): Transaction {
        $gateway = $this->paymentGatewayFactory->default();
        $catalog = app(MidtransTopUpChannelCatalog::class);
        $resolved = $catalog->resolve((string) ($topupMethod ?: 'qris'), $topupChannel);

        // Direct-credit bypass is only allowed outside production (testing/local).
        $allowDirectCredit = app()->environment('local', 'testing');
        if ($allowDirectCredit && in_array(strtolower($status), ['sukses', 'success'], true)) {
            return $this->executeDirectCredit($user, $amount, $adminFee, $idempotencyKey);
        }

        // SRS 14.1 — replay check before any DB write (no side effect to unwind on a hit).
        $existing = $idempotencyKey ? $this->idempotencyGuard->findActive($user->id, $idempotencyKey) : null;
        if ($existing) {
            $this->hydrateSnapAttributes($existing, $resolved);

            return $existing;
        }

        // Fail fast before any DB writes when Midtrans keys are missing.
        if (!$gateway->isConfigured()) {
            throw new PaymentGatewayNotConfiguredException();
        }

        return DB::transaction(function () use ($user, $amount, $adminFee, $paymentMethod, $gateway, $idempotencyKey, $resolved) {
            $wallet = Wallet::where('user_id', $user->id)->lockForUpdate()->first();

            if (!$wallet) {
                throw new \Exception('Wallet tidak ditemukan.');
            }

            $invoiceNumber = 'TRX-TOPUP-' . now()->format('YmdHis') . '-' . mt_rand(1000, 9999);
            $channelNote = 'Top up saldo via Midtrans ('.$resolved['method'].'/'.$resolved['channel'].')';

            // Idempotency claim — top up never debits the wallet here (credit happens
            // only later, on Midtrans settlement), so this insert is safe as the sole
            // write to guard: a losing/expired race simply returns the other transaction.
            $claim = $this->idempotencyGuard->claim(
                $user->id,
                $idempotencyKey,
                function () use ($user, $invoiceNumber, $wallet, $amount, $adminFee, $paymentMethod, $idempotencyKey, $channelNote) {
                    return Transaction::create([
                        'user_id' => $user->id,
                        'invoice_number' => $invoiceNumber,
                        'service_name' => 'Top Up Saldo',
                        'target_number' => $wallet->wallet_number,
                        'amount' => $amount,
                        'admin_fee' => $adminFee,
                        'total_payment' => $amount + $adminFee,
                        'payment_method' => $paymentMethod,
                        'status' => 'pending',
                        'notes' => $channelNote,
                        'idempotency_key' => $idempotencyKey,
                        'channel' => 'app',
                    ]);
                }
            );

            if (!$claim['is_new']) {
                $this->hydrateSnapAttributes($claim['transaction'], $resolved);

                return $claim['transaction'];
            }

            $transaction = $claim['transaction'];

            try {
                $checkout = $gateway->createCheckout([
                    'order_id' => $invoiceNumber,
                    'gross_amount' => $amount + $adminFee,
                    'customer' => [
                        'first_name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone_number,
                    ],
                    'enabled_payments' => $resolved['enabled_payments'],
                ]);

                $snapToken = $checkout['token'] ?? null;
                $redirectUrl = $checkout['redirect_url'] ?? null;

                MidtransTransaction::create([
                    'transaction_id' => $transaction->id,
                    'order_id' => $invoiceNumber,
                    'snap_token' => $snapToken,
                    'gross_amount' => $amount + $adminFee,
                    'transaction_status' => 'pending',
                    'payment_type' => $resolved['channel'],
                ]);

                $this->attachPaymentAttributes($transaction, $resolved, $snapToken, $redirectUrl);
            } catch (PaymentGatewayNotConfiguredException $e) {
                throw $e;
            } catch (TopUpPaymentException $e) {
                throw $e;
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
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
                        'payment_type' => $resolved['channel'],
                    ]);

                    $this->attachPaymentAttributes($transaction, $resolved, $snapToken, $redirectUrl);
                } else {
                    throw $this->mapSnapException($e);
                }
            } catch (\Exception $e) {
                Log::error('Failed to generate Midtrans Snap transaction: ' . $e->getMessage());
                throw $this->mapSnapException($e);
            }

            event(new \App\Events\TransactionCreated($transaction));
            event(new \App\Events\TransactionProcessing($transaction));

            return $transaction;
        });
    }

    /**
     * @param  array{method:string,channel:string,label:string,enabled_payments:list<string>}  $resolved
     */
    protected function hydrateSnapAttributes(Transaction $transaction, array $resolved): void
    {
        $mt = MidtransTransaction::where('transaction_id', $transaction->id)->first();
        $this->attachPaymentAttributes(
            $transaction,
            $resolved,
            $mt?->snap_token,
            $transaction->redirect_url ?? null
        );
    }

    /**
     * @param  array{method:string,channel:string,label:string,enabled_payments:list<string>}  $resolved
     */
    protected function attachPaymentAttributes(
        Transaction $transaction,
        array $resolved,
        ?string $snapToken,
        ?string $redirectUrl
    ): void {
        $transaction->snap_token = $snapToken;
        $transaction->redirect_url = $redirectUrl;
        $transaction->topup_method = $resolved['method'];
        $transaction->topup_channel = $resolved['channel'];
        $transaction->topup_channel_label = $resolved['label'];
    }

    protected function mapSnapException(\Throwable $e): TopUpPaymentException
    {
        $raw = strtolower($e->getMessage());
        $channelHint = str_contains($raw, 'enabled_payments')
            || str_contains($raw, 'payment type')
            || str_contains($raw, 'not available')
            || str_contains($raw, 'not activated');

        if ($channelHint) {
            return new TopUpPaymentException(
                'Metode pembayaran tersebut sedang tidak tersedia. Silakan pilih metode lain.',
                TopUpPaymentException::CHANNEL_UNAVAILABLE,
                422
            );
        }

        return new TopUpPaymentException(
            'Gagal membuat pembayaran top up. Silakan coba beberapa saat lagi.',
            TopUpPaymentException::PAYMENT_FAILED,
            502
        );
    }

    protected function executeDirectCredit(User $user, float $amount, float $adminFee, ?string $idempotencyKey = null): Transaction
    {
        // SRS 14.1 — replay check before any DB write (no side effect to unwind on a hit).
        $existing = $idempotencyKey ? $this->idempotencyGuard->findActive($user->id, $idempotencyKey) : null;
        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($user, $amount, $adminFee, $idempotencyKey) {
            $wallet = Wallet::where('user_id', $user->id)->lockForUpdate()->first();

            if (!$wallet) {
                throw new \Exception('Wallet tidak ditemukan.');
            }

            $invoiceNumber = 'TRX-TOPUP-' . now()->format('YmdHis') . '-' . mt_rand(1000, 9999);

            // Direct-credit debits nothing from the sender's own balance (it adds to it),
            // so the idempotency claim only needs to guard the transaction row + credit below.
            $claim = $this->idempotencyGuard->claim(
                $user->id,
                $idempotencyKey,
                function () use ($user, $invoiceNumber, $wallet, $amount, $adminFee, $idempotencyKey) {
                    return Transaction::create([
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
                        'idempotency_key' => $idempotencyKey,
                    ]);
                }
            );

            if (!$claim['is_new']) {
                return $claim['transaction'];
            }

            $transaction = $claim['transaction'];

            $wallet->balance += $amount;
            $wallet->save();

            // SRS 14.2 — dual-write wallet_mutations + wallet_histories via ledger
            $desc = 'Top Up Saldo - Invoice: ' . $invoiceNumber;
            $this->ledgerService->record(
                $wallet,
                WalletMutation::TYPE_TOPUP,
                $amount,
                'credit',
                $desc,
                $transaction->id
            );

            event(new \App\Events\TransactionCreated($transaction));
            event(new \App\Events\WalletCredited($wallet, $amount, $desc, $transaction->id));
            event(new \App\Events\TransactionSuccess($transaction));

            return $transaction;
        });
    }
}
