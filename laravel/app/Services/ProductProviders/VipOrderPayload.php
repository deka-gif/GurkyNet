<?php

namespace App\Services\ProductProviders;

/**
 * Normalize VIP Reseller / VIPAYMENT order & status payloads.
 *
 * Official shapes:
 * - Create order: data is often an object { trxid, status: waiting|processing|success|error, note, ... }
 * - Status check: data is often a LIST of those objects
 */
final class VipOrderPayload
{
    /**
     * @param  array<string, mixed>  $raw  Full API body or a data node
     * @return array{trxid:?string,status:string,sn:?string,note:?string,provider_time:?string,row:array<string,mixed>}
     */
    public static function extract(array $raw, ?string $preferTrxid = null): array
    {
        $node = $raw['data'] ?? $raw;
        $row = self::pickRow($node, $preferTrxid);

        $trxid = self::stringOrNull(
            $row['trxid'] ?? $row['trx_id'] ?? $row['id'] ?? $row['transaction_id'] ?? null
        );

        $statusRaw = strtolower(trim((string) ($row['status'] ?? $row['stat'] ?? '')));
        $note = self::stringOrNull($row['note'] ?? $row['message'] ?? null);
        $sn = self::stringOrNull($row['sn'] ?? null);
        if ($sn === null && $note !== null && $note !== '') {
            // VIP often puts serial / token into note on success.
            $sn = $note;
        }

        $providerTime = self::stringOrNull(
            $row['created']
                ?? $row['created_at']
                ?? $row['date']
                ?? $row['waktu']
                ?? $row['timestamp']
                ?? $row['trx_date']
                ?? null
        );

        return [
            'trxid' => $trxid,
            'status' => self::normalizeStatus($statusRaw),
            'sn' => $sn,
            'note' => $note,
            'provider_time' => $providerTime,
            'row' => $row,
        ];
    }

    /**
     * Map VIP status vocabulary → engine status (success|failed|pending).
     */
    public static function normalizeStatus(string $status): string
    {
        $status = strtolower(trim($status));

        if (in_array($status, ['success', 'sukses', 'ok', 'berhasil'], true)) {
            return 'success';
        }

        if (in_array($status, ['error', 'failed', 'gagal', 'fail', 'cancel', 'canceled', 'cancelled', 'rejected'], true)) {
            return 'failed';
        }

        // waiting / processing / pending / proses / empty
        return 'pending';
    }

    /**
     * @param  mixed  $node
     * @return array<string, mixed>
     */
    protected static function pickRow(mixed $node, ?string $preferTrxid): array
    {
        if (!is_array($node) || $node === []) {
            return [];
        }

        // List of orders (status API)
        if (array_is_list($node)) {
            if ($preferTrxid) {
                foreach ($node as $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    $id = (string) ($item['trxid'] ?? $item['trx_id'] ?? $item['id'] ?? '');
                    if ($id !== '' && $id === (string) $preferTrxid) {
                        return $item;
                    }
                }
            }

            $first = $node[0] ?? null;

            return is_array($first) ? $first : [];
        }

        // Associative order object (create order API)
        return $node;
    }

    protected static function stringOrNull(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $str = trim((string) $value);

        return $str === '' ? null : $str;
    }
}
