<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class TransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'recipient_wallet_number' => 'required|string',
            'amount' => 'required|numeric|min:1000',
            'pin' => 'required|string|size:6|regex:/^\d{6}$/',
            // admin_fee stripped — server WalletAdminFeeResolver::transferFee() only.
            // SRS 14.1 — required for balance-mutating transfer.
            'idempotency_key' => 'required|string|max:80',
        ];
    }

    /**
     * P0 — never trust client admin_fee / total_payment for wallet transfer.
     */
    protected function prepareForValidation(): void
    {
        $this->request->remove('admin_fee');
        $this->request->remove('total_payment');
        $this->request->remove('status');
        $this->request->remove('user_id');
    }

    public function messages(): array
    {
        return [
            'recipient_wallet_number.required' => 'Nomor rekening/wallet tujuan wajib diisi.',
            'amount.required' => 'Nominal transfer wajib diisi.',
            'amount.numeric' => 'Nominal transfer harus berupa angka.',
            'amount.min' => 'Nominal transfer minimal Rp 1.000.',
            'pin.required' => 'PIN transaksi wajib diisi.',
            'pin.size' => 'PIN transaksi harus berupa 6 digit angka.',
            'pin.regex' => 'PIN transaksi harus berupa angka saja.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Data transfer tidak valid.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
