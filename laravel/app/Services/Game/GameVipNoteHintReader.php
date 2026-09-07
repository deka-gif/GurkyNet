<?php

namespace App\Services\Game;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;

/**
 * Conservative VIP prepaid `note` → game account fields (per SKU).
 * Reads ProductProviderSku.provider_meta.note when present after sync.
 * Returns null when note is missing/unclear — never guess.
 */
class GameVipNoteHintReader
{
    /**
     * @return array{delivery:string,fields:list<array{key:string,label:string,required:bool}>}|null
     */
    public function read(string $skuCode): ?array
    {
        $note = $this->loadNote($skuCode);
        if ($note === null) {
            return null;
        }

        return $this->parseNote($note);
    }

    /**
     * @return array{delivery:string,fields:list<array{key:string,label:string,required:bool}>}|null
     */
    public function parseNote(string $note): ?array
    {
        // Reuse Digi conservative patterns — same language, no category heuristics.
        return app(GameDigiflazzHintReader::class)->parseDesc($note);
    }

    protected function loadNote(string $skuCode): ?string
    {
        $sku = trim($skuCode);
        if ($sku === '') {
            return null;
        }

        $vipId = ProductProvider::vip()?->id;
        if (! $vipId) {
            return null;
        }

        $providerSku = str_starts_with(strtoupper($sku), 'VIP-')
            ? substr($sku, 4)
            : $sku;

        $row = ProductProviderSku::query()
            ->where('product_provider_id', $vipId)
            ->where(function ($q) use ($sku, $providerSku) {
                $q->where('provider_sku', $providerSku);
                $productId = Product::query()->where('sku_code', $sku)->value('id');
                if ($productId) {
                    $q->orWhere('product_id', $productId);
                }
            })
            ->first(['provider_meta']);

        if (! $row) {
            return null;
        }

        $meta = is_array($row->provider_meta) ? $row->provider_meta : [];
        $note = trim((string) ($meta['note'] ?? ''));
        if ($note === '' || $note === '-') {
            return null;
        }

        return $note;
    }
}
