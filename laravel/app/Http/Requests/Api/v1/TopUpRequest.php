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

    /**
     * FR-USR03 — user-initiated wallet top-up. Amount is server-validated (never trust FE).
     */
    public function rules(): array
    {
        return [
            'amount' => [
                'required',
                'numeric',
                'min:10000',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! is_numeric($value)) {
                        $fail('Nominal top up harus berupa angka.');

                        return;
                    }

                    $amount = (float) $value;
                    if ($amount < 10000) {
                        $fail('Nominal top up minimal Rp 10.000.');

                        return;
                    }
                    if ($amount <= 0) {
                        $fail('Nominal top up tidak valid.');

                        return;
                    }
                    if ((int) $amount != $amount) {
                        $fail('Nominal top up harus berupa bilangan bulat.');
                    }
                },
            ],
            'admin_fee' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string|max:32',
            'channel' => 'nullable|string|max:32',
            // SRS 14.1 — required for balance-mutating top-up.
            'idempotency_key' => 'required|string|max:80',
            // Client-supplied status / user_id ignored — ownership is always $request->user().
        ];
    }

    public function messages(): array
    {
        return [
            'amount.required' => 'Nominal top up wajib diisi.',
            'amount.numeric' => 'Nominal top up harus berupa angka.',
            'amount.min' => 'Nominal top up minimal Rp 10.000.',
            'idempotency_key.required' => 'idempotency_key wajib diisi untuk aksi yang mengubah saldo.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        $errors = $validator->errors();
        $message = 'Data top up tidak valid.';
        if ($errors->has('amount')) {
            $message = (string) $errors->first('amount');
        } elseif ($errors->has('channel')) {
            $message = (string) $errors->first('channel');
        } elseif ($errors->has('payment_method')) {
            $message = (string) $errors->first('payment_method');
        } elseif ($errors->has('idempotency_key')) {
            $message = (string) $errors->first('idempotency_key');
        }

        throw new HttpResponseException(response()->json([
            'success' => false,
            'code' => $this->errorCodeFromMessages($errors),
            'message' => $message,
            'data' => null,
            'meta' => null,
            'errors' => $errors,
        ], 422));
    }

    protected function errorCodeFromMessages(\Illuminate\Support\MessageBag $errors): string
    {
        $amount = (string) $errors->first('amount');
        if ($amount !== '' && str_contains($amount, 'minimal')) {
            return 'TOPUP_AMOUNT_TOO_SMALL';
        }
        if ($errors->has('channel') || $errors->has('payment_method')) {
            return 'TOPUP_CHANNEL_UNAVAILABLE';
        }

        return 'TOPUP_VALIDATION_FAILED';
    }
}
