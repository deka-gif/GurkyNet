<?php

namespace App\Services\Langganan;

use App\Models\DigiflazzProduct;

/**
 * Reads Digiflazz product desc (provider data) to infer customer_no input fields per SKU.
 * Returns null when desc does not clearly specify a target format.
 */
class LanggananDigiflazzHintReader
{
    /**
     * @return array{delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}|null
     */
    public function read(string $skuCode): ?array
    {
        $sku = trim($skuCode);
        if ($sku === '') {
            return null;
        }

        $row = DigiflazzProduct::query()
            ->where('buyer_sku_code', $sku)
            ->first(['desc', 'product_name']);

        if (!$row) {
            return null;
        }

        $desc = trim((string) ($row->desc ?? ''));
        if ($desc === '') {
            return null;
        }

        return $this->parseDesc($desc);
    }

    /**
     * @return array{delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}|null
     */
    public function parseDesc(string $desc): ?array
    {
        $hay = strtolower(trim($desc));

        if ($hay === '') {
            return null;
        }

        $fields = [];

        if (preg_match('/\b(email|e-mail|gmail)\b/u', $hay)) {
            $fields[] = [
                'key' => 'email',
                'label' => 'Email Akun',
                'required' => true,
                'input' => 'email',
            ];
        }

        if (preg_match('/\b(nomor hp|no hp|no\. hp|nohp|phone|whatsapp|wa)\b/u', $hay)) {
            $fields[] = [
                'key' => 'phone',
                'label' => 'Nomor HP',
                'required' => true,
                'input' => 'phone',
            ];
        }

        if (preg_match('/\b(user id|userid|player id|customer id|id pelanggan|id akun|uid)\b/u', $hay)) {
            $fields[] = [
                'key' => 'user_id',
                'label' => 'User ID / ID Akun',
                'required' => true,
                'input' => 'text',
            ];
        }

        if ($fields !== []) {
            return [
                'delivery' => 'account',
                'fields' => $fields,
            ];
        }

        if (preg_match('/\b(voucher|kode aktivasi|serial number|sn\b|tanpa input|tidak perlu)\b/u', $hay)) {
            return [
                'delivery' => 'voucher',
                'fields' => [],
            ];
        }

        return null;
    }
}
