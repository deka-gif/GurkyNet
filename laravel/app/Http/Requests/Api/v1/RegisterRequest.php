<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'phone_number' => 'required|string|unique:users,phone_number|regex:/^08[0-9]{8,11}$/',
            'password' => 'required|string|min:8|confirmed',
            // FR-REF-02 — optional referral code
            'referral_code' => 'nullable|string|min:6|max:20|regex:/^[A-Za-z0-9]+$/',
        ];
    }

    public function messages(): array
    {
        return [
            'phone_number.regex' => 'Nomor handphone harus diawali dengan 08 dan memiliki panjang antara 10 hingga 13 digit.',
            'phone_number.unique' => 'Nomor handphone sudah terdaftar di sistem.',
            'email.unique' => 'Alamat email sudah terdaftar di sistem.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
            'password.min' => 'Kata sandi minimal harus terdiri dari 8 karakter.',
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
