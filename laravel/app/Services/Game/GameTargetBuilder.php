<?php

namespace App\Services\Game;

use Illuminate\Validation\ValidationException;

/**
 * Builds Digiflazz customer_no for Game Digi purchases from proven account schema.
 * VIP nickname session is never required here.
 */
class GameTargetBuilder
{
    /**
     * @param  array<string, string>  $account
     * @param  array{delivery:string,fields:list<array{key:string,label:string,required:bool}>}  $schema
     */
    public function buildCustomerNo(array $account, array $schema): string
    {
        $this->assertAccountDelivery($schema);

        $parsed = $this->parseAccountFields($schema['fields'] ?? [], $account);

        return $this->composeCustomerNo($parsed['target'], $parsed['zone']);
    }

    /**
     * Validate Digi customer_no already composed by the client.
     *
     * @param  array{delivery:string,fields:list<array{key:string,label:string,required:bool}>}  $schema
     */
    public function assertValidCustomerNo(string $customerNo, array $schema): void
    {
        $this->assertAccountDelivery($schema);

        $customerNo = trim($customerNo);
        if ($customerNo === '') {
            throw ValidationException::withMessages([
                'target_number' => ['Data akun game wajib diisi.'],
            ]);
        }

        $fields = $schema['fields'] ?? [];
        $needsZone = false;
        foreach ($fields as $field) {
            $key = strtolower((string) ($field['key'] ?? ''));
            if (in_array($key, ['zone_id', 'server_id'], true) && ! empty($field['required'])) {
                $needsZone = true;
                break;
            }
        }

        if ($needsZone) {
            if (! str_contains($customerNo, '|')) {
                throw ValidationException::withMessages([
                    'target_number' => ['User ID dan Zone ID wajib diisi (format Digiflazz: user_id|zone_id).'],
                ]);
            }
            [$user, $zone] = array_pad(explode('|', $customerNo, 2), 2, '');
            if (trim($user) === '' || trim($zone) === '') {
                throw ValidationException::withMessages([
                    'target_number' => ['User ID dan Zone ID wajib diisi.'],
                ]);
            }

            return;
        }

        if (str_contains($customerNo, '|')) {
            // Single-field Digi schemas must not send zone delimiter.
            throw ValidationException::withMessages([
                'target_number' => ['Format akun game tidak valid untuk produk ini.'],
            ]);
        }
    }

    /**
     * @param  array{delivery:string,fields:list<array{key:string,label:string,required:bool}>}  $schema
     */
    protected function assertAccountDelivery(array $schema): void
    {
        $delivery = strtolower(trim((string) ($schema['delivery'] ?? '')));
        $fields = $schema['fields'] ?? [];

        if ($delivery !== 'account' || $fields === []) {
            throw ValidationException::withMessages([
                'target_number' => ['Format akun untuk produk ini belum tersedia. Pembelian tidak dapat dilanjutkan.'],
            ]);
        }
    }

    /**
     * @param  list<array{key:string,label:string,required:bool}>  $fields
     * @param  array<string, mixed>  $account
     * @return array{target:string,zone:?string,values:array<string,string>}
     */
    public function parseAccountFields(array $fields, array $account): array
    {
        $values = [];
        foreach ($fields as $field) {
            $key = (string) ($field['key'] ?? '');
            if ($key === '') {
                continue;
            }
            $raw = $account[$key] ?? null;
            $value = is_scalar($raw) ? trim((string) $raw) : '';
            if (! empty($field['required']) && $value === '') {
                throw ValidationException::withMessages([
                    'account.'.$key => [(($field['label'] ?? $key)).' wajib diisi.'],
                ]);
            }
            if ($value !== '') {
                $values[$key] = $value;
            }
        }

        $target = $values['user_id']
            ?? $values['player_id']
            ?? $values['uid']
            ?? $values['garena_id']
            ?? null;

        if ($target === null || $target === '') {
            foreach ($fields as $field) {
                $key = (string) ($field['key'] ?? '');
                if ($key !== '' && ! empty($values[$key])) {
                    $target = $values[$key];
                    break;
                }
            }
        }

        if ($target === null || $target === '') {
            throw ValidationException::withMessages([
                'account' => ['Data akun game wajib diisi.'],
            ]);
        }

        $zone = $values['zone_id'] ?? $values['server_id'] ?? null;

        return [
            'target' => $target,
            'zone' => $zone !== null && $zone !== '' ? $zone : null,
            'values' => $values,
        ];
    }

    public function composeCustomerNo(string $target, ?string $zone): string
    {
        if ($zone !== null && $zone !== '') {
            return $target.'|'.$zone;
        }

        return $target;
    }
}
