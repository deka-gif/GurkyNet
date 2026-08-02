<?php

namespace App\Http\Requests\Admin\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class CreatePromotionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'code' => 'required|string|max:100',
            'description' => 'nullable|string',
            'discount_amount' => 'required|numeric|min:0',
            'discount_type' => 'required|string|in:fixed,percentage',
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
