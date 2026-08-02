<?php

namespace App\Http\Requests\Admin\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class UpdateVoucherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'nullable|string|max:255',
            'code' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'discount_amount' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|string|in:fixed,percentage',
            'min_transaction' => 'nullable|numeric|min:0',
            'quota' => 'nullable|integer|min:0',
            'image_url' => 'nullable|string|max:500',
            'image_media_id' => 'nullable|integer',
            'mobile_image_media_id' => 'nullable|integer',
            'redirect_url' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ];
    }
}
