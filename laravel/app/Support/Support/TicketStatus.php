<?php

namespace App\Support\Support;

/**
 * FR-CS-02 — ticket status vocabulary (SRS Bagian 7.8) + legacy compatibility.
 * Canonical storage going forward: open | assigned_cs | escalated_ops | escalated_finance | resolved | closed.
 */
final class TicketStatus
{
    public const OPEN = 'open';

    public const ASSIGNED_CS = 'assigned_cs';

    public const ESCALATED_OPS = 'escalated_ops';

    public const ESCALATED_FINANCE = 'escalated_finance';

    public const RESOLVED = 'resolved';

    public const CLOSED = 'closed';

    /** @return list<string> */
    public static function all(): array
    {
        return [
            self::OPEN,
            self::ASSIGNED_CS,
            self::ESCALATED_OPS,
            self::ESCALATED_FINANCE,
            self::RESOLVED,
            self::CLOSED,
        ];
    }

    /**
     * Normalize any input (SRS / EN / legacy ID) to canonical SRS status.
     */
    public static function normalize(?string $raw, string $default = self::OPEN): string
    {
        $key = strtolower(trim((string) $raw));
        if ($key === '') {
            return $default;
        }

        $map = [
            'open' => self::OPEN,
            'baru' => self::OPEN,
            'terbuka' => self::OPEN,
            'assigned_cs' => self::ASSIGNED_CS,
            'assigned' => self::ASSIGNED_CS,
            'diproses' => self::ASSIGNED_CS,
            'pending' => self::ASSIGNED_CS,
            'processing' => self::ASSIGNED_CS,
            'escalated_ops' => self::ESCALATED_OPS,
            'escalated_operations' => self::ESCALATED_OPS,
            'dieskalasi_ops' => self::ESCALATED_OPS,
            'escalated_finance' => self::ESCALATED_FINANCE,
            'dieskalasi_finance' => self::ESCALATED_FINANCE,
            'dieskalasi' => self::ESCALATED_OPS, // ambiguous → ops unless finance specified
            'resolved' => self::RESOLVED,
            'selesai' => self::RESOLVED,
            'closed' => self::CLOSED,
            'tertutup' => self::CLOSED,
            'ditolak' => self::CLOSED,
            'rejected' => self::CLOSED,
        ];

        return $map[$key] ?? (in_array($key, self::all(), true) ? $key : $default);
    }

    /** Indonesian / friendly label for UI. */
    public static function label(string $status): string
    {
        return match (self::normalize($status)) {
            self::OPEN => 'Baru',
            self::ASSIGNED_CS => 'Diproses CS',
            self::ESCALATED_OPS => 'Dieskalasi Operasional',
            self::ESCALATED_FINANCE => 'Dieskalasi Finance',
            self::RESOLVED => 'Selesai',
            self::CLOSED => 'Tertutup',
            default => $status,
        };
    }

    /** User-facing complaint API status (stable camel labels). */
    public static function toUserApi(string $status): string
    {
        return match (self::normalize($status)) {
            self::OPEN => 'Open',
            self::ASSIGNED_CS => 'Processing',
            self::ESCALATED_OPS, self::ESCALATED_FINANCE => 'Escalated',
            self::RESOLVED => 'Resolved',
            self::CLOSED => 'Closed',
            default => 'Open',
        };
    }

    public static function forEscalationDivision(string $division): string
    {
        return match (strtolower($division)) {
            'finance' => self::ESCALATED_FINANCE,
            'operations', 'ops' => self::ESCALATED_OPS,
            default => self::ESCALATED_OPS,
        };
    }

    /** Statuses counted as "open work" for hub stats. */
    public static function openWorkStatuses(): array
    {
        return [self::OPEN, self::ASSIGNED_CS, self::ESCALATED_OPS, self::ESCALATED_FINANCE, 'Terbuka', 'Pending'];
    }

    public static function isTerminal(string $status): bool
    {
        return in_array(self::normalize($status), [self::RESOLVED, self::CLOSED], true);
    }
}
