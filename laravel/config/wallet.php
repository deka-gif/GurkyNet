<?php

/**
 * Server-authoritative wallet money-move fees.
 *
 * Never accept admin_fee from client request bodies. Defaults are 0.00 —
 * matching pre-existing controller fallbacks (`config('wallet.transfer_fee', 0)`,
 * top-up/withdraw input default 0). Non-zero business fees require explicit
 * env/ops configuration; do not invent fee amounts in application code.
 */
return [
    'transfer_fee' => (float) env('WALLET_TRANSFER_FEE', 0),
    'withdraw_fee' => (float) env('WALLET_WITHDRAW_FEE', 0),
    'topup_fee' => (float) env('WALLET_TOPUP_FEE', 0),
];
