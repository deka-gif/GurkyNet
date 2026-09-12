<?php

namespace App\Enums;

/**
 * Customer account deletion lifecycle (Owner-approved 30-day grace).
 * SoftDeletes deleted_at is applied only when status becomes purged.
 */
enum AccountDeletionStatus: string
{
    case PENDING_DELETION = 'pending_deletion';
    case PURGED = 'purged';

    public const REASON_CODES = [
        'too_expensive',
        'switching_app',
        'privacy',
        'unused',
        'other',
    ];
}
