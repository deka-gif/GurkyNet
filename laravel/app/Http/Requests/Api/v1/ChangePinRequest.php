<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class ChangePinRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'old_pin' => 'nullable|string|size:6',
            'new_pin' => 'required|string|size:6|regex:/^\d{6}$/',
        ];
    }

    public function messages(): array
    {
        return [
            'new_pin.size' => 'PIN baru harus 6 digit.',
            'new_pin.regex' => 'PIN baru harus berupa angka.',
            'old_pin.size' => 'PIN lama harus 6 digit.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Data yang dikirimkan tidak valid.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
