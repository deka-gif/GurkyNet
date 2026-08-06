<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class GameInquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sku_code' => 'required|string|max:64',
            'account' => 'required|array',
            'account.*' => 'nullable|string|max:128',
        ];
    }

    public function messages(): array
    {
        return [
            'sku_code.required' => 'SKU produk wajib dipilih.',
            'account.required' => 'Data akun game wajib diisi.',
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
