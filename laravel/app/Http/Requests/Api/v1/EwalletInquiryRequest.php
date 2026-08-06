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
        ];
    }

    public function messages(): array
    {
        return [
            'sku_code.required' => 'SKU produk wajib dipilih.',
            'customer_no.required' => 'Nomor HP e-wallet wajib diisi.',
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
