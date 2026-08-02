<?php

namespace App\Enums;

enum WalletHistoryType: string
{
    case CREDIT = 'credit';
    case DEBIT = 'debit';
}
