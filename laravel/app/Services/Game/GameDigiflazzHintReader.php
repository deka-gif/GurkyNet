<?php

namespace App\Services\Game;

use App\Models\DigiflazzProduct;

/**
 * Conservative Digiflazz `desc` → game account fields (per SKU).
 * Returns null when desc does not clearly specify a target format — never guess.
 *
 * Patterns are derived only from real Digiflazz seller `desc` text observed in catalog
 * (fail-closed). Do not infer schema from brand popularity or industry defaults alone.
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

        // Phone / HP wording is never treated as a game top-up account schema here
        // (e.g. Razer Gold "Masukkan No Hp …") — leave fail-closed for manual Owner decision.
        if (preg_match('/\b(no\.?\s*hp|nomor\s*hp|no\.?\s*handphone|nomor\s*handphone)\b/u', $hay)) {
            return null;
        }

        // --- Two-field patterns (check before single-field) ---

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

        // Digi Genshin-style: "Format no tujuan [UID]|[Server]"
        // Requires both UID and Server markers plus pipe or "format" so product names alone never match.
        if (
            preg_match('/\buid\b/u', $hay)
            && preg_match('/\bserver\b/u', $hay)
            && (str_contains($hay, '|') || preg_match('/\bformat\b/u', $hay))
        ) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'user_id', 'label' => 'UID', 'required' => true],
                    ['key' => 'server_id', 'label' => 'Server', 'required' => true],
                ],
            ];
        }

        // user_id + server_id (same meaning as UID|Server, alternate Digi wording)
        if (
            preg_match('/user[_\s-]?id/u', $hay)
            && preg_match('/server[_\s-]?id/u', $hay)
        ) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'user_id', 'label' => 'User ID', 'required' => true],
                    ['key' => 'server_id', 'label' => 'Server ID', 'required' => true],
                ],
            ];
        }

        // --- Single-field patterns ---

        // "Masukkan UID" (FC Mobile) — require masukkan + uid (avoid bare "id")
        if (preg_match('/masukkan\s+uid\b/u', $hay)) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'user_id', 'label' => 'UID', 'required' => true],
                ],
            ];
        }

        // "Masukkan User ID" / Player ID without zone/server
        if (
            preg_match('/masukkan\s+(user\s*id|userid|player\s*id)\b/u', $hay)
            && ! preg_match('/\bzone\b/u', $hay)
            && ! preg_match('/\bserver\b/u', $hay)
        ) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'user_id', 'label' => 'User ID', 'required' => true],
                ],
            ];
        }

        // Digi: "Masukkan ID" / "Masukkan ID Akun" (Valorant, AU2, AFK Journey)
        // Require explicit "masukkan" + "id" — never bare "id" in product blurbs.
        if (
            preg_match('/masukkan\s+id(\s+akun)?\b/u', $hay)
            && ! preg_match('/\bzone\b/u', $hay)
            && ! preg_match('/\bserver\b/u', $hay)
        ) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'user_id', 'label' => 'ID', 'required' => true],
                ],
            ];
        }

        // Digi: "Masukkan username." / "masukkan username akun game anda."
        if (
            preg_match('/masukkan\s+username\b/u', $hay)
            && ! preg_match('/\bzone\b/u', $hay)
            && ! preg_match('/\bserver\b/u', $hay)
        ) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'user_id', 'label' => 'Username', 'required' => true],
                ],
            ];
        }

        // Digi Garena Shell: "Tujuan = ID garena"
        if (preg_match('/\bid\s*garena\b/u', $hay) || preg_match('/garena\s*id\b/u', $hay)) {
            return [
                'delivery' => 'account',
                'fields' => [
                    ['key' => 'garena_id', 'label' => 'Garena ID', 'required' => true],
                ],
            ];
        }

        return null;
    }
}
