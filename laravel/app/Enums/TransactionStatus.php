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

    // SRS 14.3 — canonical terminal state for a transaction that had already reached
    // SUCCESS but was later proven to have failed in the field. SUCCESS must never
    // transition directly to FAILED; it becomes REFUNDED instead (audit trail preserved).
    // Sprint 3 only adds this vocabulary — no code path triggers this transition yet
    // (Finance refund-of-SUCCESS workflow remains deferred to a later sprint).
    case REFUNDED = 'refunded';

    // Backwards compatibility with previous sprints
    case SUKSES = 'sukses';
    case GAGAL = 'gagal';
}
