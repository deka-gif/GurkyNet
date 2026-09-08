<?php

/**
 * PLN Token / prepaid Digi utilities (not customer purchase products).
 *
 * Mirrored after gurky_game.non_purchase_skus / gurky_langganan.non_purchase_skus.
 * Token PLN meter inquiry uses Digiflazz POST /inquiry-pln — not these buyer_sku codes.
 */

return [

    /**
     * Digi SKUs that are lookup/utility — never customer-purchasable catalog products.
     *
     * @var list<string>
     */
    'non_purchase_skus' => [
        'pre33794859', // Cek Nama Token PLN — Digi utility, not token denomination
    ],

];
