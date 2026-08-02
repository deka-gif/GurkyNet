<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class TopUpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => 'required|numeric|min:10000',
            'admin_fee' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|in:sukses,pending,gagal',
        ];
    }

    public function messages(): array
    {
        return [
            'amount.required' => 'Nominal top up wajib diisi.',
            'amount.numeric' => 'Nominal top up harus berupa angka.',
            'amount.min' => 'Nominal top up minimal Rp 10.000.',
            'status.in' => 'Status transaksi tidak valid.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Data top up tidak valid.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
