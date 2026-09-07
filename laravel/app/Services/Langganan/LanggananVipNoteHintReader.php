<?php

namespace App\Services\Langganan;

use App\Models\Product;
use App\Models\ProductProvider;
use App\Models\ProductProviderSku;

/**
 * Conservative VIP prepaid `note` → langganan account fields.
 * Returns null when note missing/unclear.
 */
class LanggananVipNoteHintReader
{
    /**
     * @return array{delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}|null
     */
    public function read(string $skuCode): ?array
    {
        $note = $this->loadNote($skuCode);
        if ($note === null) {
            return null;
        }

        return app(LanggananDigiflazzHintReader::class)->parseDesc($note);
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
