<?php

namespace App\Services\ProductProviders;

/**
 * Normalize VIP Reseller / VIPAYMENT order & status payloads.
 *
 * Official shapes (VIPayment API Prepaid.pdf):
 * - Create order: data object { trxid, data, code, service, status, note, balance?, price, ... }
 * - Status / webhook: data LIST of { trxid, data, service, status, note, price, ... }
 *
 * Official status values: waiting | processing | success | error
 * Extra aliases (sukses/gagal/…) are kept for backward compatibility only.
 */
final class VipOrderPayload
{
    /** @return list<string> */
    public static function officialStatuses(): array
    {
        return ['waiting', 'processing', 'success', 'error'];
    }

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
     *
     * PDF-official: waiting, processing → pending; success → success; error → failed.
     */
    public static function normalizeStatus(string $status): string
    {
        $status = strtolower(trim($status));

        // Official prepaid statuses first.
        if ($status === 'success') {
            return 'success';
        }

        if ($status === 'error') {
            return 'failed';
        }

        if (in_array($status, ['waiting', 'processing'], true)) {
            return 'pending';
        }

        // Backward-compatible aliases (not listed in Prepaid PDF).
        if (in_array($status, ['sukses', 'ok', 'berhasil'], true)) {
            return 'success';
        }

        if (in_array($status, ['failed', 'gagal', 'fail', 'cancel', 'canceled', 'cancelled', 'rejected'], true)) {
            return 'failed';
        }

        // Unknown / pending / proses / empty → keep in-flight
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
