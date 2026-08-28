<?php

namespace App\Support\Transactions;

use App\Models\Transaction;

/**
 * Shared GRK-YYYYMMDD-NNNNNN invoice numbering — used by every Transaction-creating
 * Action so the daily sequence never drifts between independent implementations.
 */
class InvoiceNumberGenerator
{
    public static function generate(): string
    {
        $date = now()->format('Ymd');

        $lastTransaction = Transaction::where('invoice_number', 'like', "GRK-{$date}-%")
            ->orderBy('id', 'desc')
            ->first();

        $nextNumber = 1;
        if ($lastTransaction) {
            $parts = explode('-', $lastTransaction->invoice_number);
            $lastNum = (int) end($parts);
            $nextNumber = $lastNum + 1;
        }

        return 'GRK-' . $date . '-' . str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
    }
}
