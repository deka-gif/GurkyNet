<?php

namespace App\Services\ProductProviders;

/**
 * Normalize VIP Reseller / VIPayment Profile API response (VIPayment API Profile.pdf).
 *
 * Official data fields: full_name, username, balance, point, level, registered.
 */
final class VipProfilePayload
{
    /**
     * @param  array<string, mixed>  $body  Full API JSON body
     * @return array{
     *   full_name:?string,
     *   username:?string,
     *   balance:?float,
     *   point:?int,
     *   level:?string,
     *   registered:?string
     * }
     */
    public static function fromResponse(array $body): array
    {
        $data = $body['data'] ?? null;
        if (! is_array($data)) {
            return self::empty();
        }

        return self::fromData($data);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{
     *   full_name:?string,
     *   username:?string,
     *   balance:?float,
     *   point:?int,
     *   level:?string,
     *   registered:?string
     * }
     */
    public static function fromData(array $data): array
    {
        $balance = null;
        if (isset($data['balance']) && is_numeric($data['balance'])) {
            $balance = (float) $data['balance'];
        }

        $point = null;
        if (array_key_exists('point', $data) && $data['point'] !== null && $data['point'] !== '') {
            if (is_numeric($data['point'])) {
                $point = (int) $data['point'];
            }
        }

        return [
            'full_name' => self::stringOrNull($data['full_name'] ?? null),
            'username' => self::stringOrNull($data['username'] ?? null),
            'balance' => $balance,
            'point' => $point,
            'level' => self::stringOrNull($data['level'] ?? null),
            'registered' => self::stringOrNull($data['registered'] ?? null),
        ];
    }

    /**
     * @return array{
     *   full_name:?string,
     *   username:?string,
     *   balance:?float,
     *   point:?int,
     *   level:?string,
     *   registered:?string
     * }
     */
    public static function empty(): array
    {
        return [
            'full_name' => null,
            'username' => null,
            'balance' => null,
            'point' => null,
            'level' => null,
            'registered' => null,
        ];
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
