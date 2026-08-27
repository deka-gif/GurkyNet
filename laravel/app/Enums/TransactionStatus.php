<?php

namespace App\Enums;

/**
 * SRS 14.3 — transaction state machine + legacy compatibility.
 *
 * Purchase pipeline writes: INITIATED → LOCKED → SENT_TO_SUPPLIER → success|failed|PENDING_SUPPLIER.
 * Terminal success/failed keep lowercase storage for historical rows & Midtrans paths;
 * API/UI expose SRS vocabulary via TransactionStatusMapper::toSrs().
 * SUCCESS must never transition to FAILED — only to REFUNDED (14.3).
 */
enum TransactionStatus: string
{
    // —— SRS 14.3 pipeline (stored as written) ——
    case INITIATED = 'INITIATED';
    case LOCKED = 'LOCKED';
    case SENT_TO_SUPPLIER = 'SENT_TO_SUPPLIER';
    case PENDING_SUPPLIER = 'PENDING_SUPPLIER';
    case REFUNDED = 'REFUNDED';

    // —— Terminal (lowercase storage; map-on-read → SUCCESS / FAILED) ——
    case SUCCESS = 'success';
    case FAILED = 'failed';

    // —— Legacy compatibility (map-on-read; do not destroy historical rows) ——
    case DRAFT = 'draft';
    case PENDING = 'pending';
    case PROCESSING = 'processing';
    case CANCELED = 'canceled';
    case EXPIRED = 'expired';
    case SUKSES = 'sukses';
    case GAGAL = 'gagal';
    case REFUNDED_LEGACY = 'refunded';
}
