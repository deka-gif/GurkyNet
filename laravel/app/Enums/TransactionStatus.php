<?php

namespace App\Enums;

enum TransactionStatus: string
{
    case DRAFT = 'draft';
    case PENDING = 'pending';
    case PROCESSING = 'processing';
    case SUCCESS = 'success';
    case FAILED = 'failed';
    case CANCELED = 'canceled';
    case EXPIRED = 'expired';

    // Backwards compatibility with previous sprints
    case SUKSES = 'sukses';
    case GAGAL = 'gagal';
}
