<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $identifier = $this->input('phone_or_email') 
            ?? $this->input('email') 
            ?? $this->input('phone') 
            ?? $this->input('phone_number') 
            ?? $this->input('identity') 
            ?? $this->input('username');

        if ($identifier !== null) {
            $this->merge([
                'phone_or_email' => (string) $identifier,
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'phone_or_email' => 'required|string',
            'password' => 'required|string',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Data login yang dikirimkan tidak valid.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
