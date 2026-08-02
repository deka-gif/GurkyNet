<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class CreateTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sku_code' => 'required|string',
            'target_number' => 'required|string',
            'pin' => 'required|string|size:6|regex:/^\d{6}$/',
            'admin_fee' => 'nullable|numeric|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'sku_code.required' => 'SKU produk wajib dipilih.',
            'target_number.required' => 'Nomor tujuan / nomor meteran wajib diisi.',
            'pin.required' => 'PIN transaksi wajib diisi.',
            'pin.size' => 'PIN transaksi harus berupa 6 digit angka.',
            'pin.regex' => 'PIN transaksi harus berupa angka saja.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Data transaksi tidak valid.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
