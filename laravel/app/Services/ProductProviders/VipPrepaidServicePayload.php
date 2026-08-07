<?php

namespace App\Services\ProductProviders;

/**
 * Normalize VIP Reseller prepaid `type=services` catalog rows (VIPayment API Prepaid.pdf).
 *
 * Official fields: brand, code, name, note, price.{basic,premium,special}, status,
 * multi_trx, maintenace (PDF spelling), category, prepost, type.
 */
final class VipPrepaidServicePayload
{
    /**
     * @param  array<string, mixed>  $row
     * @return array{
     *   brand:string,
     *   code:string,
     *   name:string,
     *   note:string,
     *   price:array{basic:?float,premium:?float,special:?float},
     *   resolved_price:float,
     *   status:string,
     *   multi_trx:?bool,
     *   maintenace:?string,
     *   category:string,
     *   prepost:string,
     *   type:string,
     *   meta:array<string, mixed>
     * }
     */
    public static function normalize(array $row): array
    {
        $tiers = self::priceTiers($row['price'] ?? null);
        $resolved = self::resolvePrice($tiers, $row);

        $code = trim((string) ($row['code'] ?? $row['service'] ?? $row['sku'] ?? ''));
        $name = trim((string) ($row['name'] ?? $row['product_name'] ?? ''));
        $brand = trim((string) ($row['brand'] ?? $row['operator'] ?? $row['game'] ?? ''));
        $status = strtolower(trim((string) ($row['status'] ?? '')));
        $category = trim((string) ($row['category'] ?? ''));
        $prepost = trim((string) ($row['prepost'] ?? ''));
        $type = trim((string) ($row['type'] ?? ''));
        $note = trim((string) ($row['note'] ?? ''));

        // PDF field name is intentionally misspelled as "maintenace".
        $maintenace = null;
        if (array_key_exists('maintenace', $row) && $row['maintenace'] !== null && $row['maintenace'] !== '') {
            $maintenace = trim((string) $row['maintenace']);
        } elseif (array_key_exists('maintenance', $row) && $row['maintenance'] !== null && $row['maintenance'] !== '') {
            // Accept corrected spelling if VIP ever sends it; store under official key.
            $maintenace = trim((string) $row['maintenance']);
        }

        $multiTrx = null;
        if (array_key_exists('multi_trx', $row)) {
            $multiTrx = filter_var($row['multi_trx'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($multiTrx === null && is_numeric($row['multi_trx'])) {
                $multiTrx = ((int) $row['multi_trx']) === 1;
            }
        }

        $meta = [
            'price_tiers' => $tiers,
            'multi_trx' => $multiTrx,
            'maintenace' => $maintenace,
            'category' => $category !== '' ? $category : null,
            'prepost' => $prepost !== '' ? $prepost : null,
            'type' => $type !== '' ? $type : null,
        ];

        return [
            'brand' => $brand,
            'code' => $code,
            'name' => $name,
            'note' => $note,
            'price' => $tiers,
            'resolved_price' => $resolved,
            'status' => $status,
            'multi_trx' => $multiTrx,
            'maintenace' => $maintenace,
            'category' => $category,
            'prepost' => $prepost,
            'type' => $type,
            'meta' => $meta,
        ];
    }

    /**
     * @return array{basic:?float,premium:?float,special:?float}
     */
    public static function priceTiers(mixed $price): array
    {
        $tiers = ['basic' => null, 'premium' => null, 'special' => null];

        if (! is_array($price)) {
            return $tiers;
        }

        foreach (['basic', 'premium', 'special'] as $key) {
            if (isset($price[$key]) && is_numeric($price[$key])) {
                $tiers[$key] = (float) $price[$key];
            }
        }

        return $tiers;
    }

    /**
     * Official tier order from prepaid services examples: basic → premium → special.
     *
     * @param  array{basic:?float,premium:?float,special:?float}  $tiers
     * @param  array<string, mixed>  $row
     */
    public static function resolvePrice(array $tiers, array $row = []): float
    {
        foreach (['basic', 'premium', 'special'] as $key) {
            if ($tiers[$key] !== null) {
                return (float) $tiers[$key];
            }
        }

        $price = $row['price'] ?? null;
        if (is_numeric($price)) {
            return (float) $price;
        }

        if (isset($row['harga']) && is_numeric($row['harga'])) {
            return (float) $row['harga'];
        }

        return 0.0;
    }
}
