<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class EwalletInquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sku_code' => 'required|string|max:64',
            'customer_no' => 'required|string|max:20',
            // Open-amount (Bebas Nominal) — client-typed face value for Digi inq-pasca.
            // Digiflazz E-Money requires multiples of 1000 (RC 87); enforced in inquireEwallet too.
            'amount' => ['required', 'integer', 'min:1', function (string $attribute, mixed $value, \Closure $fail): void {
                if (! is_numeric($value) || (int) $value % 1000 !== 0) {
                    $fail('Nominal harus kelipatan Rp1.000');
                }
            }],
        ];
    }

    public function messages(): array
    {
        return [
            'sku_code.required' => 'SKU produk wajib dipilih.',
            'customer_no.required' => 'Nomor HP e-wallet wajib diisi.',
            'amount.required' => 'Nominal top up wajib diisi.',
            'amount.integer' => 'Nominal harus berupa angka bulat.',
            'amount.min' => 'Nominal tidak valid.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Data inquiry tidak valid.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
