<?php

namespace App\Actions\Transaction;

use App\Models\Transaction;
use App\Models\WebsiteSetting;

class GetReceiptAction
{
    /**
     * Build the receipt structure from a transaction object.
     */
    public function execute(Transaction $transaction): array
    {
        $transaction->load(['items', 'user', 'digiflazzTransaction']);
        $firstItem = $transaction->items->first();

        $productCode = $firstItem ? $firstItem->product_code : '';
        $productName = $firstItem ? $firstItem->product_name : $transaction->service_name;
        $price = $firstItem ? (float) $firstItem->price : (float) $transaction->amount;
        $quantity = $firstItem ? (int) $firstItem->quantity : 1;

        // Real provider serial number recorded by the Digiflazz webhook/fulfillment job
        $serialNumber = $transaction->digiflazzTransaction?->sn;

        // Company identity comes from the CMS-managed website settings
        $settings = WebsiteSetting::first();

        return [
            'header' => [
                'company_name' => $settings?->website_name ?? config('app.name'),
                'tagline' => $settings?->tagline,
                'address' => $settings?->office_address,
                'support_phone' => $settings?->support_phone,
                'support_email' => $settings?->support_email,
            ],
            'transaction_details' => [
                'invoice_number' => $transaction->invoice_number,
                'date' => $transaction->created_at ? $transaction->created_at->toIso8601String() : now()->toIso8601String(),
                'status' => $transaction->status,
                'service_name' => $transaction->service_name,
                'target_number' => $transaction->target_number,
                'payment_method' => strtoupper($transaction->payment_method),
                'serial_number' => $serialNumber,
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
