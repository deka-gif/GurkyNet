<?php

namespace App\Actions\Transaction;

use App\Models\Transaction;

class GetReceiptAction
{
    /**
     * Build the receipt structure from a transaction object.
     */
    public function execute(Transaction $transaction): array
    {
        $transaction->load(['items', 'user']);
        $firstItem = $transaction->items->first();

        $productCode = $firstItem ? $firstItem->product_code : '';
        $productName = $firstItem ? $firstItem->product_name : $transaction->service_name;
        $price = $firstItem ? (float) $firstItem->price : (float) $transaction->amount;
        $quantity = $firstItem ? (int) $firstItem->quantity : 1;

        // Extract custom metadata if available
        $customMetadata = $firstItem ? ($firstItem->custom_metadata ?? []) : [];
        $providerName = $customMetadata['provider'] ?? '';

        // Generate a simulated serial number (SN) if the transaction is successful
        $serialNumber = 'DUMMY-SN-' . now()->format('Ymd') . '-' . mt_rand(100000, 999999);

        return [
            'header' => [
                'company_name' => 'GurkyPay',
                'tagline' => 'Solusi Pembayaran Digital Tercepat',
                'address' => 'Gedung Gurky Lt. 5, Jakarta Selatan, Indonesia',
                'support_phone' => '021-80682222',
                'support_email' => 'support@gurkypay.com',
            ],
            'transaction_details' => [
                'invoice_number' => $transaction->invoice_number,
                'date' => $transaction->created_at ? $transaction->created_at->toIso8601String() : now()->toIso8601String(),
                'status' => $transaction->status,
                'service_name' => $transaction->service_name,
                'target_number' => $transaction->target_number,
                'payment_method' => strtoupper($transaction->payment_method),
                'serial_number' => $transaction->status === 'success' ? $serialNumber : null,
            ],
            'items' => [
                [
                    'sku_code' => $productCode,
                    'name' => $productName,
                    'price' => $price,
                    'quantity' => $quantity,
                    'total' => $price * $quantity,
                ]
            ],
            'payment_summary' => [
                'subtotal' => $price * $quantity,
                'admin_fee' => (float) $transaction->admin_fee,
                'total_payment' => (float) $transaction->total_payment,
            ],
            'footer' => [
                'note' => 'Terima kasih telah menggunakan layanan GurkyPay. Simpan struk ini sebagai bukti transaksi yang sah.',
            ]
        ];
    }
}
