<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class WithdrawRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => 'required|numeric|min:10000',
            'pin' => 'required|string|size:6|regex:/^\d{6}$/',
            'bank_name' => 'required|string|max:50',
            'account_number' => 'required|string|max:50',
            'admin_fee' => 'nullable|numeric|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'amount.required' => 'Nominal penarikan wajib diisi.',
            'amount.min' => 'Minimal penarikan adalah Rp 10.000.',
            'pin.required' => 'PIN transaksi wajib diisi.',
            'bank_name.required' => 'Nama bank wajib diisi.',
            'account_number.required' => 'Nomor rekening wajib diisi.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Data penarikan tidak valid.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
