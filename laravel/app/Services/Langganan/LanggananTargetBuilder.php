<?php

namespace App\Services\Langganan;

use Illuminate\Validation\ValidationException;

/**
 * Builds and validates customer_no / target display for Langganan Digital.
 */
class LanggananTargetBuilder
{
    /**
     * @param  array<string, string>  $account
     * @param  array{delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}  $schema
     */
    public function buildCustomerNo(array $account, array $schema): string
    {
        $fields = $schema['fields'] ?? [];
        if ($fields === [] || ($schema['delivery'] ?? '') === 'voucher') {
            return (string) config('gurky_langganan.voucher_customer_placeholder', 'LANGGANAN');
        }

        $values = $this->parseAccountValues($fields, $account);

        if (count($values) === 1) {
            return (string) reset($values);
        }

        return implode('|', array_values($values));
    }

    /**
     * @param  array{delivery:string,fields:list<array{key:string,label:string,required:bool,input:string}>}  $schema
     */
    public function assertValidTarget(string $targetNumber, array $schema): void
    {
        $fields = $schema['fields'] ?? [];
        $delivery = (string) ($schema['delivery'] ?? 'voucher');
        $placeholder = (string) config('gurky_langganan.voucher_customer_placeholder', 'LANGGANAN');

        if ($fields === [] || $delivery === 'voucher') {
            if (trim($targetNumber) === '') {
                throw ValidationException::withMessages([
                    'target_number' => ['Nomor tujuan wajib diisi.'],
                ]);
            }

            return;
        }

        if (strcasecmp(trim($targetNumber), $placeholder) === 0) {
            throw ValidationException::withMessages([
                'target_number' => ['Data tujuan langganan wajib diisi sebelum pembayaran.'],
            ]);
        }

        foreach ($fields as $field) {
            if (empty($field['required'])) {
                continue;
            }
            $key = $field['key'];
            $input = $field['input'] ?? 'text';
            $label = $field['label'] ?? $key;

            if ($input === 'email' && !filter_var($targetNumber, FILTER_VALIDATE_EMAIL)) {
                if (count($fields) === 1) {
                    throw ValidationException::withMessages([
                        'target_number' => ["{$label} tidak valid."],
                    ]);
                }
            }
        }
    }

    /**
     * @param  list<array{key:string,label:string,required:bool,input:string}>  $fields
     * @param  array<string, string>  $account
     * @return array<string, string>
     */
    public function parseAccountValues(array $fields, array $account): array
    {
        $values = [];
        $errors = [];

        foreach ($fields as $field) {
            $key = $field['key'];
            $raw = trim((string) ($account[$key] ?? ''));
            $label = $field['label'] ?? $key;
            $required = (bool) ($field['required'] ?? true);
            $input = $field['input'] ?? 'text';

            if ($required && $raw === '') {
                $errors[$key] = ["{$label} wajib diisi."];
                continue;
            }

            if ($raw === '') {
                continue;
            }

            if ($input === 'email' && !filter_var($raw, FILTER_VALIDATE_EMAIL)) {
                $errors[$key] = ["{$label} tidak valid."];
                continue;
            }

            if ($input === 'phone' && strlen(preg_replace('/\D/', '', $raw) ?? '') < 10) {
                $errors[$key] = ["{$label} tidak valid."];
                continue;
            }

            $values[$key] = $input === 'phone' ? (preg_replace('/\D/', '', $raw) ?? $raw) : $raw;
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $values;
    }

    /**
     * @param  array{fields:list<array{key:string,label:string,required:bool,input:string}>}  $schema
     * @param  array<string, string>  $account
     */
    public function displayTarget(string $targetNumber, array $schema, array $account = []): string
    {
        $fields = $schema['fields'] ?? [];
        if ($fields === []) {
            return 'Kode aktivasi via provider';
        }

        if ($account !== []) {
            $parts = [];
            foreach ($fields as $field) {
                $val = trim((string) ($account[$field['key']] ?? ''));
                if ($val !== '') {
                    $parts[] = ($field['label'] ?? $field['key']).': '.$val;
                }
            }
            if ($parts !== []) {
                return implode(' · ', $parts);
            }
        }

        return $targetNumber;
    }

    /**
     * @param  array<string, string>  $account
     * @param  array{fields:list<array{key:string,label:string,required:bool,input:string}>}  $schema
     * @return array<string, string>
     */
    public function metadataTargets(array $account, array $schema): array
    {
        $out = [];
        foreach ($schema['fields'] ?? [] as $field) {
            $val = trim((string) ($account[$field['key']] ?? ''));
            if ($val !== '') {
                $out[$field['label'] ?? $field['key']] = $val;
            }
        }

        return $out;
    }
}
