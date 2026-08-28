<?php

namespace App\Http\Requests\Api\v1;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class CreateVoucherPhysicalBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sku_code' => 'required|string',
            'serials' => 'required|array|min:1',
            'serials.*.serial_number' => 'required|string|max:64',
            'serials.*.scanned_at' => 'nullable|date',
            'pin' => 'required|string|size:6|regex:/^\d{6}$/',
            // SRS 14.1 — required for balance-mutating purchase.
            'idempotency_key' => 'required|string|max:80',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->request->remove('status');
        $this->request->remove('amount');
        $this->request->remove('total_payment');
        $this->request->remove('unit_price');
    }

    public function messages(): array
    {
        return [
            'sku_code.required' => 'SKU produk wajib dipilih.',
            'serials.required' => 'Masukkan minimal 1 nomor seri voucher.',
            'serials.min' => 'Masukkan minimal 1 nomor seri voucher.',
            'serials.*.serial_number.required' => 'Nomor seri tidak boleh kosong.',
            'pin.required' => 'PIN transaksi wajib diisi.',
            'pin.size' => 'PIN transaksi harus berupa 6 digit angka.',
            'pin.regex' => 'PIN transaksi harus berupa angka saja.',
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => 'Data batch voucher fisik tidak valid.',
            'errors' => $validator->errors(),
        ], 422));
    }
}
