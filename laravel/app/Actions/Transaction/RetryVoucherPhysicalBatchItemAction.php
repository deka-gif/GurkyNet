<?php

namespace App\Actions\Transaction;

use App\Enums\TransactionStatus;
use App\Jobs\ProcessVoucherPhysicalBatchItem;
use App\Models\Transaction;
use App\Models\User;
use App\Models\VoucherPhysicalBatch;
use App\Models\VoucherPhysicalBatchItem;
use App\Models\Wallet;
use App\Models\WalletMutation;
use App\Services\Wallet\WalletLedgerService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Retries ONE failed serial in a Voucher Fisik batch — re-holds just that item's price
 * (it was refunded when it failed) and re-dispatches fulfillment, without touching any
 * other item in the batch. Idempotent per item: only a FAILED item can be retried.
 */
class RetryVoucherPhysicalBatchItemAction
{
    public function __construct(
        protected WalletLedgerService $ledgerService
    ) {}

    public function execute(User $user, VoucherPhysicalBatch $batch, VoucherPhysicalBatchItem $item): VoucherPhysicalBatchItem
    {
        if ($item->batch_id !== $batch->id) {
            throw new \InvalidArgumentException('Item does not belong to batch.');
        }

        if ($item->status !== VoucherPhysicalBatchItem::STATUS_FAILED) {
            throw ValidationException::withMessages([
                'item' => ['Item ini tidak dalam status gagal, tidak bisa di-retry.'],
            ]);
        }

        return DB::transaction(function () use ($user, $batch, $item) {
            $wallet = Wallet::where('user_id', $user->id)->lockForUpdate()->first();
            if (! $wallet) {
                throw new \Exception('Wallet tidak ditemukan.');
            }

            $unitPrice = (float) $batch->unit_price;
            if ($wallet->balance < $unitPrice) {
                throw ValidationException::withMessages([
                    'balance' => ['Saldo tidak mencukupi untuk retry item ini.'],
                ]);
            }

            $locked = VoucherPhysicalBatchItem::where('id', $item->id)->lockForUpdate()->first();
            if (! $locked || $locked->status !== VoucherPhysicalBatchItem::STATUS_FAILED) {
                throw ValidationException::withMessages([
                    'item' => ['Item ini tidak dalam status gagal, tidak bisa di-retry.'],
                ]);
            }

            $wallet->balance -= $unitPrice;
            $wallet->save();

            $this->ledgerService->record(
                $wallet,
                WalletMutation::TYPE_HOLD,
                $unitPrice,
                'debit',
                'Retry aktivasi voucher fisik: ' . $locked->serial_number,
                $batch->transaction_id
            );

            $locked->update([
                'status' => VoucherPhysicalBatchItem::STATUS_QUEUED,
                'failure_reason' => null,
                'refund_amount' => null,
                'refunded_at' => null,
                'submitted_at' => null,
                'activated_at' => null,
                'provider_ref' => null,
                'retry_count' => $locked->retry_count + 1,
            ]);

            // The batch/transaction may already have closed as completed_with_failures/FAILED —
            // reopen so this fresh attempt is reflected until it resolves again.
            VoucherPhysicalBatch::where('id', $batch->id)->update([
                'status' => VoucherPhysicalBatch::STATUS_PROCESSING,
            ]);
            Transaction::where('id', $batch->transaction_id)->update([
                'status' => TransactionStatus::LOCKED->value,
            ]);

            if ($locked->provider_code && $locked->provider_sku) {
                $rateLimit = (int) config('ppob.physical_batch.rate_limit_per_minute.' . $locked->provider_code, 60);
                ProcessVoucherPhysicalBatchItem::dispatch($locked->id, $locked->provider_code, $locked->provider_sku, $rateLimit);
            }

            return $locked;
        });
    }
}
