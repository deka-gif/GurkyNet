<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class PlnInquiryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_no' => ['required', 'string', 'regex:/^\d{11,12}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_no.required' => 'Nomor meter / ID pelanggan PLN wajib diisi.',
            'customer_no.regex' => 'Nomor meter / ID pelanggan PLN harus 11–12 digit angka.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('customer_no')) {
            $this->merge([
                'customer_no' => preg_replace('/\D/', '', (string) $this->input('customer_no')),
            ]);
        }
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Data inquiry PLN tidak valid.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
