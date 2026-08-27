<?php

namespace App\Http\Requests\Admin\Finance;

use Illuminate\Foundation\Http\FormRequest;

class FinanceRefundActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Required on approve (enforced by withIdempotency); optional on reject.
            'idempotency_key' => 'nullable|string|max:80',
            'notes' => 'nullable|string|max:500',
            'reason' => 'nullable|string|max:500',
        ];
    }
}
