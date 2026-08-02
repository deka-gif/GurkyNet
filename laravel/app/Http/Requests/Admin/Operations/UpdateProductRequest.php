<?php

namespace App\Http\Requests\Admin\Operations;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sell_price' => 'nullable|numeric|min:0',
            'margin' => 'nullable|numeric|min:0',
            'status' => 'nullable|boolean',
            'admin_notes' => 'nullable|string|max:500',
        ];
    }
}
