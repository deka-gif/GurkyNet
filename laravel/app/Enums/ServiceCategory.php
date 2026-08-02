<?php

namespace App\Enums;

enum ServiceCategory: string
{
    case PULSA = 'pulsa';
    case DATA = 'paket data';
    case PLN = 'token pln';
    case VOUCHER = 'voucher';
    case TRANSFER = 'transfer';
    case TAGIHAN = 'tagihan';
    case GAME = 'game';
    case EWALLET = 'e-wallet';
}
