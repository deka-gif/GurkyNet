<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class VerifyOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'onboarding_id' => 'nullable|integer|exists:onboarding_attempts,id',
            'phone_number' => 'required_without:onboarding_id|string|regex:/^08[0-9]{8,11}$/',
            'code' => 'required|string|size:6',
            'action' => 'required|string|in:registration,pin_reset,password_reset,verification,onboarding_registration',
        ];
    }

    public function messages(): array
    {
        return [
            'code.size' => 'Kode OTP harus tepat 6 digit.',
            'action.in' => 'Aksi OTP yang diajukan tidak valid.',
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
