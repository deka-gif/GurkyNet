<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * P0 — finalize requires finalize_token capability; onboarding_id is locator only.
 * Identity fields (email/phone/user_id/wallet_id) are intentionally NOT accepted.
 */
class FinalizeRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'onboarding_id' => 'required|integer',
            'finalize_token' => 'required|string|min:32|max:128',
            'pin' => 'required|string|regex:/^\d{6}$/',
            'pin_confirmation' => 'required|same:pin',
            'remember_device' => 'nullable|boolean',
            // Sprint 18 — server-side policy acceptance (Bagian 27/28)
            'accept_policies' => 'accepted',
        ];
    }

    public function messages(): array
    {
        return [
            'finalize_token.required' => 'Token finalisasi wajib dikirim.',
            'pin.regex' => 'PIN harus tepat 6 digit angka.',
            'pin_confirmation.same' => 'Konfirmasi PIN tidak cocok.',
            'accept_policies.accepted' => 'Anda wajib menyetujui kebijakan yang berlaku.',
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
