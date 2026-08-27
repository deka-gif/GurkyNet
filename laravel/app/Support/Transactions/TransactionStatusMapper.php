<?php

namespace App\Support\Transactions;

use App\Enums\TransactionStatus;

/**
 * SRS 14.3 — map-on-read for legacy status values without destructive backfill.
 */
final class TransactionStatusMapper
{
    /**
     * Normalize any stored status (legacy or SRS) to SRS 14.3 vocabulary for API/UI.
     */
    public static function toSrs(?string $raw): string
    {
        $value = strtoupper(trim((string) $raw));

        // Always return SRS 14.3 vocabulary (uppercase), never legacy storage strings.
        return match ($value) {
            'INITIATED', 'DRAFT' => 'INITIATED',
            'LOCKED' => 'LOCKED',
            'SENT_TO_SUPPLIER' => 'SENT_TO_SUPPLIER',
            'PENDING_SUPPLIER' => 'PENDING_SUPPLIER',
            'PENDING', 'PROCESSING' => 'SENT_TO_SUPPLIER',
            'SUCCESS', 'SUKSES' => 'SUCCESS',
            'FAILED', 'GAGAL', 'CANCELED', 'CANCELLED', 'EXPIRED' => 'FAILED',
            'REFUNDED' => 'REFUNDED',
            default => $value !== '' ? $value : 'INITIATED',
        };
    }

    public static function isSuccess(?string $raw): bool
    {
        return self::toSrs($raw) === 'SUCCESS';
    }

    public static function isFailed(?string $raw): bool
    {
        return self::toSrs($raw) === 'FAILED';
    }

    public static function isRefunded(?string $raw): bool
    {
        return self::toSrs($raw) === 'REFUNDED';
    }

    /**
     * Statuses that still need provider reconciliation (SRS 14.4).
     *
     * @return list<string>
     */
    public static function reconcileOpenStatuses(): array
    {
        return [
            TransactionStatus::LOCKED->value,
            TransactionStatus::SENT_TO_SUPPLIER->value,
            TransactionStatus::PENDING_SUPPLIER->value,
            // Legacy open states still present in historical / in-flight rows
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
            TransactionStatus::DRAFT->value,
        ];
    }

    /**
     * In-flight statuses eligible for provider dispatch / settlement (SRS 14.3 / 15.3).
     *
     * @return list<string>
     */
    public static function fulfillOpenStatuses(): array
    {
        return [
            TransactionStatus::LOCKED->value,
            TransactionStatus::SENT_TO_SUPPLIER->value,
            TransactionStatus::PENDING_SUPPLIER->value,
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ];
    }

    /**
     * Statuses that may start a first provider send (claim before SENT_TO_SUPPLIER).
     *
     * @return list<string>
     */
    public static function dispatchClaimStatuses(): array
    {
        return [
            TransactionStatus::LOCKED->value,
            TransactionStatus::PENDING->value,
            TransactionStatus::PROCESSING->value,
        ];
    }

    public static function isFulfillOpen(?string $raw): bool
    {
        return in_array((string) $raw, self::fulfillOpenStatuses(), true);
    }

    /**
     * Values that mean "already settled successfully" for refund refusal / SUCCESS→REFUNDED.
     *
     * @return list<string>
     */
    public static function successRawValues(): array
    {
        return [
            TransactionStatus::SUCCESS->value,
            TransactionStatus::SUKSES->value,
            'success',
            'sukses',
            'SUCCESS',
        ];
    }
}
