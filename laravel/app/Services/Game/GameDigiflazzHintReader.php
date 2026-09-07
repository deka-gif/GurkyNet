<?php

namespace App\Services\Game;

use App\Models\DigiflazzProduct;

/**
 * Conservative Digiflazz `desc` → game account fields (per SKU).
 * Returns null when desc does not clearly specify a target format — never guess.
 */
class GameDigiflazzHintReader
{
    /**
     * @return array{delivery:string,fields:list<array{key:string,label:string,required:bool}>}|null
     */
    public function read(string $skuCode): ?array
    {
        $sku = trim($skuCode);
        if ($sku === '') {
            return null;
        }

        $row = DigiflazzProduct::query()
            ->where('buyer_sku_code', $sku)
            ->first(['desc']);

        if (!$row) {
            return null;
        }

        $desc = trim((string) ($row->desc ?? ''));
        if ($desc === '' || $desc === '-') {
            return null;
        }

        return $this->parseDesc($desc);
    }

    /**
     * @return array{delivery:string,fields:list<array{key:string,label:string,required:bool}>}|null
     */
    public function parseDesc(string $desc): ?array
    {
        $hay = strtolower(trim($desc));
        if ($hay === '' || $hay === '-') {
            return null;
        }

        // Explicit Digi wording: customer_no = user_id + zone_id
        if (
            preg_match('/user[_\s-]?id/u', $hay)
            && preg_match('/zone[_\s-]?id/u', $hay)
        ) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'user_id', 'label' => 'User ID', 'required' => true],
                    ['key' => 'zone_id', 'label' => 'Zone ID', 'required' => true],
                ],
            ];
        }

        // "Masukkan UID" (FC Mobile) — require masukkan + uid (avoid bare "id")
        if (preg_match('/masukkan\s+uid\b/u', $hay)) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'user_id', 'label' => 'UID', 'required' => true],
                ],
            ];
        }

        // "Masukkan User ID" / Player ID without zone
        if (
            preg_match('/masukkan\s+(user\s*id|userid|player\s*id)\b/u', $hay)
            && ! preg_match('/zone/u', $hay)
        ) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'user_id', 'label' => 'User ID', 'required' => true],
                ],
            ];
        }

        return null;
    }
}
