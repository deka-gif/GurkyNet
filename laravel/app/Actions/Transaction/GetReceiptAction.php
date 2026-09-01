<?php

namespace App\Actions\Transaction;

use App\Models\Transaction;
use App\Models\WebsiteSetting;
use App\Support\PlnTokenParser;
use App\Support\VoucherCodeParser;

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
        $meta = is_array($firstItem?->custom_metadata) ? $firstItem->custom_metadata : [];

        // Real provider serial number recorded by Digiflazz/VIP fulfillment
        $serialNumber = $transaction->digiflazzTransaction?->sn
            ?: (is_array($transaction->provider_response)
                ? ($transaction->provider_response['data']['sn']
                    ?? $transaction->provider_response['sn']
                    ?? null)
                : null);
        if (!is_string($serialNumber) || trim($serialNumber) === '') {
            $serialNumber = null;
        }

        $isVoucher = !empty($meta['is_voucher']);
        $isLangganan = !empty($meta['is_langganan']);
        $isVoucherInternet = !empty($meta['is_voucher_internet']);
        $tokenCode = ($isVoucher || $isLangganan || $isVoucherInternet) ? null : PlnTokenParser::extract($serialNumber);
        $tokenGrouped = $tokenCode ? PlnTokenParser::formatGrouped($tokenCode) : null;
        $deliverableParts = ($isVoucher || $isLangganan || $isVoucherInternet)
            ? VoucherCodeParser::parse($serialNumber)
            : ['voucher_code' => null, 'voucher_url' => null, 'voucher_barcode' => null];
        $voucherParts = $isVoucher ? $deliverableParts : ['voucher_code' => null, 'voucher_url' => null, 'voucher_barcode' => null];
        $langgananParts = $isLangganan ? $deliverableParts : ['voucher_code' => null, 'voucher_url' => null, 'voucher_barcode' => null];
        $voucherInternetParts = $isVoucherInternet ? $deliverableParts : ['voucher_code' => null, 'voucher_url' => null, 'voucher_barcode' => null];

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
                'customer_name' => $meta['customer_name'] ?? null,
                'segment_power' => $meta['segment_power'] ?? null,
                'meter_no' => $meta['meter_no'] ?? null,
                'token_code' => $tokenCode,
                'token_code_grouped' => $tokenGrouped,
                'is_pln_token' => !$isVoucher && !$isLangganan && (!empty($meta['pln_prepaid']) || $tokenCode !== null),
                'is_pajak_negara' => !empty($meta['is_pajak_negara']),
                'is_ewallet' => !empty($meta['is_ewallet']),
                'is_game' => !empty($meta['is_game']),
                'is_voucher' => $isVoucher,
                'is_langganan' => $isLangganan,
                'is_voucher_internet' => $isVoucherInternet,
                'voucher_code' => $isVoucher ? ($voucherParts['voucher_code'] ?? null) : null,
                'voucher_url' => $isVoucher ? ($voucherParts['voucher_url'] ?? null) : null,
                'voucher_barcode' => $isVoucher ? ($voucherParts['voucher_barcode'] ?? null) : null,
                'activation_code' => $isLangganan ? ($langgananParts['voucher_code'] ?? null) : null,
                'activation_url' => $isLangganan ? ($langgananParts['voucher_url'] ?? null) : null,
                'voucher_internet_code' => $isVoucherInternet ? ($voucherInternetParts['voucher_code'] ?? null) : null,
                'voucher_internet_url' => $isVoucherInternet ? ($voucherInternetParts['voucher_url'] ?? null) : null,
                'nickname' => $meta['nickname'] ?? ($meta['customer_name'] ?? null),
                'game_brand' => $meta['game_brand'] ?? ($meta['game_label'] ?? null),
                'game_user_id' => $meta['user_id'] ?? null,
                'game_zone_id' => $meta['zone_id'] ?? null,
                'voucher_brand' => $meta['voucher_brand'] ?? ($meta['provider'] ?? null),
                'langganan_brand' => $meta['langganan_brand'] ?? ($meta['provider'] ?? null),
                'langganan_target_display' => $meta['langganan_target_display'] ?? null,
                'langganan_delivery' => $meta['langganan_delivery'] ?? null,
                'pajak_jenis' => $meta['pajak_jenis'] ?? null,
                'bill_amount' => $meta['bill_amount'] ?? null,
                'nominal_amount' => $meta['nominal_amount'] ?? ($meta['bill_amount'] ?? null),
                'denda' => $meta['denda'] ?? null,
                'tax_details' => is_array($meta['tax_details'] ?? null) ? $meta['tax_details'] : [],
                'provider_ref' => $transaction->provider_ref
                    ?: ($meta['inquiry_ref_id'] ?? null)
                    ?: ($transaction->digiflazzTransaction?->ref_id),
                'ntpn' => $this->resolveNtpn($meta, is_string($serialNumber) ? $serialNumber : null),
                'nomor_pengesahan' => $this->resolvePengesahan($meta, is_string($serialNumber) ? $serialNumber : null),
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
                'subtotal' => isset($meta['bill_amount']) ? (float) $meta['bill_amount'] : ($price * $quantity),
                'denda' => isset($meta['denda']) ? (float) $meta['denda'] : 0,
                'admin_fee' => (float) $transaction->admin_fee,
                'total_payment' => (float) $transaction->total_payment,
            ],
            'footer' => [
                'note' => 'Terima kasih telah menggunakan layanan GurkyPay. Simpan struk ini sebagai bukti transaksi yang sah.',
            ]
        ];
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    protected function resolveNtpn(array $meta, ?string $serialNumber): ?string
    {
        $tax = is_array($meta['tax_details'] ?? null) ? $meta['tax_details'] : [];
        foreach (['ntpn', 'NTPN'] as $key) {
            $val = trim((string) ($tax[$key] ?? ''));
            if ($val !== '') {
                return $val;
            }
        }
        if ($serialNumber && preg_match('/\bNTPN[:\s]*([A-Z0-9\-]+)/i', $serialNumber, $m)) {
            return $m[1];
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    protected function resolvePengesahan(array $meta, ?string $serialNumber): ?string
    {
        $tax = is_array($meta['tax_details'] ?? null) ? $meta['tax_details'] : [];
        foreach (['nomor_pengesahan', 'pengesahan'] as $key) {
            $val = trim((string) ($tax[$key] ?? ''));
            if ($val !== '') {
                return $val;
            }
        }
        // Digiflazz often returns NTPN / pengesahan inside SN for government tax.
        if ($serialNumber && trim($serialNumber) !== '') {
            return trim($serialNumber);
        }

        return null;
    }
}
