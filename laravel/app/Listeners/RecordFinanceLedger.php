<?php

namespace App\Listeners;

use App\Events\WalletCredited;
use App\Events\WalletDebited;
use App\Models\Transaction;
use App\Services\Finance\FinanceLedgerService;
use Illuminate\Support\Facades\Log;

/**
 * Safe hook: append finance ledger on wallet credit/debit without rewriting wallet engines.
 */
class RecordFinanceLedger
{
    public function __construct(
        protected FinanceLedgerService $ledger
    ) {}

    public function handle(object $event): void
    {
        try {
            if ($event instanceof WalletCredited) {
                $this->onCredit($event);
            } elseif ($event instanceof WalletDebited) {
                $this->onDebit($event);
            }
        } catch (\Throwable $e) {
            Log::warning('RecordFinanceLedger failed', ['error' => $e->getMessage()]);
        }
    }

    protected function onCredit(WalletCredited $event): void
    {
        $reason = (string) $event->reason;
        $eventType = 'wallet_topup';
        $source = 'wallet';

        if (stripos($reason, 'Refund') !== false || stripos($reason, 'refund') !== false) {
            $eventType = 'wallet_refund';
            $source = 'workflow';
            if (stripos($reason, 'finance') !== false || stripos($reason, 'workflow') !== false) {
                $eventType = 'refund_approve';
            }
        } elseif (stripos($reason, 'Adjustment') !== false) {
            $eventType = 'manual_adjustment';
            $source = 'admin';
        } elseif (stripos($reason, 'Transfer') !== false) {
            $eventType = 'wallet_transfer';
        } elseif (stripos($reason, 'Top Up') !== false || stripos($reason, 'Topup') !== false) {
            $eventType = 'wallet_topup';
            $source = 'payment';
        }

        $tx = $event->referenceId ? Transaction::query()->find($event->referenceId) : null;

        $this->ledger->record([
            'user_id' => $event->wallet->user_id,
            'transaction_id' => $event->referenceId,
            'invoice' => $tx?->invoice_number,
            'source_module' => $source,
            'event_type' => $eventType,
            'debit' => 0,
            'credit' => $event->amount,
            'balance_snapshot' => (float) $event->wallet->fresh()->balance,
            'reference' => $reason,
            'meta' => ['reason' => $reason],
        ]);

        if ($eventType === 'wallet_topup') {
            $this->ledger->record([
                'user_id' => $event->wallet->user_id,
                'transaction_id' => $event->referenceId,
                'invoice' => $tx?->invoice_number,
                'source_module' => 'payment',
                'event_type' => 'payment_success',
                'debit' => 0,
                'credit' => $event->amount,
                'balance_snapshot' => (float) $event->wallet->fresh()->balance,
                'reference' => $reason,
                'meta' => ['paired' => 'wallet_topup'],
            ]);
        }
    }

    protected function onDebit(WalletDebited $event): void
    {
        $reason = (string) $event->reason;
        $eventType = 'product_purchase';
        $source = 'transaction';

        if (stripos($reason, 'Adjustment') !== false) {
            $eventType = 'manual_adjustment';
            $source = 'admin';
        } elseif (stripos($reason, 'Transfer') !== false) {
            $eventType = 'wallet_transfer';
            $source = 'wallet';
        }

        $tx = $event->referenceId ? Transaction::query()->find($event->referenceId) : null;

        $this->ledger->record([
            'user_id' => $event->wallet->user_id,
            'transaction_id' => $event->referenceId,
            'invoice' => $tx?->invoice_number,
            'source_module' => $source,
            'event_type' => $eventType,
            'debit' => $event->amount,
            'credit' => 0,
            'balance_snapshot' => (float) $event->wallet->fresh()->balance,
            'reference' => $reason,
            'meta' => ['reason' => $reason],
        ]);
    }
}
